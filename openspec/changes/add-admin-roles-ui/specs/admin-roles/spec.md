# Spec Delta

## Purpose

Lets operators manage admin roles and their permission grants from the admin dashboard, so access can be adjusted without calling the API or reseeding the database. Implements Phase 3, item 26 (customers, staff and roles) from `plan.md`.

## ADDED Requirements

### Requirement: Admin roles list page layout
The admin roles page SHALL use the shared admin list page layout in this top-to-bottom block order: breadcrumb, header row with the title on the left and a "New role" action on the right, search and filter bar, then the roles table.

#### Scenario: Roles page blocks render in order
- **WHEN** an administrator opens the admin roles page
- **THEN** the page renders the breadcrumb first, then the header row, then the search and filter bar, then the roles table

#### Scenario: New role action sits in the header row
- **WHEN** the roles page renders for an administrator with `admin.roles.create`
- **THEN** the "New role" action appears at the right of the header row, above the search and filter bar

### Requirement: List and filter roles
The page SHALL list roles from `GET /admin/roles` with name, key, scope, system or custom type, and permission count, and SHALL support search by name or key plus a type filter of all, system, or custom.

#### Scenario: Roles load from the API
- **WHEN** an administrator opens the roles page
- **THEN** the table shows each role's name, key, scope, type, and permission count

#### Scenario: Search narrows the table
- **WHEN** the administrator types a role name or key into the search field
- **THEN** the table shows only roles whose name or key matches

#### Scenario: Type filter narrows the table
- **WHEN** the administrator selects system or custom in the type filter
- **THEN** the table shows only roles of that type

### Requirement: Create a role
The page SHALL let an administrator create a role with a unique key, name, optional description, store scope, and at least one permission selected from the permission catalog.

#### Scenario: Role created
- **WHEN** an administrator with `admin.roles.create` submits a valid key, name, and permission selection
- **THEN** the system creates the role, shows a success notification, closes the form, and refreshes the table with the new role

#### Scenario: Duplicate key rejected
- **WHEN** the submitted key already belongs to another role
- **THEN** the form stays open, shows the conflict error notification, and the table does not gain a row

#### Scenario: Invalid input blocked
- **WHEN** the key does not match the allowed pattern, the name is empty, or no permission is selected
- **THEN** the form shows field errors and does not submit

### Requirement: Edit a role
The page SHALL let an administrator edit a role's name, description, and permission grants, and SHALL keep the role key and scope read-only after creation.

#### Scenario: Permission grants updated
- **WHEN** an administrator with `admin.roles.update` saves a changed permission selection
- **THEN** the system replaces the role's grants, shows a success notification, and refreshes the permission count

#### Scenario: Key and scope cannot be edited
- **WHEN** an administrator opens an existing role for editing
- **THEN** the key and scope fields are displayed read-only

#### Scenario: Empty permission selection blocked
- **WHEN** the administrator removes every permission from an existing role
- **THEN** the form shows a validation error and does not submit

### Requirement: Delete a role
The page SHALL let an administrator delete a custom role after confirmation, SHALL not offer deletion for system roles, and SHALL report the API conflict when a role is assigned to admin users.

#### Scenario: Custom role deleted
- **WHEN** an administrator with `admin.roles.delete` confirms deletion of a custom role with no assigned users
- **THEN** the system deletes the role, shows a success notification, and removes the row

#### Scenario: System role has no delete action
- **WHEN** the table renders a system role
- **THEN** that row does not show a delete action

#### Scenario: In-use role cannot be deleted
- **WHEN** deletion returns a conflict because the role is assigned to admin users
- **THEN** the system keeps the role, shows the conflict error notification, and leaves the table unchanged

### Requirement: Grouped permission selection
The role form SHALL load the permission catalog from `GET /admin/permissions` and present each permission under its catalog group with the permission key visible.

#### Scenario: Permissions grouped by catalog group
- **WHEN** the role form opens
- **THEN** each permission appears under its catalog group and shows its key

#### Scenario: Current grants preselected
- **WHEN** the role form opens for an existing role
- **THEN** the permissions already granted to that role are preselected

#### Scenario: Catalog load failure is reported
- **WHEN** the permission catalog request fails
- **THEN** the form shows an error notification and does not render the permission list

### Requirement: Permission-gated role actions
The page SHALL show the New, Edit, and Delete controls only when the signed-in administrator holds the matching permission: `admin.roles.create`, `admin.roles.update`, and `admin.roles.delete`.

#### Scenario: Read-only administrator
- **WHEN** an administrator has `admin.roles.read` but none of the create, update, or delete permissions
- **THEN** the page lists roles and shows no New, Edit, or Delete controls

#### Scenario: Create-only administrator
- **WHEN** an administrator has `admin.roles.create` without the update or delete permissions
- **THEN** only the New role control is shown

### Requirement: Roles route and menu entry
The admin application SHALL expose the roles page at `/settings/roles`, include a Roles entry under Settings for owner and manager, and redirect staff and support administrators to the forbidden page.

#### Scenario: Owner and manager can open the page
- **WHEN** an owner or manager navigates to `/settings/roles`
- **THEN** the roles page renders inside the admin shell

#### Scenario: Other roles are denied
- **WHEN** a staff or support administrator navigates to `/settings/roles`
- **THEN** the application redirects to the forbidden page

#### Scenario: Menu entry follows settings
- **WHEN** an owner or manager views the navigation menu
- **THEN** a Roles entry appears under Settings and links to `/settings/roles`

### Requirement: Role save confirmation
After a role is created or updated successfully, the page SHALL close the form, show a success notification, and refresh the table. The success notification SHALL NOT depend on the refresh succeeding. On failure, the form SHALL stay open with the entered values and show an error notification.

#### Scenario: Successful save returns to the refreshed table
- **WHEN** an administrator saves a valid role
- **THEN** the form closes, a success notification appears, and the refreshed table shows the saved values

#### Scenario: Refresh failure does not hide the save confirmation
- **WHEN** the role is saved but the following table refresh fails
- **THEN** the success notification still appears and the refresh failure is reported separately

#### Scenario: Failed save keeps the form open
- **WHEN** the API rejects the create or update
- **THEN** the form stays open with the entered values and only an error notification appears
