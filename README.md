# E-Vision India · E-VMS website

Standalone product website and private lead workspace.
Repository: https://github.com/Evisionindia/EVMS-website

## Current state
Implemented and tested locally. **Not production sign-off.** The stable E-VMS v1.2 source release and its v1.2 website mirror use automated provenance, size and SHA-256 checks. The website source is published on the official repository; cloud application deployment remains unverified. Real SMTP delivery, Google Sheets, signing-key deployment and cloud deployment still require external acceptance.

## Included
- Separate product, workflow, deployment, company, contact, downloads and privacy pages.
- Interactive E-VMS-specific 2.5D workflow with static/no-JavaScript and reduced-motion support.
- Central verified capabilities and company information; no invented deployment/AI claims.
- Bounded dynamic requests with empty/error/retry/stale states.
- Automatic GitHub release mirroring workflow; latest and historical mirrored installer downloads.
- Persistent enquiries and private owner search, sorting, status, CSV/XLSX exports.
- Optional daily sales reports/private Sheets synchronization with durable retry state.
- Verified-email trial requests that issue signed, time-bounded E-VMS licence artifacts only after authoritative core registration and provider acceptance.
- Rate limits, resend cooldowns, one-time verification state, transactional issuance, expiring download tokens and bounded download counts.

## Run
Node 22.16+ and a writable private database directory are required.

```sh
npm ci
cp .env.example .env
npm run build
npm start
```

PowerShell: use `Copy-Item .env.example .env`.
Local example: http://localhost:4100. Public browsing and demo requests remain standalone. Trial issuance requires the configured, least-privilege E-VMS core registration service.
Production: configure HTTPS PUBLIC_SITE_URL, NODE_ENV=production, platform PORT/HOST, persistent DATABASE_PATH and exact CORS/proxy settings.

## Verify
```sh
npm run test:all
npm audit
```
Browser tests require Chrome (BROWSER_EXECUTABLE can select a local browser for the owner checks). Test fixtures use temporary databases, not real leads.

## Owner and integrations
Set OWNER_BOOTSTRAP_PASSWORD only in the bootstrap process environment, run `npm run owner:create`, enter the owner email, then unset the variable. There is no default login.
SMTP and optional Google credentials stay server-side. Enable one scheduler only after configuration. **PRODUCTION EMAIL CONFIGURATION REQUIRED** until actual delivery is tested.

Trial signing uses a server-only RSA private-key path. Never put a private key, SMTP password, GitHub token or Google private key in Git, browser JavaScript, generated pages, logs or release assets. See [trial licensing](documentation/TRIAL_LICENSING.md).

## Documentation
- [Full audit and results](documentation/FINAL_AUDIT.md)
- [v1.2 release verification](documentation/E_VMS_v1.2_RELEASE.md)
- [Release mirroring / secrets / recovery](documentation/GITHUB_RELEASES.md)
- [Architecture](documentation/ARCHITECTURE.md)
- [Deployment](documentation/DEPLOYMENT.md)
- [Exact environment variables](documentation/ENVIRONMENT.md)
- [Lead system](documentation/LEAD_SYSTEM.md)
- [Trial licensing](documentation/TRIAL_LICENSING.md)
- [Security](documentation/SECURITY.md)
- [Verification limits](documentation/VERIFICATION.md)
- [Troubleshooting](documentation/TROUBLESHOOTING.md)
- [Assets and copy](documentation/ASSETS.md)

Release publication is separate from cloud application deployment. The repository and mirrored installers are published; the public Node service has not been verified on production hosting.
