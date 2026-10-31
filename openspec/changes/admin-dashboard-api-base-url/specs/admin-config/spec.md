# Spec Delta

## Purpose

Configure the admin dashboard's API base URL so admin screens can reach the API when served from a different origin or port.

## ADDED Requirements

### Requirement: API base URL configuration
The system SHALL allow the admin dashboard's API base URL to be configured via environment variable with a sensible default.

#### Scenario: Default API base URL in development
- **WHEN** no `ADMIN_API_BASE_URL` environment variable is set
- **THEN** the admin dashboard uses `http://localhost:4000` as the API base URL

#### Scenario: Custom API base URL via environment variable
- **WHEN** `ADMIN_API_BASE_URL` is set to a valid URL (e.g., `https://api.example.com/v1`)
- **THEN** the admin dashboard sends all API requests to that URL

#### Scenario: API base URL used by all admin screens
- **WHEN** an admin screen (e.g., sales metrics, low-stock indicators) makes an API call
- **THEN** the request is sent to `<apiBaseUrl>/<endpoint>` (e.g., `<apiBaseUrl>/admin/analytics/overview`)
