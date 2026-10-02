# Automated release distribution

## Source and destination
Authoritative engineering releases: `Evisionindia/E-VMS`.
Customer mirror: `Evisionindia/EVMS-website`.
The public API defaults to the mirror, not the core. Values and asset policy live in content/releases.json.

## Activation (not executed yet)
After explicit authorization, push this website checkout to its own repository/default branch. Enable Actions there. No core files need modification.
Set repository Actions secret **SOURCE_RELEASE_TOKEN** when the source is private: fine-grained token scoped only to the source repository, **Contents: read**, plus normal metadata access. A short-lived GitHub App installation token with the same permission can instead be supplied by an organization-managed token-generation step.
Destination uses the built-in **GITHUB_TOKEN**, passed as MIRROR_TOKEN, with **contents: write** only. No personal mirror PAT is required. Website runtime does not need this write token.

The workflow has:
- Hourly scheduled reconciliation at minute 17.
- repository_dispatch type `evms-release-published` for an optional authorized source release publisher.
- workflow_dispatch for recovery.
- One concurrency group, no cancellation mid-sync, 45-minute limit.
- Checkout/setup actions pinned to verified official v5 commit IDs.

Scheduled workflows run on the default branch, can be delayed by GitHub, and may be disabled after repository inactivity. Monitor the sync marker; schedule is not a real-time delivery guarantee. Dispatch is optional; automatic hourly polling works without changing the core repository.

To add immediate dispatch later, an authorized source publisher POSTs `{"event_type":"evms-release-published"}` to `/repos/Evisionindia/EVMS-website/dispatches`. That publisher needs separate destination Contents: write access (prefer a narrowly scoped GitHub App). No secrets go in payloads.

## What is mirrored
Published semantic-version releases, including prereleases with matching installer version names. Drafts and non-version operational tags are ignored. Stable latest designation follows the source latest endpoint; prereleases never become latest.

Only BOTH required installer roles:
- E-VMS-Pro-VERSION-Windows-x64.exe
- E-VMS-VERSION-Windows-x64.exe

Each file must be uploaded, within 512 MiB, download successfully, match declared size, have DOS MZ and PE signatures, and match source SHA-256 when supplied. SHA-256 is always calculated and the destination download is checked. This verifies transfer integrity/file structure, not code signing or malware safety.

Legacy `EVMS-Client-Setup-*` and `EVMS-Owner-Setup-*` names remain accepted only for historical release compatibility. New releases must include `client.yml`, `owner.yml`, and the exact installer `.blockmap` files; synchronization verifies each channel names the approved installer before mirroring it. Database files, dumps, source archives, backups, credentials, migrations and arbitrary release attachments are not mirrored. The E-VMS desktop updater reads its edition-specific channel from this customer distribution repository.

New mirror releases remain drafts until assets and mapping are complete. Tag collisions unrelated to this source are rejected. Repeated runs compare the existing bytes and metadata; missing assets are uploaded, unchanged assets are not reuploaded. Edited notes are synchronized. A same-name published installer whose bytes changed is rejected: publish a new version. An incomplete source does not fabricate a release.

## Mapping and health
Every mirrored release has an `evms-mirror.json` asset containing source/mirror repositories, release IDs, tags, source URL/date, sync timestamp/status, asset IDs, byte counts and calculated SHA-256.
A separate prerelease `release-sync-status` stores non-secret operational JSON. It is excluded from downloads/history. Failed or older-than-three-hours status is surfaced as a warning. Immutable GitHub release settings may prevent edits; resolve according to your release policy rather than deleting published assets automatically.

## Runtime
GET /api/releases returns all valid stable mirrored releases (paginated GitHub enumeration, safety cap 100 pages), source-designated latest when present, and synchronization status. GitHub /latest absence does not invent a latest label.
Metadata cache: 10 minutes. Concurrent refresh deduplicated; 60-second failure cooldown. GET retries up to three attempts with 200/400ms backoff; each request has an 8-second timeout. Prior checked data remains available with its check timestamp and explicit stale warning during outages. No cache gives an unavailable state; no releases gives an empty state.
Browser requests stop after 10 seconds and offer Retry. Historical releases remain listed. Notes render as text, never HTML.
GitHub-reported digests are shown when provided; independent mirror digests are recorded in the mapping asset.
Private mirror mode is optional: GITHUB_TOKEN is server-side read-only, GITHUB_PRIVATE_RELEASES=true; approved asset IDs are streamed with a 120-second transfer deadline and restricted redirects.

## Recovery
Inspect the failed Actions run and release-sync-status. Fix source access or complete the required source assets, then Run workflow. Interrupted new releases remain drafts and resume on the next run. Do not delete unrelated releases or overwrite changed published installer bytes.
Each reconciliation verifies source and mirrored bytes again, so traffic scales with release history; the 45-minute bound must be monitored as history grows. Source release deletion/revocation is not automatically propagated to customer releases: an authorized administrator must withdraw affected mirror releases.

## Evidence / limits
Local fixtures test two successive versions, byte verification, repeated sync, notes edit, missing destination asset, tag conflict, malformed/incomplete/changed assets and catalog history. **Live GitHub workflow, real EXE upload/download and production credentials are NOT VERIFIED.** No workflow was dispatched and no release was published during this task.

References: [GitHub release REST API](https://docs.github.com/en/rest/releases/releases), [workflow events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows).
