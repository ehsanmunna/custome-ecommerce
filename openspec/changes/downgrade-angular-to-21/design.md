# Design

## Context

- `apps/admin` is an Angular 22.2.3 application (per `apps/admin/package.json`): `@angular/cli` and `@angular-devkit/build-angular` at `22.2.3`; `@angular/core`, `@angular/common`, `@angular/forms`, `@angular/router`, `@angular/platform-browser`, `@angular/platform-browser-dynamic`, `@angular/compiler` at `^22.2.3`; `typescript` at `^6.0.0`.
- `primeng ^22.1.4` is declared as a dependency but never imported or rendered in `apps/admin/src` (established by the `remove-tailwind-and-primeng` design).
- Build: `pnpm --filter admin build` runs `tsc`; real bundle/stylesheet compilation happens through the Angular CLI (`ng build` / `ng serve`, configured in `angular.json`). Tests run under vitest.
- Angular 21 supports TypeScript 5.6–5.8 and does not support TypeScript 6.

## Goals / Non-Goals

**Goals:**

- Downgrade all Angular framework packages and tooling in `apps/admin` to the Angular 21.x line.
- Keep `pnpm install`, typecheck, lint, test, `build` (`tsc`), and `ng build` passing on Angular 21.
- Preserve all admin behavior, routes, and theming; this is a framework-version change only.

**Non-Goals:**

- Changing admin UI, components, routes, theming, or behavior.
- Touching the API, database, storefront, or any non-admin package.
- Removing Tailwind/PostCSS or changing the styling toolchain.
- Changing the Node version.

## Decisions

### Target the Angular 21.x line

**Decision:** Downgrade `@angular/core`, `@angular/common`, `@angular/forms`, `@angular/router`, `@angular/platform-browser`, `@angular/platform-browser-dynamic`, and `@angular/compiler` to `^21.2.0`; downgrade `@angular/cli` and `@angular-devkit/build-angular` to a 21.2.x exact patch.

**Rationale:** Keeps all Angular packages on the same major line and mirrors the current exact-vs-caret pattern. The exact 21.x patch is confirmed at apply time.

### Downgrade TypeScript

**Decision:** Downgrade `typescript` from `^6.0.0` to `^5.8.x`.

**Rationale:** Angular 21 does not support TypeScript 6; TypeScript 5.8 is the latest supported 5.x line.

### Remove primeng (dependency fallout)

**Decision:** Remove `primeng ^22.1.4` from `apps/admin/package.json` dependencies.

**Rationale:** primeng 22 declares an Angular 22 peer dependency and is unused in `apps/admin/src`, so it cannot be installed alongside Angular 21 and nothing depends on it. Removing it keeps the downgrade installable and scoped.

**Alternative:** Downgrade primeng to a 21.x release. Rejected because primeng has no consumers, so keeping it adds maintenance for no current benefit.

## Risks / Trade-offs

- [Install failure from peer deps] → `pnpm install` may fail if a remaining package pins Angular 22. Mitigation: remove primeng; grep `@angular` peer requirements after the downgrade.
- [TypeScript breakage] → TypeScript 6-only syntax may not compile under TypeScript 5.8. Mitigation: run `pnpm --filter admin typecheck` after the TypeScript downgrade and fix any failures.
- [Builder/API surface change] → Angular 21 builders may differ slightly from 22. Mitigation: run `ng build` and `ng serve` and compare against the working 22.2.3 build.

## Migration Plan

1. Edit `apps/admin/package.json`: Angular packages → 21.x, `typescript` → `^5.8.x`, remove `primeng`.
2. Run `pnpm install` and confirm the `apps/admin` importer in `pnpm-lock.yaml` reflects Angular 21 and no primeng.
3. Run `pnpm --filter admin typecheck`, `lint`, `test`, `build`, and `exec ng build`; fix any failures.
4. Smoke-test admin routes via `pnpm --filter admin start:dev` to confirm rendering and behavior are unchanged.

Rollback: restore `apps/admin/package.json` and `pnpm-lock.yaml` from version control.
