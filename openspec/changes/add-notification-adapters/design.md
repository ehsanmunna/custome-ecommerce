## Context

See proposal.md for motivation and specs/otp-delivery/spec.md for observable behavior. The API currently injects `OtpDeliveryAdapter` into `AuthService`; the interface exposes one global `configured` flag, and `AuthModule` binds it to `UnavailableOtpDeliveryAdapter`. OTP issuance checks readiness before looking up the customer, stores only a keyed hash, invalidates a pending code when sending fails, and returns `503` for delivery failures. Runtime settings are validated by `env.schema.ts` and exposed by `AppConfigService`, whose `secretValues` and `describe()` protect operational logs.

The implementation is part of plan.md item 19, selecting SMS and email notification providers before implementation. The current auth adapter has no locale parameter, and the existing app configuration supports optional provider groups that become usable only when complete.

## Goals / Non-Goals

**Goals:**
- Provide independent readiness and delivery for email and SMS through Resend and Twilio.
- Preserve current OTP persistence, rate limiting, privacy behavior, and HTTP response contract.
- Bound provider calls and sanitize provider failures before they reach auth error handling or logs.
- Keep automated tests isolated from real provider accounts and messages.

**Non-Goals:**
- Add notification orchestration, durable queues, retries, provider failover, or delivery history.
- Add provider settings to the database, admin screens, or new API routes.
- Change OTP issuance, verification, expiry, or account eligibility policy.

## Decisions

1. **Make adapter readiness channel-specific.** Replace the global readiness check with a channel-aware query (for example, `isConfigured(channel)`) and check it before customer lookup or OTP creation. The Resend and Twilio settings remain independent so missing configuration for one does not disable the other. This is preferred over requiring both provider groups at startup because deployments may enable channels independently; when neither group is configured, the API continues to start and OTP requests fail closed as they do today.

2. **Validate optional credential groups as all-or-none.** Resend requires `RESEND_API_KEY` and `RESEND_FROM_EMAIL`. Twilio requires `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER`. Supplying only part of either group is a startup configuration error; omitting the whole group leaves only that channel unavailable. Expose typed settings through `AppConfigService`, add provider secrets to `secretValues`, redact credentials in `describe()`, and document setup in `.env.example` and the API README. This follows the existing optional R2 settings pattern and avoids silently treating a typo or incomplete deployment as an intentional disabled channel.

3. **Use direct HTTPS requests with the built-in fetch API.** Send email through Resend's email API and SMS through Twilio's Messages API; do not add provider SDK dependencies. Inject `fetch` at the adapter boundary for deterministic unit tests. Apply a fixed, bounded request timeout and do not retry: an uncertain send outcome must follow the current failure path rather than creating duplicates. Treat non-2xx responses, malformed success responses, and transport/timeout errors as failure. Do not include provider response bodies, authorization headers, recipient data, or OTPs in thrown messages.

4. **Keep failure and privacy behavior in the existing auth flow.** Adapter errors stay generic and are wrapped by the current `requestCustomerOtp` behavior, which invalidates the pending OTP and returns a temporary `503`. The early channel-readiness check remains before customer lookup. Existing accepted responses for unknown, ineligible, or rate-limited destinations remain unchanged. Never return provider identifiers or the OTP from the auth API.

5. **Build message text in the provider adapter from shared OTP settings.** Use concise, purpose-neutral Bangla and English wording and include the validity period from `AUTH_OTP_TTL_SECONDS`. Do not add locale-specific templates or persist message content; the current port has no locale input and this change only needs a safe customer-facing OTP message.

6. **Test without contacting providers.** Unit tests inject fake fetch implementations and cover request URLs, method, headers/body encoding, success-response validation, rejection, timeout, and malformed responses for both providers. Configuration tests cover omitted, complete, and partial provider groups, as well as secret redaction. Auth service tests cover readiness independently per channel and verify that failed sends invalidate the pending OTP. No test sends a real email or SMS.

## Risks / Trade-offs

- [Provider credentials may be valid while sender identities are not provisioned or verified] → Document Resend sender-domain verification and Twilio sender-number provisioning; provider rejection remains a generic temporary failure.
- [A provider may accept a message but its response may be lost] → Use a bounded timeout and no automatic retry; invalidate the OTP on the existing failure path so the system does not claim delivery.
- [Bilingual SMS text may use more than one SMS segment] → Keep copy concise and purpose-neutral; no template-management or localization framework is introduced.
- [A provider outage prevents OTP authentication on that channel] → Keep other channels independently usable and preserve the explicit `503` rather than reporting false acceptance.
- [Provider response data may contain sensitive values] → Discard response bodies for error handling and keep adapter errors generic; use application-level secret redaction for configured credentials.

## Migration Plan

No database migration is required. Deploy the API with whichever provider credential group is ready, verify sender provisioning and a real delivery in a controlled environment, then enable customer OTP use for that channel. Configure the other provider independently when it is ready. To roll back, redeploy the previous API version and remove the new provider settings; OTP requests return the existing `503` while the unavailable adapter is active.
