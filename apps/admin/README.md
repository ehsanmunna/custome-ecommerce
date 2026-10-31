# Admin Dashboard

Angular admin dashboard for the custom e-commerce platform.

## Build

```bash
pnpm --filter admin build
```

## Typecheck

```bash
pnpm --filter admin typecheck
```

## Lint

```bash
pnpm --filter admin lint
```

## Development

The Angular application entry point is `apps/admin/src/main.ts`, which bootstraps the `AppComponent` using the Angular platform-browser renderer. The app configuration (providers, router) lives in `apps/admin/src/app.config.ts` and route definitions are in `apps/admin/src/app.routes.ts`.

The workspace build entry point remains at `apps/admin/src/index.ts` with `bootstrapAdmin(config)` for compatibility.

## Requirements

- Node.js >= 20.19.0
- pnpm >= 8.15.0
