# Design

## Context

See `proposal.md` for motivation and `specs/admin-dashboard-theme/spec.md` for requirements. The admin dashboard (`apps/admin`) is an Angular 22 (`@angular/core: ^22.2.3`, `@angular/cli: "22.2.3"`) application with no CSS framework and no design tokens. Each component defines its own inline `<styles>` block with hardcoded colors. `apps/admin/src/styles.css` is empty. The `admin-console` capability spec already requires client-specific visual branding ("its configured name, logo, and visual theme are used throughout the shell"), but no theme mechanism exists. The admin dashboard already uses Angular `HttpClient` with `AuthService` and `ADMIN_AUTH_CONFIG`, and all API calls include the `/v1/` URI version prefix per the NestJS API configuration.

## Goals / Non-Goals

**Goals:**
- Add Tailwind CSS to `apps/admin` via PostCSS, configured with theme design tokens.
- Add PrimeNG compatible with Angular 22, including a PrimeNG theme preset.
- Define theme tokens shared by Tailwind and PrimeNG.
- Add a theme toggle (light / dark / client-branded) persisted to localStorage.
- Migrate existing admin components from inline styles to Tailwind utility classes backed by theme tokens.

**Non-Goals:**
- Storefront theming (Phase 4 concern per project context).
- Changing any API endpoint or OpenAPI contract.
- Adding new admin screens beyond theme migration of existing screens.
- Persisting theme preference server-side.

## Decisions

### Tailwind CSS via PostCSS

**Decision:** Add Tailwind CSS (v3.x or v4.x) to `apps/admin` using PostCSS, with a `tailwind.config.js` that extends the default theme with project design tokens.

**Rationale:** Tailwind provides utility classes that replace inline styles, keeps bundle size small via purging, and integrates well with Angular CLI builds.

**Alternative:** Component-scoped CSS variables only - rejected because it doesn't give a reusable design system across components and frameworks.

### PrimeNG compatible with Angular 22

**Decision:** Add PrimeNG at a version compatible with Angular 22 (`@angular/core: ^22.2.3`), configured with a theme preset that consumes the same design tokens as Tailwind.

**Rationale:** PrimeNG provides accessible, feature-rich Angular UI components (button, card, table, dialog, input, etc.) that the admin dashboard can adopt incrementally. The theme preset ensures PrimeNG components look consistent with Tailwind-styled custom markup.

**Alternative:** Build custom Angular components from scratch - rejected as it duplicates PrimeNG's accessibility and feature work.

### Theme token system

**Decision:** Define design tokens in a shared TypeScript/JavaScript module consumed by both `tailwind.config.js` and the PrimeNG theme preset. Tokens cover: primary, danger, success, warning, info, surface, text (primary/secondary/muted), border, shadow, spacing, and typography.

**Rationale:** A single source of truth for tokens prevents Tailwind and PrimeNG from drifting apart visually.

**Alternative:** Separate token sets for Tailwind and PrimeNG - rejected because it creates visual inconsistency and maintenance burden.

### Theme toggle (light / dark / client-branded)

**Decision:** Add a theme selector in the admin shell that switches between light, dark, and client-branded themes. Persist the choice to `localStorage`. Apply via a CSS class on `<html>` or `<body>` that Tailwind and PrimeNG read via `dark:` variants and theme preset variables.

**Rationale:** Supports the `admin-console` spec's client-branding requirement while giving users a immediate light/dark choice. `localStorage` persistence avoids a flash of wrong theme on reload.

**Alternative:** Server-side theme preference - rejected as out of scope (no API change planned).

### Migration strategy

**Decision:** Migrate existing admin components incrementally, screen by screen, replacing inline `<styles>` blocks with Tailwind utility classes. Do not rewrite component logic - only styling.

**Rationale:** Keeps the change scoped to styling. Component behavior and API contracts remain unchanged.

**Alternative:** Rewrite all components with PrimeNG - rejected as it expands scope beyond theming and risks introducing behavior changes.

## Risks / Trade-offs

- [PrimeNG Angular 22 compatibility] → Angular 22 (`@angular/core: ^22.2.3`) is a hypothetical/future version; PrimeNG may not have a published version supporting it. Verify PrimeNG version compatibility before adding dependencies. If no compatible PrimeNG exists, scope the change to Tailwind only and note PrimeNG as a follow-up.
- [Tailwind + Angular CLI build] → Angular CLI v22 build pipeline must process PostCSS/Tailwind without breaking existing `tsc` typecheck or `eslint`. Verify `ng serve` and `ng build` work after adding Tailwind.
- [Inline style drift] → Existing components have 100+ inline `<styles>` blocks with hardcoded colors. Migration is mechanical but extensive; prioritize high-visibility screens (dashboard, login, settings) first.
- [CSS framework bundle size] → Tailwind's purge must be configured to scan Angular templates so unused utilities are removed in production builds.

## Migration Plan

1. Add Tailwind CSS + PostCSS to `apps/admin`; verify `ng build` and `ng serve` work.
2. Add PrimeNG (Angular 22-compatible version) + theme preset; verify components render.
3. Define theme token module; wire into `tailwind.config.js` and PrimeNG preset.
4. Add theme toggle component + `localStorage` persistence.
5. Migrate components screen-by-screen from inline styles to Tailwind classes.
6. Run `pnpm --filter admin build`, `lint`, `typecheck`, `test` after each screen migration.

## Open Questions

- What PrimeNG version supports Angular 22? (Angular 22 is hypothetical; confirm before adding dependency.)
- Should the theme toggle live in the navbar, a user menu, or a settings page?
- Should client-branded theme values come from an API endpoint or a static config file?
