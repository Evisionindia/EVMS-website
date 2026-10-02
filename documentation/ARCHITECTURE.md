# Architecture
Node/Express website, SQLite WAL database, bundled browser JavaScript and generated multi-page HTML. Public content, demo requests and release browsing remain standalone. Trial issuance uses a server-to-server, least-privilege E-VMS core registration contract; no privileged credential is exposed to browser code.

## Public pages
Home, Product, How it works, Deploy, Downloads, Company, Contact and Privacy. Templates in scripts/pages.js; generated HTML in public, production build in dist. Navigation/footer/company metadata share content/company.json. Product feature API filters content/verified-features.json to verified public records. Every public feature carries evidence, limitations, verified version/date.
The home/workflow presentation is semantic HTML with CSS perspective (2.5D). It explains camera network → EVMS → storage/review/access → operator. It is explicitly an illustration. No fake live feed, detections, PTZ movement or capacity claims. No WebGL or animation loop is needed; it remains usable without GPU/JavaScript. Reduced-motion removes depth transitions.
Browser JSON requests have a 10-second deadline, schema checks and explicit final/retry states. Contact submission preserves input on failure and verifies saved:true before clearing it.

## Release path
Core GitHub release → scheduled/event/manual website Actions workflow → verified mirrored release assets + mapping → cached website catalog → Downloads. See GITHUB_RELEASES.md. Source is not queried by the public website runtime.

## Leads
Validated public JSON submission → atomic SQLite lead and optional Sheets job → private owner workspace/exports. Sessions use hashed random tokens, HttpOnly cookies and mutation CSRF. Source page is assigned by the server; historical rows migrate to unknown. Browser owner queries/exports use POST bodies so names/emails do not appear in request URLs. Owner sort is allowlisted.
Reports run through one scheduler against the same database. Provider acceptance is distinct from inbox delivery. Optional Sheets retries target a stable row. Neither secondary delivery removes leads.

## Boundaries
Only dist/public are served. Private data, integration credentials and source content files are not public static paths. Same-origin or configured split-origin deployment; one SQLite writer/app instance. Build required after template/content changes. No core modification, commit, push or cloud deployment by this task.
