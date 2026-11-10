# Tasks

## 1. Downgrade Angular packages to 21.x

- [x] 1.1 In `apps/admin/package.json`, set `@angular/core`, `@angular/common`, `@angular/forms`, `@angular/router`, `@angular/platform-browser`, `@angular/platform-browser-dynamic`, and `@angular/compiler` to `^21.2.0`.
- [x] 1.2 Set `@angular/cli` and `@angular-devkit/build-angular` to a 21.2.x exact patch (confirm the latest 21.x patch at apply time).
- [x] 1.3 Confirm no `@angular/*` package in `apps/admin/package.json` remains on 22.x.

## 2. Downgrade TypeScript and remove incompatible dependencies

- [x] 2.1 Set `typescript` from `^6.0.0` to `^5.8.x` in `apps/admin/package.json` devDependencies.
- [x] 2.2 Remove `primeng ^22.1.4` from `apps/admin/package.json` dependencies (unused; Angular-22-only peer dep).
- [x] 2.3 Run `pnpm install` and verify `pnpm-lock.yaml` no longer lists Angular 22 or primeng for the admin importer.

## 3. Verify the admin builds and tests pass

- [x] 3.1 Run `pnpm --filter admin typecheck`; fix any TypeScript 6 → 5.8 incompatibilities.
- [x] 3.2 Run `pnpm --filter admin lint` and `pnpm --filter admin test`; verify both pass.
- [x] 3.3 Run `pnpm --filter admin build` (`tsc`) and `pnpm --filter admin exec ng build` (Angular CLI); verify both succeed.

## 4. Smoke-test admin runtime

- [x] 4.1 Start `pnpm --filter admin start:dev` and walk the routes in `apps/admin/src/app.routes.ts`; verify screens render without missing styles and behavior is unchanged.
- [x] 4.2 Confirm theming (light/dark/client-branded) and `localStorage` persistence still work.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
