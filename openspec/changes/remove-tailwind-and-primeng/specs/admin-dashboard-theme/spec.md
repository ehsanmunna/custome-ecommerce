# Spec Delta

## ADDED Requirements

### Requirement: Admin design tokens

The system SHALL define a shared set of design tokens (colors, spacing, typography, borders, shadows) used consistently across the admin dashboard.

#### Scenario: Theme tokens defined

- **WHEN** a developer inspects the theme configuration
- **THEN** the system exposes named tokens for primary, danger, success, muted, surface, text, and border colors, plus spacing and typography scales

#### Scenario: Tokens used by themed elements

- **WHEN** a shared admin CSS class or themed element renders
- **THEN** it resolves values from the shared theme token system

## MODIFIED Requirements

### Requirement: Themeable UI components

The system SHALL render admin screens using shared, reusable CSS classes backed by theme tokens in place of per-component inline styles.

#### Scenario: Consistent primary actions

- **WHEN** a user views any admin screen
- **THEN** all primary buttons use the same theme token for background and text color

#### Scenario: Consistent danger actions

- **WHEN** a user views any admin screen
- **THEN** all danger buttons use the same theme token for background and text color

## REMOVED Requirements

### Requirement: Theme token system

**Reason**: Replaced by the framework-neutral "Admin design tokens" requirement. The old requirement's scenario referenced Tailwind and PrimeNG, which this change removes; keeping it would describe rendering paths that no longer exist.

**Migration**: No user action is required. Token names and values are unchanged; only the requirement text and scenario name are updated.

### Requirement: PrimeNG integration

**Reason**: PrimeNG is declared as a dependency but never imported or rendered anywhere in `apps/admin/src`, so the requirement describes behavior the system does not provide and forces an unused dependency.

**Migration**: No user action is required. Admin screens continue to use Angular-native templates and shared CSS classes backed by theme tokens. Adopting a component library later requires a new capability change.
