# Design

## Context

The admin Angular application (`apps/admin`) is an Angular 21 standalone application using PrimeNG, Tailwind CSS, and RxJS. Components use standalone components with inline `template:` and `styles:` properties in their `@Component` decorators. 45 component files were audited; 43 have inline templates exceeding 10 lines, and 4 have inline styles exceeding 10 lines. Two components (`logout.component.ts`, `app.component.ts`) have inline templates under 10 lines and are exempt. No components currently use separate HTML or CSS files.

Prisma and TypeORM are used for data access, with Angular `HttpClient` for HTTP calls. The admin app follows NestJS conventions where applicable but is primarily an Angular frontend application.

## Goals / Non-Goals

**Goals:**
- All inline templates of 10 lines or more are extracted to `.component.html` files
- All inline styles of 10 lines or more are extracted to `.component.css` files
- All component behavior, UI rendering, and API contracts remain unchanged
- `ng build`, `lint`, and tests pass after migration

**Non-Goals:**
- Refactoring component logic or business logic
- Changing component selectors, inputs, outputs, or event emitters
- Restructuring component class code beyond removing `template:` and `styles:` properties
- Creating shared/partial HTML templates or CSS modules

## Decisions

### Template literal type assertion (`as unknown as T`)

**Decision:** Components that use `await this.http.get<...>()` use TypeScript type assertions (`as unknown as T`) to work around TypeScript's inability to infer types from awaited Observables.

**Rationale:** Angular 21 supports awaiting Observables at runtime, but TypeScript does not narrow the type from `Observable<T>` to `T` on `await`. Using `firstValueFrom`/`lastValueFrom` is prohibited by the project's observable-no-leaks rules. Type assertion preserves runtime behavior while satisfying type checking.

**Alternative considered:** `firstValueFrom()` / `lastValueFrom()` — rejected because the `observable-http-no-leaks` change explicitly prohibits these on HTTP calls.

### `takeUntilDestroyed(this.destroyRef)` for subscription teardown

**Decision:** All component `.subscribe()` calls use `takeUntilDestroyed(this.destroyRef)` as the final operator, with `destroyRef` injected via `inject(DestroyRef)` at field level.

**Rationale:** Angular 21 supports `takeUntilDestroyed()` with no arguments when injected in constructor or field initializer. This guarantees automatic unsubscription on component destruction without manual `Subscription` fields or `ngOnDestroy` unsubscribe code.

### File naming convention

**Decision:** Extracted HTML files use `<component-name>.component.html` and CSS files use `<component-name>.component.css`, co-located next to the `.ts` file.

**Rationale:** Matches Angular CLI conventions and the project's existing pattern for standalone components.

### No template/styles changes beyond relocation

**Decision:** HTML and CSS content is moved verbatim without reformatting, escaping changes, or structural modifications.

**Rationale:** Minimizes diff noise and eliminates the risk of introducing visual regressions.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Type assertion `as unknown as T` bypasses type checking | Keep types precise on Observable generic types; assertion is intentional and narrow |
| Missing `escape` characters after template extraction | Remove backtick escaping and `\${}` escaping; verify rendered output matches |
| Forgetting to update `template:` → `templateUrl:` reference | Grep verification ensures no inline templates ≥ 10 lines remain |
| Angular version requiring `styleUrls` instead of `styleUrl` | Angular 21 supports both; `styleUrl` is used for single style files |

## Migration Plan

1. Convert each component from `async/await` + `toPromise()`-style type assertions to `.subscribe()` with `takeUntilDestroyed`
2. Extract inline templates ≥ 10 lines to `.component.html` files
3. Extract inline styles ≥ 10 lines to `.component.css` files
4. Replace `template:` with `templateUrl: './<name>.component.html'`
5. Replace `styles:` with `styleUrl: './<name>.component.css'` for components with extracted styles
6. Run `ng build`, `lint`, and `typecheck` after each module group
7. Manual verification: navigate away mid-request on each screen to confirm no console errors

## Open Questions

None — all design decisions are resolved and captured above.
