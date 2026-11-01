# Proposal

## Why

The admin dashboard carries two styling layers that no longer earn their cost. Tailwind utility classes are spread across roughly 950 occurrences in 25 components, yet the active `admin-dashboard-theme` spec also mandates PrimeNG integration — a dependency that is installed but never imported anywhere in `apps/admin/src`. This leaves build tooling (PostCSS/Tailwind), a package dependency, and a spec requirement that do not match the code. Removing both simplifies the admin build, reduces maintenance surface, and makes the spec describe reality.

## What Changes

- Remove `tailwindcss`, `postcss`, `autoprefixer`, and `primeng` from `apps/admin/package.json`, and delete `tailwind.config.js` and `postcss.config.js`.
- Replace the `@tailwind` directives in `apps/admin/src/styles.css` with plain CSS.
- Convert Tailwind utility classes in all 25 admin components to plain CSS using a small shared class layer (for example `.btn`, `.btn-primary`, `.btn-danger`, `.card`, `.table`, `.input`, `.form-field`) backed by the existing theme CSS variables.
- Keep the existing light/dark/client-branded theming, the `html.dark` / `html.client-branded` class switching, and `localStorage` persistence unchanged.
- Update the `admin-dashboard-theme` capability: replace the Tailwind-based component requirement with a plain-CSS requirement, replace the framework-coupled token requirement with a framework-neutral one, and remove the PrimeNG integration requirement.
- Preserve visual parity and all component behavior; this is a styling-implementation change, not a redesign.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `admin-dashboard-theme`: "Themeable UI components" changes from Tailwind utility classes to plain CSS classes backed by theme tokens; "Theme token system" is replaced by the framework-neutral "Admin design tokens"; "PrimeNG integration" is removed.

## Impact

- Affected code: `apps/admin/package.json`, `apps/admin/tailwind.config.js`, `apps/admin/postcss.config.js`, `apps/admin/src/styles.css`, `apps/admin/src/theme/*`, and all 25 component templates under `apps/admin/src`.
- Affected dependencies: `tailwindcss`, `postcss`, `autoprefixer`, `primeng`, and their lockfile entries.
- Affected specs: `openspec/specs/admin-dashboard-theme/spec.md` (via this change's delta).
- Affected APIs: None.
- Affected docs: `apps/admin/README.md` only if it documents the removed tooling (currently it does not).

## Non-goals

- Storefront styling or theming.
- Redesigning admin screens or changing layout/visual identity.
- Changing Angular, the theme options, or `localStorage` persistence.
- Wiring the theme toggle into a shell/nav menu (it is currently unused; tracked separately).
- Changing any API, OpenAPI contract, or backend behavior.
- Editing archived change artifacts under `openspec/changes/archive/`.
