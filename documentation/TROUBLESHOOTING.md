# Troubleshooting

- **No owner can sign in:** provision the website owner using owner:create. EVMS-core accounts are separate. There is no default password.
- **Request origin required / CORS denied:** PUBLIC_SITE_URL and CORS_ORIGINS must match the actual browser origin, including scheme and port. Never use wildcard credentialed CORS.
- **Login succeeds but session missing:** inspect HTTPS/Secure and SameSite policy. Cross-site cookies can be blocked by browsers even with SameSite=None. Prefer same-origin or same-site subdomains.
- **Database unavailable:** check persistent volume ownership, free disk and DATABASE_PATH. Do not place the DB in public/dist. Failed transactions do not claim success.
- **Rate limit:** wait for Retry-After. Configure TRUST_PROXY to match the actual reverse proxy, not arbitrary forwarded headers.
- **No daily email:** enable scheduler or external job, configure SMTP/sender, inspect owner report state. Accepted is provider acceptance only.
- **Sheets failed:** ensure service account access, both APIs enabled, private permissions and a dedicated Leads tab. Do not rearrange reserved rows.
- **Download unavailable:** verify configured repo, latest stable release and Client/Owner EXE names. A 404 may require a server token for a private repository.
- **Static frontend calls wrong API:** replace runtime-config.js; update API CORS and cookie policy. No JS source rebuild is needed to change API origin.
- **Core EVMS:** this website does not start or change the camera/recording system.

## Product/release section unavailable

Browser requests stop after 10 seconds and display Retry. Check /api/features and /api/releases status and runtime-config.js API origin. A 200 HTML response instead of JSON indicates incorrect proxy/static routing. Never route /api to the frontend fallback. Empty releases indicate no eligible mirror release; unavailable indicates retrieval failure. Cached data is labelled with its check time.

## Mirror does not update

Check default-branch workflow activation, SOURCE_RELEASE_TOKEN access, Actions permissions and release-sync-status. Every source version must contain both approved matching installer names. Missing/invalid bytes, changed published installers and tag collisions fail verification. Fix source configuration, then use workflow_dispatch; the hourly schedule retries automatically. GitHub schedules may be delayed or disabled after inactivity.
