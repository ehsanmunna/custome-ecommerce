# Spec Delta

## ADDED Requirements

### Requirement: Admin Angular version

The system SHALL run the admin dashboard on Angular 21.x.

#### Scenario: Angular framework on 21.x

- **WHEN** a developer inspects `apps/admin/package.json`
- **THEN** all `@angular/*` packages, `@angular/cli`, `@angular-devkit/build-angular`, and `@angular/compiler` resolve to the Angular 21.x line
- **AND** `pnpm --filter admin install`, `typecheck`, `lint`, `test`, and `ng build` succeed

## MODIFIED Requirements

None.

## REMOVED Requirements

None.
