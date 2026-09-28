# E-Vision India · EVMS website

Standalone product website and private lead workspace.
Repository: https://github.com/Evisionindia/EVMS-website

## Current state
Implemented and tested locally. **Not production sign-off.** EVMS v1.1.1 Client and Owner installers are published in the source repository and byte-verified in this repository's stable mirror release. Scheduled GitHub Actions, real email, Google Sheets and cloud deployment still require external acceptance.

## Included
- Separate product, workflow, deployment, company, contact, downloads and privacy pages.
- Interactive EVMS-specific 2.5D workflow with static/no-JavaScript and reduced-motion support.
- Central verified capabilities and company information; no invented deployment/AI claims.
- Bounded dynamic requests with empty/error/retry/stale states.
- Automatic GitHub release mirroring workflow; latest and historical mirrored installer downloads.
- Persistent enquiries and private owner search, sorting, status, CSV/XLSX exports.
- Optional daily sales reports/private Sheets synchronization with durable retry state.

## Run
Node 22.16+ and a writable private database directory are required.

```sh
npm ci
cp .env.example .env
npm run build
npm start
```

PowerShell: use `Copy-Item .env.example .env`.
Local example: http://localhost:4100. Public/API origins and listener are configurable; no core-app dependency.
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

## Documentation
- [Full audit and results](documentation/FINAL_AUDIT.md)
- [Release mirroring / secrets / recovery](documentation/GITHUB_RELEASES.md)
- [Architecture](documentation/ARCHITECTURE.md)
- [Deployment](documentation/DEPLOYMENT.md)
- [Exact environment variables](documentation/ENVIRONMENT.md)
- [Lead system](documentation/LEAD_SYSTEM.md)
- [Security](documentation/SECURITY.md)
- [Verification limits](documentation/VERIFICATION.md)
- [Troubleshooting](documentation/TROUBLESHOOTING.md)
- [Assets and copy](documentation/ASSETS.md)

Website source is pushed on `main`. The v1.1.1 mirrored release is published separately with verified installer provenance in `evms-mirror.json`.
