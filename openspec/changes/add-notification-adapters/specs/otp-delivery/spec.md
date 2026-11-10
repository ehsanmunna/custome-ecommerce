## Purpose

Provides working, provider-backed SMS and email delivery for customer one-time authentication codes while keeping provider availability and delivery failures explicit.

## ADDED Requirements

### Requirement: Deliver OTP codes through configured providers
The system SHALL send email OTPs through Resend and SMS OTPs through Twilio to the normalized destination selected by the authentication request. The code MUST only be delivered through its requested channel, MUST NOT be returned in an API response, and MUST NOT appear in application logs.

#### Scenario: Deliver an email OTP
- **WHEN** an eligible customer requests an email OTP and Resend is configured
- **THEN** the system sends the code to the normalized email address through Resend and returns the existing accepted response only after provider acceptance

#### Scenario: Deliver an SMS OTP
- **WHEN** an eligible customer requests an SMS OTP and Twilio is configured
- **THEN** the system sends the code to the normalized phone number through Twilio and returns the existing accepted response only after provider acceptance

#### Scenario: Keep configured channels independent
- **WHEN** one provider channel is configured and the other is not
- **THEN** requests for the configured channel can be delivered while requests for the unconfigured channel fail explicitly without issuing an OTP

### Requirement: Fail safely when OTP delivery fails
The system MUST treat provider rejection, invalid provider responses, and transport timeouts as delivery failures. A failed delivery MUST invalidate the associated pending OTP and return the existing temporary service failure response. Provider credentials, authorization data, and OTP values MUST NOT be exposed in errors or logs.

#### Scenario: Provider rejects an OTP delivery
- **WHEN** Resend or Twilio rejects a send request
- **THEN** the system invalidates the pending OTP and reports a temporary delivery failure without exposing provider credentials or the OTP

#### Scenario: Provider request times out or returns an invalid response
- **WHEN** a provider request times out or its response cannot be interpreted as accepted
- **THEN** the system invalidates the pending OTP and reports a temporary delivery failure

#### Scenario: Provider credentials are incomplete
- **WHEN** only some required configuration values for a provider channel are supplied
- **THEN** API configuration validation rejects startup and identifies the missing configuration keys without printing credential values

### Requirement: Provide safe OTP message content
OTP email and SMS messages MUST contain the code and its configured validity period using concise Bangla and English wording. Message content MUST be purpose-neutral and MUST NOT include unrelated customer data.

#### Scenario: Send a bilingual message
- **WHEN** an OTP is delivered through either configured provider
- **THEN** the message identifies the one-time verification code and its validity period in both Bangla and English
