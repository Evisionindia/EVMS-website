# Audit before remediation
Inspected all application modules, UI entries, assets, content, build/deployment configuration and existing tests before editing. Core revision read: e97be6a. No core mutation.
|Issue|Root cause / effect|Fix and regression verification|
|---|---|---|
|Unbounded public loading|fetch has no deadline; unresolved network leaves loading forever; empty arrays silently blank|Bounded JSON loader, schema checks, retry, initial unavailable copy; injected browser failures|
|Release coupling/history missing|Only core /latest, no Actions or history|Mirror automation and paginated mirror catalog; fixture release lifecycle|
|Generic hero|Decorative camera lens, eagerly loaded Three.js|Product workflow in responsive semantic 2.5D; no WebGL dependency|
|Company inconsistency|Repeated strings, no central source|company.json used at build across public pages|
|Incomplete feature evidence schema|Version/date/verification flag absent|Verified feature records plus source checks|
|Lead validation gaps|Any phone/interest accepted|Allowlisted interests, bounded phone format, tests|
|Owner sorting/source missing|Fixed order; no source column|Migrated source field, allowlisted sort, private detail/export|
|Private download can hang|No upstream deadline|Bounded transfer timeout|
|Privacy navigation stale|Links to removed home #demo|Contact page links|
|Public metadata incomplete|No Twitter/structured company metadata|Shared page metadata and safe structured organization info|
|Static assets stale|Unversioned JS cached an hour|Revalidate public assets and no-store HTML/runtime config|
|Operational limits|No live credentials or deployed cloud|Document NOT VERIFIED; never equate fixtures to production|
Security baseline: parameterized SQL, owner-session checks, per-session CSRF, exact-origin CORS, rate limiting and private exports exist. Recheck those after changes.
