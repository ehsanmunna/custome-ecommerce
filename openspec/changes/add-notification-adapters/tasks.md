## 1. Provider Configuration

- [x] 1.1 Add optional Resend and Twilio environment settings with all-or-none validation for each channel.
- [x] 1.2 Expose provider settings and OTP validity through `AppConfigService`; include provider credentials in log redaction and redact them in configuration descriptions.
- [x] 1.3 Add configuration tests for absent, complete, and partial provider groups and for credential redaction.

## 2. OTP Provider Adapters

- [x] 2.1 Update the OTP delivery port to report readiness per channel and preserve fail-closed behavior when the selected channel is unavailable.
- [x] 2.2 Implement Resend email delivery with bounded HTTP requests, accepted-response validation, and concise bilingual OTP content including validity.
- [x] 2.3 Implement Twilio SMS delivery with bounded HTTP requests, accepted-response validation, and concise bilingual OTP content including validity.
- [x] 2.4 Add isolated adapter tests for request construction, accepted responses, provider rejection, malformed responses, and transport timeouts; no tests may send real messages.
- [x] 2.5 Register the provider-backed adapter in `AuthModule` and verify that delivery failures continue to invalidate pending OTPs and return the existing temporary failure response.

## 3. Documentation and Verification

- [x] 3.1 Document provider credentials, sender provisioning, independent channel configuration, and safe secret handling in `.env.example` and the API README.
- [x] 3.2 Run focused OTP adapter, auth, and configuration tests, then run the API lint, typecheck, and build checks.
