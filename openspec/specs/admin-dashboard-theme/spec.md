# Admin Dashboard Theme Specification

## Purpose

Adds a themeable styling system to the admin dashboard so UI components share a consistent design language and support client-specific visual branding.

## Requirements

### Requirement: Theme token system
The system SHALL define a shared set of design tokens (colors, spacing, typography, borders, shadows) used consistently across the admin dashboard.

#### Scenario: Theme tokens defined
- **WHEN** a developer inspects the theme configuration
- **THEN** the system exposes named tokens for primary, danger, success, muted, surface, text, and border colors, plus spacing and typography scales

#### Scenario: Tokens used by Tailwind and PrimeNG
- **WHEN** a Tailwind utility class or PrimeNG component renders
- **THEN** it resolves values from the shared theme token system

### Requirement: Themeable UI components
The system SHALL render admin screens using Tailwind utility classes backed by theme tokens, replacing per-component inline styles.

#### Scenario: Consistent primary actions
- **WHEN** a user views any admin screen
- **THEN** all primary buttons use the same theme token for background and text color

#### Scenario: Consistent danger actions
- **WHEN** a user views any admin screen
- **THEN** all danger buttons use the same theme token for background and text color

### Requirement: Theme toggle
The system SHALL let a user switch between light, dark, and client-branded themes.

#### Scenario: Switch themes
- **WHEN** a user selects a different theme from the theme toggle
- **THEN** the dashboard immediately applies the selected theme without a page reload

#### Scenario: Persist theme preference
- **WHEN** a user selects a theme and reloads the dashboard
- **THEN** the dashboard restores the previously selected theme

### Requirement: PrimeNG integration
The system SHALL integrate PrimeNG UI components with the admin dashboard theme.

#### Scenario: PrimeNG components respect theme
- **WHEN** a PrimeNG component (button, card, table, dialog) renders
- **THEN** it uses theme tokens consistent with the rest of the dashboard
