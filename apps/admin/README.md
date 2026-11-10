# Admin Dashboard

Angular admin dashboard for the custom e-commerce platform. Built with Angular 21, PrimeNG 21, Tailwind CSS v4, and Transloco.

## Tech Stack

- Angular 21.2 (standalone components, OnPush)
- PrimeNG 21.1 + `@primeuix/themes` + PrimeIcons
- Tailwind CSS v4 + `tailwindcss-primeui`
- Transloco 8 (i18n: English `en`, Bangla `bn`)
- Angular CDK 21

## Build

```bash
# TypeScript package build (tsc)
pnpm --filter admin build

# Angular application build (compiles templates and stylesheets)
pnpm --filter admin build:app

# Start dev server
pnpm --filter admin start:dev
```

## Typecheck

```bash
pnpm --filter admin typecheck
```

## Lint

```bash
pnpm --filter admin lint
```

## Test

```bash
pnpm --filter admin test
```

## Client Configuration

The app loads `/assets/client.config.json` at startup via an app initializer. Missing or invalid values fall back to defaults without blocking startup.

Shape (`apps/admin/src/assets/client.config.json`):

```json
{
  "name": "Custom Commerce",
  "logo": "",
  "primaryColor": "#2563eb",
  "defaultLanguage": "en"
}
```

- `name`: Client display name shown in the topbar (falls back to "Admin")
- `logo`: Optional logo URL; when absent, the client name is shown instead
- `primaryColor`: Hex color used to generate the PrimeNG theme preset
- `defaultLanguage`: Default UI language (`en` or `bn`)

## Internationalization

Translation catalogs live in `apps/admin/src/assets/i18n/`:

- `en.json` — English catalog
- `bn.json` — Bangla catalog

All shell, menu, dashboard, status, and common UI text is rendered through Transloco keys. No hardcoded user-facing strings appear in shell or dashboard templates.

## Theme and Styling

CSS layer order declared in `apps/admin/src/styles.css`:

```css
@layer theme, base, primeng, components, utilities;
```

PrimeNG is configured with `cssLayer: { name: 'primeng', order: 'theme, base, primeng, components, utilities' }` and `darkModeSelector: '.app-dark'`. This places PrimeNG before Tailwind utilities, so layout utilities can override component styles without `!important`.

Chart colors and component theme tokens are read at runtime from PrimeNG CSS variables (`--p-primary-500`, `--p-surface-500`, etc.) — no hex values appear in component code.

## Verification Commands

```bash
# Full verification pipeline
pnpm --filter admin typecheck
pnpm --filter admin lint
pnpm --filter admin test
pnpm --filter admin exec ng build
```

## Routes

- `/login` — Sign in (outside workspace shell)
- `/logout` — Sign out (outside workspace shell)
- `/forbidden` — Access denied (outside workspace shell)
- `/dashboard` — Dashboard overview (workspace shell)
- `/customers` — Customers stub (workspace shell)
- `/settings` — Settings landing page (workspace shell)
- `/products`, `/categories`, `/brands`, `/attributes`, `/media` — Catalog (workspace shell)
- `/inventory/*` — Inventory management (workspace shell)
- `/orders/*` — Order management (workspace shell)
- `/returns/*` — Returns management (workspace shell)
- `/settings/shipping-zones` — Shipping zones (workspace shell)
- `/settings/coupons` — Coupons (workspace shell)
- `/cms/pages` — CMS pages (workspace shell)
- `/cms/banners` — CMS banners (workspace shell)
- `/reports/sales` — Sales report (workspace shell)
- `/reports/low-stock` — Low-stock report (workspace shell)
- `/profile` — User profile (workspace shell)

## Requirements

- Node.js >= 20.19.0
- pnpm >= 8.15.0
