# Proposal

## Why

The admin dashboard (`apps/admin`) is an Angular 22.2.3 application. This change downgrades it to the Angular 21.x line so the admin framework targets Angular 21 instead of Angular 22. The downgrade is a framework-version change only; no admin behavior, route, or theme is intended to change.

## What Changes

- Downgrade `@angular/core`, `@angular/common`, `@angular/forms`, `@angular/router`, `@angular/platform-browser`, `@angular/platform-browser-dynamic`, and `@angular/compiler` from `^22.2.3` to `^21.2.0` in `apps/admin/package.json`.
- Downgrade `@angular/cli` and `@angular-devkit/build-angular` from `22.2.3` to a 21.2.x exact patch (confirm the latest 21.x patch at apply time).
- Downgrade `typescript` from `^6.0.0` to `^5.8.x` because Angular 21 does not support TypeScript 6.
- Remove `primeng ^22.1.4` from `apps/admin/package.json` dependencies: it is unused in `apps/admin/src` and declares an Angular 22 peer dependency, so it cannot coexist with Angular 21.
- Run `pnpm install` so `pnpm-lock.yaml` reflects Angular 21 and no primeng for the admin importer.
- Verify `pnpm --filter admin typecheck`, `lint`, `test`, `build`, and `exec ng build` all pass on Angular 21.

## Capabilities

### New Capabilities

- `admin-angular`: "Admin framework version" — the admin dashboard runs on the Angular 21.x line and its toolchain (CLI, build-angular, compiler, TypeScript) is compatible with Angular 21.

### Modified Capabilities

None. No existing capability spec pins the Angular version, so this capability is added new.

## Impact

- Affected code: `apps/admin/package.json`, `apps/admin/pnpm-lock.yaml` (via `pnpm install`).
- Affected dependencies: `@angular/*`, `@angular/cli`, `@angular-devkit/build-angular`, `@angular/compiler`, `typescript`, `primeng`.
- Affected specs: new `openspec/specs/admin-angular/spec.md` (this change's delta).
- Affected APIs: None.
- Affected docs: None.

## Non-goals

- Changing admin UI, components, routes, theming, or behavior.
- Touching the API, database, storefront, or any non-admin package.
- Removing Tailwind/PostCSS or changing the styling toolchain (unrelated to the Angular version).
- Changing the Node version or monorepo tooling.

## Assumptions

- Target the latest Angular 21.x patch release; pin exact versions at apply time.
- Angular 21 pairs with TypeScript 5.6–5.8, so `typescript ^6.0.0` is downgraded to `^5.8.x`.
- `primeng ^22.1.4` is unused and Angular-22-only, so it is removed as part of dependency fallout.
