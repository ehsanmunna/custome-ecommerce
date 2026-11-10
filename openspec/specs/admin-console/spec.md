# admin-console Specification

## Purpose

Provides the authenticated admin workspace with a persistent navigation menu whose entries are derived from the application's route configuration, so operators can discover and move between management areas without a separately maintained link list.

## Requirements

### Requirement: Route-derived navigation menu

The admin application SHALL build its navigation menu from the configured route definitions rather than from a separate hand-maintained link list. The menu SHALL include one entry for each route marked as menu-visible and SHALL exclude routes that are not marked as menu-visible.

#### Scenario: Every menu-visible route appears once

- **WHEN** the admin workspace renders the navigation menu
- **THEN** each route marked menu-visible contributes exactly one entry labeled with its configured menu label

#### Scenario: Non-menu routes are excluded

- **WHEN** the route configuration contains routes without a menu label, such as redirects, detail routes with path parameters, login, and logout
- **THEN** those routes do not appear as menu entries

#### Scenario: Menu follows route configuration changes

- **WHEN** a menu-visible route is added, removed, relabeled, or moved to a different group in the route configuration
- **THEN** the menu reflects that change without edits to a separate menu definition

### Requirement: Grouped and ordered menu presentation

The navigation menu SHALL present entries in the order declared by the route configuration and SHALL group entries under their configured section headings when a section is declared. Entries without a section SHALL appear before grouped sections.

#### Scenario: Grouped sections render in declared order

- **WHEN** menu-visible routes declare sections
- **THEN** the menu displays each section heading once, containing its entries in the declared route order

#### Scenario: Ungrouped entries render first

- **WHEN** some menu-visible routes declare no section
- **THEN** those entries appear before the grouped sections

### Requirement: Active route indication

The navigation menu SHALL indicate the entry that corresponds to the current location, including when the current location is a nested or parameterized route beneath that entry. When no menu entry corresponds to the current location, the menu SHALL indicate no active entry.

#### Scenario: Exact route match

- **WHEN** the current location exactly matches a menu entry's route
- **THEN** that entry is indicated as active

#### Scenario: Nested route match

- **WHEN** the current location is beneath a menu entry's route, such as an order detail page under the orders route
- **THEN** the menu entry for that parent area is indicated as active

#### Scenario: No matching entry

- **WHEN** the current location does not correspond to any menu entry
- **THEN** no menu entry is indicated as active

### Requirement: Authenticated shell with persistent menu

The admin application SHALL render menu-visible, authenticated routes inside a workspace shell that keeps the navigation menu available while the routed content is displayed. Authentication and sign-out routes SHALL render without the workspace shell.

#### Scenario: Workspace routes use the shell

- **WHEN** an authenticated administrator opens a protected admin route
- **THEN** the navigation menu and the routed content are shown together, and navigating to another protected route keeps the menu available

#### Scenario: Authentication routes stay outside the shell

- **WHEN** an administrator opens the sign-in or sign-out route
- **THEN** that route renders without the workspace navigation menu
