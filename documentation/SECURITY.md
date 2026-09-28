# Security review

- Parameterized SQL for all user-input queries; transactional lead/job creation.
- Owner passwords bcrypt-hashed; session tokens random, stored only as hashes in DB.
- HttpOnly cookies; Secure/HSTS in production; SameSite configurable; absolute session expiry and logout invalidation.
- Exact origin checks on every state-changing request, JSON-only mutations and per-session CSRF token on authenticated mutations.
- Private owner endpoints enforce authentication independently of UI routes; public visitors cannot inspect either lead ID or exports.
- APIs are no-store; no lead/session data in localStorage. Static files expose only public/dist, not repository/data directories.
- Login and lead limits are database-backed. Configure proxy trust correctly and add edge anti-abuse controls before public deployment.
- CSP, no arbitrary remote image/script sources, safe textContent rendering and restricted download redirects.
- No credentials in public config. Google sharing checks reject public spreadsheets. GitHub tokens stay server-side.
- CSV formula neutralization and string-only XLSX exports.
- Audit logs record owner actions and IDs, not credentials or message bodies.

Automated coverage is not a penetration-test certificate. Production TLS/proxy/cookie behavior, infrastructure permissions, backups, real integrations and business retention policy still need target-environment acceptance.

Potential operational limits: single app instance, CPU work during bcrypt/export, max 10,000-row interactive exports, no owner MFA in this website version, no self-service password reset/deletion UI. Restrict owner exposure further with a trusted gateway if required by deployment policy.

The database contains personal contact data. Restrict access, encrypt underlying storage/backups using hosting controls and review access logs. Do not publish database copies.

No claim of complete security, compliance certification or guaranteed uptime is made.

## Release mirror audit

Actions have pinned dependencies, destination-only Contents: write and serialized runs. Source secret is scoped read-only; no checkout/execution of source repository code. Only approved installer names and bounded bytes are downloaded. PE signatures, lengths and hashes are verified before publishing. Same-name changed published bytes and unrelated tag collisions fail closed. Fixed GitHub hosts and API paths prevent arbitrary URL fetching; redirect requests do not carry the GitHub token. Public download streaming has a total deadline. This is transfer-integrity verification, not malware or signing verification.

Owner sort is allowlisted; POST search/export use CSRF and keep personal filters out of URLs. Dynamic JSON-LD gets a per-response CSP hash. Static JS revalidates and HTML is no-store to reduce mismatched cached releases.
