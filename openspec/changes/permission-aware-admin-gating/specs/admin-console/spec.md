# Spec Delta

## ADDED Requirements

### Requirement: Permission-derived route access

The console SHALL authorize each protected route by the permission declared for that route, independently of the administrator's role name, and SHALL allow access only when the current permission snapshot satisfies that declaration.

#### Scenario: Authorized route access

- **WHEN** an administrator holds the permission declared for a route
- **THEN** the console opens that route and its navigation entry is available

#### Scenario: Missing permission

- **WHEN** an administrator navigates directly to a route whose declared permission they lack
- **THEN** the console denies access and redirects to a safe authorized destination

#### Scenario: Custom role can enter

- **WHEN** an administrator has a custom role whose grants include the declared permission for an area
- **THEN** that administrator can open the area without being recognized by a baseline role key

#### Scenario: Any-of route requirement

- **WHEN** a route declares several acceptable permissions, such as the dashboard requiring at least one dashboard data permission
- **THEN** holding any one of them permits access and holding none denies it

#### Scenario: Unauthenticated access

- **WHEN** an unauthenticated visitor requests a protected route
- **THEN** the console redirects to sign-in with the requested location preserved

### Requirement: Permission-filtered navigation

The navigation SHALL render only entries whose declared permission the administrator holds, SHALL omit a group when all of its children are hidden, and SHALL keep each entry's permission identical to the permission of the route it links to.

#### Scenario: Only permitted entries render

- **WHEN** the shell renders the navigation for the current permission snapshot
- **THEN** each visible entry corresponds to a permission the administrator holds and each other entry is absent

#### Scenario: Empty group is omitted

- **WHEN** an administrator holds no permission for any child of a navigation group
- **THEN** the group container and its heading do not appear

#### Scenario: Menu and route agree

- **WHEN** navigation entries are compared with the routes they link to
- **THEN** every entry declares the same permission requirement as its route

#### Scenario: Navigation follows a refreshed snapshot

- **WHEN** the permission snapshot changes during the session
- **THEN** the navigation updates without a page reload

### Requirement: Permission-gated page actions

Admin pages SHALL render create, edit, delete, status-change, stock-adjustment, and upload actions only when the administrator holds the permission required by the corresponding API operation.

#### Scenario: Read-only administrator

- **WHEN** an administrator holds a read permission for an area but not its write permissions
- **THEN** the page shows its data without create, edit, delete, or status actions

#### Scenario: Authorized actions appear

- **WHEN** an administrator holds a write permission for an action
- **THEN** the action is available and succeeds through the API

#### Scenario: Client and server disagree

- **WHEN** an action is attempted without the required permission, including from a stale snapshot or a crafted request
- **THEN** the API rejects it and the console reports that the operation was not completed rather than showing success

#### Scenario: List layout stays consistent

- **WHEN** an affected list page renders in any permission state
- **THEN** its blocks remain ordered as breadcrumb, header row with title and optional "New" action, search and filter bar, then table

### Requirement: Permission snapshot refresh

The console SHALL refresh the signed-in administrator's identity and permissions from the admin identity endpoint when the authenticated shell starts and after an authorization denial, so role changes apply without a new sign-in.

#### Scenario: New grant becomes usable

- **WHEN** the administrator's role gains a permission and the snapshot refreshes
- **THEN** the corresponding route, navigation entry, and actions become available without signing in again

#### Scenario: Removed grant stops access

- **WHEN** the administrator's role loses a permission and the snapshot refreshes
- **THEN** the corresponding navigation entry and actions disappear and direct navigation is denied

#### Scenario: Refresh failure does not expand access

- **WHEN** the identity refresh fails without ending the session
- **THEN** the last known snapshot remains in effect, no new permission is granted, and the failure is reported

#### Scenario: Own role edited

- **WHEN** an administrator saves a change to a role that includes their own role
- **THEN** the console refreshes its permission snapshot after the save completes

### Requirement: System role and account protection

The console SHALL keep system-role keys and names immutable, SHALL allow grant edits only to administrators with role-update permission, and SHALL prevent an administrator from disabling their own account.

#### Scenario: System role identity is protected

- **WHEN** an administrator attempts to delete or rename a system role
- **THEN** the action is unavailable or rejected and no change is saved

#### Scenario: System role grants remain editable

- **WHEN** an administrator holds role-update permission and changes a system role's grants
- **THEN** the change is saved and displayed

#### Scenario: Self-disable is blocked

- **WHEN** an administrator attempts to disable their own account
- **THEN** the action is unavailable or rejected and the account remains active

#### Scenario: API rejects bypass attempts

- **WHEN** a protected role or account operation is sent directly to the API without the required state
- **THEN** the API rejects it independently of the console
