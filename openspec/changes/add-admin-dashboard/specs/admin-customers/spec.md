# Spec Delta

## Purpose

Gives authorized store support staff a limited customer lookup view so they can resolve order questions without changing customer accounts.

## ADDED Requirements

### Requirement: Customer lookup
The dashboard SHALL let authorized administrators search and page through customer records using a store-scoped customer administration API.

#### Scenario: Find a customer
- **WHEN** an administrator with customer read permission searches by a supported customer identifier
- **THEN** the dashboard shows only matching customer records returned by the API

#### Scenario: No matching customer
- **WHEN** a search has no matching customer
- **THEN** the dashboard shows an empty result without exposing unrelated customer records

### Requirement: Customer support context
The dashboard SHALL let authorized administrators inspect a customer's permitted profile, addresses, and order history without exposing authentication secrets.

#### Scenario: Review customer context
- **WHEN** an administrator with customer read permission opens a customer record
- **THEN** the dashboard shows the permitted profile and order context returned by the API

#### Scenario: Customer access denied
- **WHEN** an administrator lacks customer read permission
- **THEN** customer search and detail data are unavailable

### Requirement: Read-only customer administration
The dashboard SHALL NOT expose customer account mutation or credential-management actions in the support lookup workflow.

#### Scenario: Attempt to change customer credentials
- **WHEN** an administrator uses the customer support view
- **THEN** no password, OTP, or credential mutation action is offered
