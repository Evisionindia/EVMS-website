# Local runtime and release check

Checked on 2 October 2026.

- The full website suite passed: unit/integration/security tests, production build, two frontend/backend browser pairs, 8 pages at 7 widths, 16 axe scans and content audit.
- E-VMS v1.2 was published as the stable latest source release and mirrored to `Evisionindia/EVMS-website`.
- Public tag `v1.2` resolves to technical installer version `1.2.0`; the mirror rejects a mismatched tag/installer version.
- The E-VMS Pro and E-VMS installers were downloaded from the source, checked for PE structure, size and SHA-256, uploaded to the website release, then downloaded and hashed again.
- The website release also contains the installer README, source release manifest, SBOM and `evms-mirror.json` provenance mapping.
- A local `/api/releases` response still depends on GitHub visibility and an optional server-side read token when the mirror repository is private. The UI keeps an explicit unavailable/retry state when GitHub cannot be read.

Release verification does not certify code signing, every camera, production hosting, SMTP, LDAP/AD or multi-host failover.
