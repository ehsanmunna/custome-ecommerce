# Design

## Context

See `proposal.md` for motivation. The current admin is an Angular 22 application under `apps/admin` with:

- Tailwind 3.4 wired through `tailwind.config.js`, `postcss.config.js`, and `@tailwind` directives in `src/styles.css`. Tailwind utility classes appear about 950 times across 25 component templates. Many colors are already expressed as arbitrary values pointing at theme variables, e.g. `bg-[var(--color-primary)]`.
- `primeng ^22.1.4` in `package.json`, but no `primeng` import or `p-*` component anywhere in `src`.
- Theme variables defined twice: literal CSS variables in `src/theme/theme.css` and a TypeScript copy in `src/theme/tokens.ts`. `tokens.ts` has no consumers.
- Two components with inline `styles` blocks: `profile.component.ts` and `theme-toggle.component.ts`.
- No test asserts on CSS class names, so class replacement does not affect existing specs.
- `package.json` `build` runs `tsc`, while real stylesheet compilation happens through the Angular CLI (`ng build` / `ng serve`, configured in `angular.json`). Verification must therefore cover both scripts.

## Goals / Non-Goals

**Goals:**

- Replace Tailwind utilities with a small, semantic CSS class layer backed by the existing theme variables.
- Remove Tailwind, PostCSS, autoprefixer, and PrimeNG dependencies and configuration.
- Preserve the light / dark / client-branded themes and `localStorage` behavior.
- Keep visual layout and component behavior equivalent screen by screen.

**Non-Goals:**

- Redesigning screens or changing the DOM structure beyond what class replacement requires.
- Adding a replacement UI framework, CSS-in-JS, or SCSS toolchain.
- Wiring the existing (currently unmounted) theme toggle into a shell.
- Changing tests, routes, API calls, or component logic.

## Decisions

### Shared semantic CSS layer in global styles

**Decision:** Add a global component layer (in `src/styles.css` or a file it imports) with semantic classes such as `.page`, `.page-title`, `.toolbar`, `.card`, `.modal`, `.modal-backdrop`, `.btn`, `.btn-primary`, `.btn-danger`, `.btn-link`, `.input`, `.select`, `.label`, `.error-text`, `.muted`, `.table`, `.badge`, `.form-field`. Component templates use these classes; one-off layout uses component-scoped CSS only where a shared class would be misleading.

**Rationale:** 25 screens repeat the same button, table, form, and modal patterns. A semantic layer removes duplication without introducing another framework, and keeps theme variables in one place.

**Alternatives:**
- Per-component scoped styles: rejected because it copies the same rules 25 times and drifts immediately.
- Another utility framework: rejected by the request and would repeat the same migration cost.
- SCSS: rejected as unnecessary; plain CSS with custom properties covers the need without a new dependency.

### `theme.css` is the single token source

**Decision:** Keep `src/theme/theme.css` as the authoritative definition of `:root`, `html.dark`, and `html.client-branded` variables. Delete `src/theme/tokens.ts`, which duplicates those values and has no importers.

**Rationale:** The stylesheet is what actually drives rendering. Keeping an unused TypeScript duplicate creates exactly the drift the original theme design tried to avoid.

**Alternative:** Generate `theme.css` from `tokens.ts` at build time. Rejected because no runtime consumer needs the TypeScript object; adding a generator would add tooling for no current benefit.

### Convert before removing the toolchain

**Decision:** Migrate screens while Tailwind is still installed, then remove Tailwind/PostCSS/PrimeNG in a final step.

**Rationale:** The migration can be verified incrementally against a working build, and any missed utility class is still visible in the rendered output. Removing dependencies first would make regressions harder to isolate.

**Alternative:** Remove dependencies first, then fix the fallout. Rejected because it produces one large, unverifiable styling break.

### Class mapping strategy

**Decision:** Replace utilities with the closest semantic class rather than preserving atomic behavior. Examples: `px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-primary)] text-[var(--color-primary-foreground)]` becomes `btn btn-primary`; `w-full p-2 border border-[var(--color-border)] rounded-md` becomes `input`; repeated table cell utilities become `.table` descendant rules. Arbitrary sizes such as `max-w-[1200px]` and modal widths move into the relevant semantic class or a component style.

**Rationale:** A mechanical one-to-one mapping would recreate Tailwind in another syntax. Semantic classes make later changes cheaper and keep templates readable.

**Alternative:** Keep atomic class names and define each as a CSS rule. Rejected because it preserves utility sprawl and makes every screen carry a long class list.

### PrimeNG removal is dependency-only

**Decision:** Remove `primeng` from `package.json` and the lockfile. Do not add replacement component code, because no source file uses PrimeNG.

**Rationale:** There is nothing to migrate. The only behavior change is that the dependency and its spec requirement disappear.

## Risks / Trade-offs

- [Missed utility classes] → A leftover `flex`, `p-4`, or `max-w-[...]` silently loses styling once Tailwind is gone. Mitigation: convert screen by screen, grep for known utility prefixes before removing the toolchain, and smoke-test every route listed in `app.routes.ts`.
- [Visual drift] → Semantic classes may collapse subtle spacing differences. Mitigation: preserve the existing visual values in the shared classes, and review the high-traffic screens (login, dashboard, product/order tables, settings, CMS) before and after.
- [Arbitrary values lost] → Tailwind arbitrary values such as `text-[var(--color-text-muted)]` and `max-h-[90vh]` are easy to drop. Mitigation: include a dedicated sweep for `[...]` class tokens during conversion.
- [Build-script gap] → `pnpm --filter admin build` only runs `tsc`, so a broken stylesheet could pass. Mitigation: also run the Angular CLI build (`pnpm --filter admin exec ng build`) and lint/test after the conversion.
- [Autoprefixing] → Removing the project `postcss.config.js` also removes the explicit `autoprefixer` entry. Mitigation: the Angular CLI applies its own PostCSS/autoprefixer pipeline based on browserslist; verify the production build and rendered output. Re-add a minimal PostCSS config only if a real gap appears.
- [Unused theme toggle] → The toggle component exists but is not mounted. This change leaves that behavior untouched; do not mistake its presence for working UI.

## Migration Plan

1. Add the shared semantic class layer and keep `theme.css` as the token source.
2. Convert screens in groups: auth/dashboard, catalog, inventory, orders/returns, settings/CMS, reporting/profile.
3. Verify each group with `pnpm --filter admin typecheck`, `lint`, `test`, and an Angular CLI build.
4. Remove Tailwind, PostCSS, autoprefixer, and PrimeNG from `package.json`; delete `tailwind.config.js`, `postcss.config.js`, and `tokens.ts`; drop the `@tailwind` directives.
5. Refresh the lockfile, confirm no `tailwind`/`primeng` references remain outside archived artifacts, and run the full admin verification plus a route smoke test.

Rollback: restore the removed config files and dependency entries from version control. The conversion itself is CSS-only, so reverting the component changes is independent of backend or data changes.
