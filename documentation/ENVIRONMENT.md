# Configuration

Copy `.env.example` locally; use provider-managed secrets in production. Only the API origin is exposed in runtime JavaScript.

| Variable | Meaning |
| --- | --- |
| NODE_ENV | production enables Secure cookies, HSTS and HTTPS URL validation |
| PORT / HOST | listener; platform PORT is respected; cloud HOST normally 0.0.0.0 |
| DATABASE_PATH | private SQLite file on persistent storage, not public web root |
| PUBLIC_SITE_URL | canonical public origin; HTTPS in production |
| API_BASE_URL | empty for same origin, otherwise absolute API origin |
| CORS_ORIGINS | comma-separated exact trusted frontend origins; no wildcard |
| COOKIE_SAME_SITE | lax default; none only for HTTPS cross-site hosting |
| TRUST_PROXY | exact trusted reverse-proxy hop count; default 0; do not guess |
| SESSION_HOURS | 1–24, default 8; absolute expiry, no indefinite refresh |
| GITHUB_RELEASE_REPO | owner/repository; defaults to Evisionindia/EVMS-website (the public mirror) |
| GITHUB_PRIVATE_RELEASES | true enables allowlisted server-streamed private installers |
| GITHUB_TOKEN | optional read-only release access; server only |
| REPORT_TIMEZONE / REPORT_HOUR | IANA timezone and local hour 0–23 |
| SCHEDULER_ENABLED | true enables minute-based scheduling and retries |
| SMTP_HOST / SMTP_PORT / SMTP_SECURE | provider SMTP transport |
| SMTP_USER / SMTP_PASSWORD | provider authentication |
| EMAIL_FROM | verified sender address |
| LEAD_REPORT_RECIPIENT | default sales1@evisionindia.com |
| GOOGLE_SHEETS_ID | private dedicated spreadsheet ID |
| GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY | server-side service account; escaped newlines accepted |
| RETENTION_DAYS | retention review period exposed to owner; no automatic destructive purge |
| OWNER_BOOTSTRAP_PASSWORD | process-only owner provisioning input; not normal server config |
| BROWSER_EXECUTABLE | optional local browser path for tests only |

For split static hosting, replace `dist/runtime-config.js` at deployment with `window.EVMS_CONFIG={apiBase:"https://your-api-host"};`. The API origin is not a secret. Production API cookies need compatible domains and browser third-party cookie policies; prefer same-origin or same-site subdomains.

## Actions-only release synchronization

SOURCE_RELEASE_TOKEN: repository Actions secret, Contents: read on the source repository only (needed for private source access). MIRROR_TOKEN: workflow environment populated from github.token, Contents: write on the website repository. GITHUB_REPOSITORY: supplied by Actions and checked against the approved mirror. Never place these values in public runtime-config.js. Runtime GITHUB_TOKEN, if used, needs only mirror Contents: read. Optional immediate repository_dispatch requires separately scoped destination authorization; hourly polling needs no core changes.

No WebSocket is used by this website, so no WebSocket origin variable is required. Company data is in content/company.json; release policy is in content/releases.json.
