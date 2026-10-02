# E-VMS v1.2 website release verification

Date: 2 October 2026  
Public tag: `v1.2`  
Technical installer version: `1.2.0`  
Core source commit: `6865778818b5a2eda819471d22a2edc48ef0fe98`

## Published source release

- Core repository: https://github.com/Evisionindia/E-VMS/releases/tag/v1.2
- Website mirror: https://github.com/Evisionindia/EVMS-website/releases/tag/v1.2
- Both releases are stable and are not prereleases.
- The website mirror accepts the public two-part tag only when both installer filenames expose one consistent three-part technical version under the same major/minor release.

## Verified installers

| Edition | File | Bytes | SHA-256 | Authenticode |
|---|---|---:|---|---|
| E-VMS | `E-VMS-1.2.0-Windows-x64.exe` | 104772868 | `43734cf876b6667955c3b0d198d12f1e761ae3cb9da77965d03d20776ec030e9` | NotSigned |
| E-VMS Pro | `E-VMS-Pro-1.2.0-Windows-x64.exe` | 104775846 | `4861eaa945e2a684f6dc9b9e009eba007e7c586812321b165419cd56941d8e52` | NotSigned |

The core publisher downloaded every published source asset and rechecked its SHA-256. The mirror downloaded the approved installers, blockmaps and edition-specific updater channel files from the source release, verified their bytes, uploaded them to a draft mirror release, downloaded the mirror assets again and stored the source-to-mirror hashes in `evms-mirror.json` before publication.

## Limits

- These installers are unsigned verification builds and are not production-signing eligible.
- Publishing GitHub releases does not prove cloud website deployment.
- Physical camera/PTZ, full-fleet, 49-stream, real LDAP/AD, multi-host failover and installed updater acceptance remain outside the website release check.
