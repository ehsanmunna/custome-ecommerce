# Proposal

## Why

The admin dashboard has no theme. Every component ships its own inline `<styles>` block with hardcoded colors (`#007bff` primary, `#dc3545` danger, `#666` muted). `apps/admin/src/styles.css` is empty. There is no CSS framework, no design tokens, and no way to apply a consistent look across screens or support client-specific branding. The `admin-console` spec already requires client branding ("its configured name, logo, and visual theme are used throughout the shell"), but nothing implements it.

## What Changes

- Add Tailwind CSS to `apps/admin` via PostCSS, configured with theme design tokens.
- Add PrimeNG compatible with Angular 22 (`@angular/core: ^22.2.3`), including a PrimeNG theme preset.
- Define theme tokens (colors, spacing, typography, borders) shared by Tailwind and PrimeNG.
- Add a theme toggle (light / dark / client-branded) persisted to localStorage.
- Migrate existing admin components from inline styles to Tailwind utility classes backed by theme tokens.

## Capabilities

### New Capabilities

- `admin-dashboard-theme`: Themeable admin dashboard with Tailwind + PrimeNG, theme token system, and theme toggle.

### Modified Capabilities

- None.

## Impact

- Affected code: `apps/admin/src/styles.css`, `apps/admin/tailwind.config.js`, `apps/admin/postcss.config.js`, all existing admin components.
- Affected APIs: None.
- Depends on: `add-admin-shell-and-auth` (admin shell + auth already built), Angular 22 runtime already in `apps/admin/package.json`.
- Non-goals: Storefront theming, changing any API endpoint or contract, adding new admin screens beyond theme migration.

## Non-goals

- Storefront implementation or redesign.
- Payment-provider, courier, or notification-provider integrations.
- Changing the OpenAPI contract or backend behavior.
- Persisting theme preference server-side (client localStorage only).
