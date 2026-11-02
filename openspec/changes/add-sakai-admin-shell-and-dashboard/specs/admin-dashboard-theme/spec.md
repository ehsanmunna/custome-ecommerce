# Spec Delta

## ADDED Requirements

### Requirement: CSS layer precedence

The application SHALL declare a CSS layer order in which PrimeNG styles precede Tailwind utilities, so a Tailwind utility can override a PrimeNG style without `!important`.

#### Scenario: Layer order is declared

- **WHEN** a developer inspects the global stylesheet
- **THEN** the layer order places the PrimeNG layer before the Tailwind utility layer

#### Scenario: Utility overrides a component style

- **WHEN** a Tailwind spacing or layout utility is applied to an element also styled by PrimeNG
- **THEN** the utility wins without an `!important` declaration

### Requirement: Bangla-capable typography

The application SHALL use a bundled font family with Bengali and Latin glyph coverage and SHALL apply it consistently to shell and PrimeNG content.

#### Scenario: Bangla text renders correctly

- **WHEN** the administrator selects Bangla
- **THEN** Bangla text renders in the bundled font without missing-glyph boxes

#### Scenario: English text keeps the same family

- **WHEN** the administrator selects English
- **THEN** English text renders in the same font family with consistent sizing and weight

## MODIFIED Requirements

### Requirement: Theme token system

The system SHALL use the PrimeNG preset as the single source of theme tokens, with Tailwind theme values mapped to the same primary, surface, text, border, success, warning, danger, and info tokens. Components SHALL not declare literal color values.

#### Scenario: Theme tokens defined

- **WHEN** a developer inspects the theme configuration
- **THEN** the system exposes named tokens for primary, danger, success, muted, surface, text, and border colors, plus spacing and typography scales

#### Scenario: Tokens used by Tailwind and PrimeNG

- **WHEN** a PrimeNG component or Tailwind utility renders
- **THEN** it resolves values from the shared theme token system

#### Scenario: No literal colors in components

- **WHEN** a developer inspects a shell or dashboard component
- **THEN** its template and styles contain no hexadecimal color values

#### Scenario: Client primary color drives the preset

- **WHEN** the client configuration supplies a primary color
- **THEN** the active PrimeNG preset and Tailwind primary utilities use that color

### Requirement: Themeable UI components

The system SHALL theme PrimeNG components through the active preset and SHALL use Tailwind utilities only for layout, spacing, and typography. It SHALL not restyle PrimeNG internal class names with Tailwind.

#### Scenario: Consistent primary actions

- **WHEN** a user views any admin screen
- **THEN** all primary buttons use the same preset token for background and text color

#### Scenario: Consistent danger actions

- **WHEN** a user views any admin screen
- **THEN** all danger buttons use the same preset token for background and text color

#### Scenario: Layout-only Tailwind usage

- **WHEN** a developer applies Tailwind classes to a screen
- **THEN** those classes control layout, spacing, or typography rather than restyling PrimeNG internals

### Requirement: Theme toggle

The system SHALL let an administrator switch between light and dark presentation. The selected mode SHALL apply immediately and persist per administrator, while client branding remains applied in both modes.

#### Scenario: Switch themes

- **WHEN** a user selects a different theme from the theme toggle
- **THEN** the dashboard immediately applies the selected theme without a page reload

#### Scenario: Persist theme preference

- **WHEN** a user selects a theme and reloads the dashboard
- **THEN** the dashboard restores the previously selected theme

#### Scenario: Branding survives the toggle

- **WHEN** the administrator switches between light and dark
- **THEN** the client name, logo, and primary color remain applied

### Requirement: PrimeNG integration

The system SHALL integrate PrimeNG 21 with the theme package compatible with that version, load PrimeIcons, and register a client-derived preset during application startup.

#### Scenario: PrimeNG components respect theme

- **WHEN** a PrimeNG component (button, card, table, dialog, chart) renders
- **THEN** it uses theme tokens consistent with the rest of the dashboard

#### Scenario: Preset registered at startup

- **WHEN** the application starts with a client primary color
- **THEN** PrimeNG renders with the preset built from that color before interactive content is shown

#### Scenario: Version compatibility

- **WHEN** the admin dependencies are installed
- **THEN** PrimeNG, its theme package, PrimeIcons, Angular, and Tailwind versions are mutually compatible and the production build succeeds
