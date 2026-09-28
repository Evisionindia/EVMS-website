# Local runtime and release check

Checked on 28 September 2026.

- Final preview: `http://localhost:4100`.
- Home, Product, Workflow, Deployment, Company, Contact, Downloads, Privacy, `/health` and `/api/features` returned HTTP 200 after restart; website stderr was empty.
- EVMS v1.1.1 was published as the stable latest source release and mirrored to `Evisionindia/EVMS-website`.
- The Client and Owner installers were downloaded from the source, checked for PE structure, size and SHA-256, uploaded to the website release, then downloaded and hashed again.
- The website release also contains the installer README, source release manifest, SBOM and `evms-mirror.json` provenance mapping.
- A local `/api/releases` response still depends on GitHub visibility and an optional server-side read token when the mirror repository is private. The UI keeps an explicit unavailable/retry state when GitHub cannot be read.

Release verification does not certify code signing, every camera, production hosting, SMTP, LDAP/AD or multi-host failover.
