# E-VMS automated trial licensing

## Flow

1. The applicant submits the trial form. The server stores a pending request and sends a single-use email verification token through the configured SMTP provider.
2. Provider acceptance is required. A failed provider call is recorded as a failed delivery and does not claim that a mailbox received the message.
3. The verification endpoint hashes the token, enforces its expiry and attempt limit, and prepares at most one canonical trial identity for the normalized email.
4. The server creates a signed `e-vms-license` version 2 artifact and a separate human activation code. The code is encrypted for retry recovery and only its domain-separated hash appears in the signed artifact and core registry.
5. The website server registers that exact ID, artifact checksum, policy and entitlements through the authenticated `licenses:register` service scope. The request UUID is the signed idempotency key. The public browser never receives the service credential.
6. The website marks the request issued only after core registration and email-provider acceptance. Core failure remains `CORE_REGISTRATION_FAILED`; delivery failure remains `DELIVERY_FAILED` and can be retried without creating another licence.
7. The email includes the activation code and certificate. An opaque, expiring token permits at most three artifact downloads, and download is unavailable until core registration is confirmed.

## Required production configuration

- `TRIAL_DURATION_DAYS`
- `TRIAL_MAX_CAMERAS`
- `TRIAL_MAX_AI_CAMERAS`
- `TRIAL_MAX_ADMIN_USERS`
- `TRIAL_MAX_USERS`
- `TRIAL_MAX_SITES`
- `TRIAL_FEATURES`
- `TRIAL_SIGNING_PRIVATE_KEY_PATH`
- `TRIAL_ISSUER_KEY_ID`
- `TRIAL_SECRET_ENCRYPTION_KEY` (64 hexadecimal characters, secret manager only)
- `CORE_LICENSE_REGISTRATION_URL` (HTTPS in production)
- `CORE_LICENSE_SERVICE_TOKEN` (display-once E-VMS service token with only `licenses:register`)
- `CORE_LICENSE_TIMEOUT_MS`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`

Optional policy values are `TRIAL_VERIFICATION_MINUTES`, `TRIAL_DOWNLOAD_HOURS` and `TRIAL_RESEND_SECONDS`.

The private signing key is read only by the website server. Deploy its corresponding public key to the E-VMS licence verifier through the controlled core release process. Never copy the private key into source control, public website files, browser code, a desktop installer, email, logs or backups without an approved encrypted-secret process.

## Acceptance status

Automated tests cover verified issuance, encrypted recovery, authenticated/idempotent core registration, exact cross-database identity/checksum/entitlement matching, activation, service restart recognition, expiry transition, wrong-code lockout, duplicate prevention, provider failure with redelivery, download limits and database rollback. The full chain was verified locally with synthetic data and cleanup. Real production SMTP delivery, DNS reputation, mailbox receipt, production key custody and deployed infrastructure remain **NOT VERIFIED** until tested in the target environment.
