# Spec Delta

## Purpose

Defines a consistent, leak-free Observable HTTP pattern for the Angular admin dashboard, ensuring every HTTP call returns an Observable, services never subscribe, and all component subscriptions are cleaned up on destroy.

## ADDED Requirements

### Requirement: Services return Observables
The system SHALL ensure every admin service method that performs an HTTP call returns `Observable<T>` and never calls `.subscribe()`, `.toPromise()`, `firstValueFrom()`, or `lastValueFrom()`.

#### Scenario: Service methods return Observable
- **WHEN** an admin service method makes an HTTP call
- **THEN** it returns an `Observable<T>` without subscribing internally

### Requirement: Components clean up subscriptions
The system SHALL ensure every component `.subscribe()` call on an HTTP or value stream is cleaned up on component destroy via `takeUntilDestroyed(this.destroyRef)` as the last operator before `subscribe`.

#### Scenario: Component subscription teardown
- **WHEN** a component subscribes to an HTTP Observable
- **THEN** the subscription is automatically cleaned up when the component is destroyed

### Requirement: No async/await or Promise conversion on HTTP
The system SHALL ensure no admin code uses `async/await`, `.then()`, `.catch()`, `toPromise()`, `firstValueFrom()`, or `lastValueFrom()` on HTTP calls or streams.

#### Scenario: No Promise wrapping on HTTP calls
- **WHEN** admin code calls `this.http.get()`, `this.http.post()`, `this.http.patch()`, or `this.http.delete()`
- **THEN** the result is not converted to a Promise via `await`, `.then()`, `toPromise()`, `firstValueFrom()`, or `lastValueFrom()`

### Requirement: No nested subscribes
The system SHALL ensure no `.subscribe()` call is nested inside another `.subscribe()` callback. Dependent calls SHALL use `switchMap`, parallel one-shot calls SHALL use `forkJoin`, ordered writes SHALL use `concatMap`, and submit buttons SHALL use `exhaustMap`.

#### Scenario: No nested subscription callbacks
- **WHEN** an HTTP call depends on the result of another HTTP call
- **THEN** `switchMap` is used instead of subscribing inside a subscribe callback

### Requirement: Error handling on all subscribes
The system SHALL ensure every component `.subscribe()` call provides an `error` handler or uses `catchError` inside the stream. Global HTTP errors (401, 403, 5xx) remain handled by the HTTP interceptor.

#### Scenario: Subscribe has error handler
- **WHEN** a component subscribes to an HTTP Observable
- **THEN** an `error` callback is provided or `catchError` is applied inside the stream

### Requirement: Loading state with finalize
The system SHALL ensure every HTTP request sets loading state to `true` before the request and `false` in `finalize()`, so loaders always stop including on error.

#### Scenario: Loading state resets on error
- **WHEN** an HTTP request fails
- **THEN** the loading state is set to `false` via `finalize()`

### Requirement: List reload inside same stream
The system SHALL ensure that after a successful create/update/delete, the list is reloaded inside the same stream via `switchMap`, not via a separate nested subscribe or separate await call.

#### Scenario: List reloads in same stream after create
- **WHEN** a create HTTP call succeeds
- **THEN** the list is reloaded via `switchMap` within the same Observable stream
