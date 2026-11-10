# Proposal

## Why

The Angular admin dashboard has inline HTML templates and CSS styles scattered across 45 component `.ts` files. Large inline templates make components hard to read, test, and maintain, and they prevent template reuse and separate CSS linting. Consolidating HTML and CSS into dedicated files improves readability, enables IDE support for HTML/CSS validation, and keeps component classes focused on logic.

## What Changes

- Convert all component `.ts` files with inline templates of 10 lines or more to use `templateUrl` pointing to a co-located `.component.html` file
- Convert all component `.ts` files with inline styles of 10 lines or more to use `styleUrl` pointing to a co-located `.component.css` file
- Remove all escaping (e.g., escaped backticks, `\${}`) from extracted HTML
- Move HTML content exactly as-is into `.component.html` files; move CSS exactly as-is into `.component.css` files
- Do not change imports, selectors, inputs/outputs, component logic, or UI behavior

## Capabilities

### New Capabilities

None - this change does not introduce new system behavior.

### Modified Capabilities

None - this change does not alter spec-level behavior requirements.

## Impact

- Modified files: 45 component `.ts` files under `apps/admin/src/`
- New files: Approximately 38 `.component.html` files and 4 `.component.css` files co-located with their components
- Components with inline templates under 10 lines (e.g., `logout.component.ts`, `app.component.ts`) remain unchanged
- Components with no inline styles keep their existing styling approach

## Non-goals

- Do not change component logic, inputs/outputs, selectors, or route contracts
- Do not modify HTML markup structure or CSS beyond moving it to separate files
- Do not create new capabilities or modify existing spec requirements
- Do not modify test files unless they directly reference inline template structure
