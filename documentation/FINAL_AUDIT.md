# EVMS public website — final audit and remediation

Date: 28 September 2026. Scope: standalone `Evisionindia/EVMS-website` checkout and its release mirror. Core v1.1.1 source revision: `9f07cc0`. Website source and release were pushed; cloud deployment was not performed.

## Outcome
Implemented a product-specific multi-page presentation, repaired unbounded dynamic requests, centralized company/capability data, hardened lead/owner flows, and implemented automatic release mirroring. Local tests and the verified v1.1.1 mirror support these results; external production hosting remains unverified.

## Issues, root causes and fixes
| Finding | Root cause and affected code | Repair | Evidence / remaining risk |
|---|---|---|---|
| Product/release loading could persist | public/app.js had fetch without deadlines; no schema/empty/retry handling | shared 10-second loader, explicit states, safe initial/no-JS copy | browser injected success, empty, invalid JSON/schema, HTTP errors, dropped request and timeout |
| Downloads tied to core | config + latest-only resolver; no mirror/history | website mirror default, cached catalog, history and real latest metadata | two-version fixture plus byte-verified v1.1.1 source-to-mirror publication |
| No automatic release update | no Actions/mapping pipeline | hourly + dispatch + manual workflow, checksum/size/PE verification, draft-before-publish, durable mapping | direct v1.1.1 sync passed; scheduled/manual Actions execution remains unobserved |
| Generic expensive hero | eager Three.js decorative lens | semantic interactive 2.5D EVMS workflow, no WebGL dependency | no-JS and reduced-motion tests; 56 responsive page checks |
| Company duplication | repeated names/emails/phones in templates | content/company.json drives public pages | published known support/sales values; unknown legal/address fields omitted |
| Capabilities lacked verification metadata | existing evidence text without date/version flags | verified/version/date fields, public filter and content audit | actual core source and existing acceptance limitations reconciled; no new hardware guarantee |
| Phone/interest validation incomplete | length-only fields | bounded phone/digit rules and interest allowlist | API rejection tests |
| Owner filters exposed search strings in URLs | GET search/export UI | POST+CSRF filters/exports, allowlisted sort, source migration/details/export | owner two-port browser checks, session/CSRF/IDOR tests |
| Private download could hang | no total upstream deadline | 120-second signal and restricted redirect hosts | token isolation fixture; real GitHub EXE transfer and re-hash verified |
| Sheets privacy check could miss another permissions page | only first response inspected | fail closed on pagination; expanded source column | privacy/retry fixture; live sheet not configured |
| Stale frontend could mismatch HTML | hour-long unversioned JS cache | revalidation and HTML/runtime no-store | response header checks |
| Privacy link stale / SEO incomplete | removed home anchor, inconsistent metadata | shared page metadata, correct Contact link, Twitter and CSP-hashed Organization JSON-LD | rendered route/header checks |
| Unsafe/unrelated release overwrites possible in naive mirroring | new automation required collision safeguards | tag ownership marker, same-name byte mismatch rejected, strict asset allowlist | collision/change tests |
| Production status unclear | fixtures could be mistaken for real delivery/deployment | explicit activation and NOT VERIFIED documentation | no production claims |

## Release architecture
Source releases → website Actions scheduled/event reconciliation → approved EXEs verified before mirror publication → evms-mirror.json mapping → website mirror catalog/cache → latest/history/download UI.
No manual website version edit for the next release. Source repository remains engineering authority. Public runtime consumes the mirror. See [release operations](GITHUB_RELEASES.md) for exact workflow, least-privilege secrets and recovery.

## Tests
- Build: passed.
- ESLint + syntax: passed.
- Unit/API/integration/security groups: 16 passed, 0 failed.
- Public browser: 8 pages × 7 widths; no horizontal overflow; 16 axe scans with 0 violations.
- Dynamic failure/retry states, keyboard navigation, reduced motion, no-JS workflow: passed.
- Owner/form browser: two independent frontend/backend port pairs; saved lead, owner lifecycle/status/export, same/split origins: passed.
- Release fixtures: two versions, latest/history, downloads by verified bytes, deduplication, metadata edits, missing asset, invalid/corrupt/changed installers and unrelated tag collision: passed.
- npm audit: zero known vulnerabilities at check time.
- Automated checks are not exhaustive proof, a penetration-test certificate or full assistive-technology acceptance.

## Files
Main changes: scripts/pages.js; public/app.js, request.js, workflow.js, workflow.css, generated public HTML; content/company.json, releases.json, verified-features.json; server/app.js, config.js, db.js, releases.js, github.js, download.js, reports.js, sheets.js; scripts/mirror-lib.js, sync-releases.js, acceptance.js; tests/mirror.test.js, hardening.test.js; both .github/workflows; ESLint/build/dependency files and documentation.
Full list: [file inventory](FILE_INVENTORY.md). No website files were stored in the core repo.

## Production activation still required
1. Confirm the default-branch Actions workflow runs with source read access via `SOURCE_RELEASE_TOKEN` when the source is private. Destination uses the scoped built-in `GITHUB_TOKEN` with Contents: write.
2. Verify release rendering and installer download from the deployed Downloads page. Direct GitHub source-to-mirror transfer and hashes are verified; deployed website access is separate.
3. Deploy the Node service with persistent SQLite, HTTPS, exact origins/proxy settings; provision real owner credentials privately.
4. Configure and test SMTP; optionally configure private Sheets. No actual sales email was sent.
5. Verify target Railway/Hostinger/Docker runtime, backups and retention policy.
6. Supply approved legal company/address/terms/social information if these should be published.

Exact runtime variables: [ENVIRONMENT.md](ENVIRONMENT.md). Deployment steps: [DEPLOYMENT.md](DEPLOYMENT.md). Source/mirror permissions and workflow recovery: [GITHUB_RELEASES.md](GITHUB_RELEASES.md). Security details: [SECURITY.md](SECURITY.md).

## Operational limits
One app instance/SQLite database; one scheduler. Historical cache is explicitly stale during outage. Mirror re-verification bandwidth scales with history; monitor workflow duration and GitHub schedule inactivity. Source revocation is not automatically propagated; customer release withdrawal requires an administrator. No owner MFA or password-reset UI in this website. Company information and release notes still need business/editorial review. No unverified AI, PTZ recall, LDAP/failover, capacity, security certification or uptime guarantee is promoted.
