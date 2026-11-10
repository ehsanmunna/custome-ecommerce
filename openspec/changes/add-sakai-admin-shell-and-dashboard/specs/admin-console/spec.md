# Spec Delta

## ADDED Requirements

### Requirement: Configuration-driven navigation menu

The admin application SHALL build its navigation from a typed configuration array, not from the route table or template literals. Each entry SHALL declare a translation key, icon, route, and permitted roles, and the menu SHALL show only entries permitted for the signed-in role.

#### Scenario: Role-permitted entries are shown

- **WHEN** an administrator signs in and the workspace shell renders
- **THEN** the menu shows exactly the configured entries whose permitted roles include the administrator's role

#### Scenario: Role-restricted entries are hidden

- **WHEN** an entry's permitted roles exclude the signed-in administrator's role
- **THEN** that entry is absent from the navigation and its route is not reachable through the shell

#### Scenario: Menu changes come from configuration

- **WHEN** an entry is added, relabeled, reordered, or given a different route in the menu configuration
- **THEN** the navigation reflects that change without edits to the shell template

### Requirement: Responsive workspace shell

The authenticated area SHALL render inside a workspace shell with a topbar and a collapsible sidebar. The desktop sidebar SHALL support static and overlay modes; on mobile it SHALL open as a masked overlay and close on route change or outside click.

#### Scenario: Desktop sidebar collapses in static mode

- **WHEN** the administrator activates the menu toggle in static mode on a desktop viewport
- **THEN** the sidebar collapses or expands without hiding the routed content

#### Scenario: Desktop overlay mode

- **WHEN** the layout is configured for overlay mode and the administrator activates the menu toggle
- **THEN** the sidebar opens above the content with a dismissible mask

#### Scenario: Mobile navigation

- **WHEN** the administrator opens the menu on a mobile viewport
- **THEN** the sidebar appears as an overlay, the page behind it is not scrollable, and choosing a route or clicking outside closes it

### Requirement: Topbar identity and controls

The topbar SHALL show the client logo or name, a sidebar toggle, a language switcher for English and Bangla, a dark-mode toggle, and a user menu containing the administrator's display name, role, profile link, and sign-out action.

#### Scenario: Language switcher updates the shell

- **WHEN** the administrator selects Bangla or English in the topbar
- **THEN** all visible shell and dashboard text changes language immediately without a page reload

#### Scenario: Dark-mode toggle applies immediately

- **WHEN** the administrator toggles dark mode in the topbar
- **THEN** the workspace switches between light and dark presentation without a page reload

#### Scenario: Sign out from the user menu

- **WHEN** the administrator chooses sign out
- **THEN** the session is ended, stored credentials are cleared, and the sign-in page is shown

#### Scenario: Logo fallback

- **WHEN** the client configuration has no logo
- **THEN** the topbar shows the configured client name instead of a broken image

### Requirement: Startup client branding

At startup the application SHALL load `client.config.json` before rendering the shell and SHALL apply the client name, logo, primary color, and default language. Missing optional values SHALL fall back to defaults without blocking startup.

#### Scenario: Branding is applied

- **WHEN** a valid client configuration is loaded
- **THEN** the shell shows the configured name and logo and the theme uses the configured primary color

#### Scenario: Missing or invalid configuration

- **WHEN** the client configuration is absent or invalid
- **THEN** the application starts with default branding and records a non-fatal warning

### Requirement: Per-user display preferences

The application SHALL persist dark mode and language per administrator, restore them when that administrator signs in, and use client defaults on unauthenticated screens.

#### Scenario: Preferences survive a reload

- **WHEN** an administrator changes dark mode or language and reloads the application
- **THEN** the same administrator's choices are restored after sign-in

#### Scenario: Separate administrators keep separate preferences

- **WHEN** two administrators use the same browser with different accounts
- **THEN** each account restores its own dark-mode and language choices

#### Scenario: Sign-in screen uses client defaults

- **WHEN** no administrator is signed in
- **THEN** the sign-in screen uses the client's default language and light or dark presentation rather than a previous user's preference

### Requirement: Session protection and 401 handling

The application SHALL attach the current access token to protected admin API requests, attempt one token refresh when a request is rejected with 401, retry the original request after a successful refresh, and clear the session and redirect to sign-in when refresh fails.

#### Scenario: Token attached to requests

- **WHEN** an authenticated administrator loads dashboard data
- **THEN** the request carries the current access token

#### Scenario: Expired token is refreshed

- **WHEN** a protected request returns 401 and a refresh token is available
- **THEN** the application refreshes once and retries the original request

#### Scenario: Refresh rejected

- **WHEN** the refresh request fails or no refresh token is available
- **THEN** the application clears the session and redirects to the sign-in page

#### Scenario: Unauthorized route

- **WHEN** an authenticated administrator navigates directly to a route their role does not permit
- **THEN** the application denies access and presents a safe authorized destination

### Requirement: Runtime localization

All admin UI text SHALL come from Transloco translation keys with English and Bangla catalogs. The application SHALL not render hardcoded user-facing strings in shell or dashboard templates.

#### Scenario: Both catalogs cover the shell and dashboard

- **WHEN** a developer inspects the English and Bangla catalogs
- **THEN** every shell, menu, dashboard, state, and status label has a key in both catalogs

#### Scenario: Missing translation falls back

- **WHEN** a key is missing from the active language catalog
- **THEN** the application shows the English text or the key rather than an empty label

## MODIFIED Requirements

### Requirement: Grouped and ordered menu presentation

The navigation menu SHALL present entries in the order declared by the menu configuration and SHALL group entries under their configured section headings when a section is declared. Entries without a section SHALL appear before grouped sections.

#### Scenario: Grouped sections render in declared order

- **WHEN** menu entries declare sections
- **THEN** the menu displays each section heading once, containing its entries in the declared configuration order

#### Scenario: Ungrouped entries render first

- **WHEN** some menu entries declare no section
- **THEN** those entries appear before the grouped sections

### Requirement: Authenticated shell with persistent menu

The admin application SHALL render authenticated routes inside a workspace shell that keeps the navigation menu available while the routed content is displayed. Authentication and sign-out routes SHALL render without the workspace shell.

#### Scenario: Workspace routes use the shell

- **WHEN** an authenticated administrator opens a protected admin route
- **THEN** the navigation menu and the routed content are shown together, and navigating to another protected route keeps the menu available

#### Scenario: Authentication routes stay outside the shell

- **WHEN** an administrator opens the sign-in or sign-out route
- **THEN** that route renders without the workspace navigation menu

## REMOVED Requirements

### Requirement: Route-derived navigation menu

**Reason**: The navigation source changes from the route table to a typed menu configuration so entries can carry role visibility, translation keys, icons, and deliberate ordering without adding menu metadata to every route.

**Migration**: Route paths and existing screens stay unchanged. The menu configuration becomes the source of labels, groups, order, and role visibility; routes that are not listed in it remain reachable by URL but are not shown in the sidebar.
