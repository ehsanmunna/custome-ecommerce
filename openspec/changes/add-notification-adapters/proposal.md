## Why

Customer OTP authentication already creates and protects one-time codes, but its delivery port is wired to an unavailable adapter. Integrating the selected Resend email and Twilio SMS providers makes both existing OTP channels usable while preserving explicit delivery failures.

## What Changes

- Add Resend email and Twilio SMS implementations for the existing OTP delivery interface.
- Configure each channel from validated environment settings and fail requests when the selected channel is not configured or its provider cannot deliver.
- Preserve hashed-only OTP storage, invalidation on delivery failure, and the existing authentication API contract.
- Document provider setup and test delivery behavior without sending real messages in automated tests.

## Non-goals

- General-purpose notification orchestration, order-status messages, or notification templates beyond OTP delivery.
- Admin notification history or test-notification endpoints.
- Database schema changes, delivery queues, retries, or storing provider credentials in the database.

## Capabilities

### New Capabilities
- `otp-delivery`: Deliver customer authentication codes over email through Resend and SMS through Twilio.

### Modified Capabilities

## Impact

- `apps/api`: OTP delivery providers, provider configuration, channel-specific readiness, and tests.
- `.env.example` and API documentation: provider configuration and operational setup.
- Existing OTP auth behavior and request/response contracts remain unchanged; no database migration or new API endpoint is required.
