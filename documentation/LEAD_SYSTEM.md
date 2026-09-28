# Leads, reports and secondary delivery

Required: name, company, email, interest, contact preference and consent. Phone is optional unless phone contact is selected; message is optional. All limits are checked server-side. The form rejects HTML markup, limits body size, uses a honeypot and limits requests per hashed IP. Identical normalized requests within 24 hours return an already-saved response without a second lead.

Only authenticated owners can list/view/filter leads, update status or export approved fields. CSV cells beginning with formula-like characters are escaped; XLSX writes strings. Exports are limited to 10,000 filtered rows. Owner audit records avoid lead message/contact contents.

## Reports

The scheduler queues yesterday at the configured timezone/hour. After outages it catches up from the most recent queued report, up to 31 dates per pass; jobs are processed seven per pass. Owners can queue a historical date or retry a failed report. A report includes the day's submissions, current new-status count, approved contact fields and timestamps. No lead is deleted.

SMTP provider acceptance is recorded as accepted, not guaranteed inbox delivery. Failures remain retryable, with exponential delay capped at a day. Stable message IDs help tracing; a crash after provider acceptance but before database update can produce a duplicate email on retry. Exactly-once external mail delivery is not promised.

## Google Sheets

Create a private spreadsheet with a dedicated tab named Leads. Share only with intended users/service account; do not allow anyone/domain-wide access. Enable Sheets and Drive metadata APIs. Runtime permission checks fail closed if sharing cannot be verified or is public/domain-wide.

Reserve row 1 for these columns: ID, submitted_at, name, company, email, phone, interest, message, contact, status. Do not manually sort/insert/delete rows in the dedicated synchronization tab. Use another tab/filter view for analysis. Each database lead reserves a stable row; retries PUT the same row with RAW values rather than append duplicates. Initial submission fields are synchronized; later owner status edits are not currently resynchronized. Database remains authoritative. Failed jobs retry hourly.

Real email/Sheets delivery is not verified without production configuration. Automated tests use failure and success fixtures, never actual recipient mailboxes.

## Retention

RETENTION_DAYS is an owner-visible review policy, not a silent deletion timer. There is no automatic lead purge. The owner must review requests and apply approved deletion procedures to the primary database, backups and secondary copies. A self-service deletion workflow is not implemented.

## Audit corrections

Phone numbers require 7–15 digits with standard separators; product interest is allowlisted. Owner list sorting supports newest, oldest and name. The server assigns source=/contact; existing rows retain source=unknown. Search/export use POST bodies with session CSRF so personal search terms are not placed in URLs. Exports now include source. Google row range expands to A:K; add Source as the final column in an existing dedicated Leads sheet. Privacy permission responses with further pages fail closed rather than assuming the sheet is private.
