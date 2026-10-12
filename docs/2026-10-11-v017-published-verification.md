# MarginFit v0.1.7 — Published release verification

Date: 2026-10-11
Status: **published, verified, updater smoke-tested**.

## Release identity and integrity

- Tag: `v0.1.7` (annotated; release source commit `29c999a`).
- Official GitHub Release: https://github.com/SeptYagu/zotero-margin-fit/releases/tag/v0.1.7
- Verified XPI: `zotero-margin-fit-0.1.7.xpi` (24,876 bytes).
- SHA-256: `ca7b36c81e2d75f0863b78a98fdf0f0d73f635b1d0187485ffefa113321ad9e2`.
- GitHub Actions release workflow: https://github.com/SeptYagu/zotero-margin-fit/actions/runs/38195536006 — completed successfully.
- Release confirmed not draft / not prerelease; one asset; GitHub API asset digest matches the build hash.
- Official `main/updates.json` now advertises `0.1.7` with the exact release URL and matching SHA-256.
- Zotero supported manifest compatibility: `10.0.5` to `10.0.*`.

## Final test results

Tested using disposable Windows Zotero 10.0.6 profiles; official Zotero user data and real PDFs were not modified.

| Test | Result |
|---|---|
| Node.js unit tests | 75/75 passed |
| Native Zotero reader integration | 76/76 passed |
| Cache and verified page-number integration | 21/21 passed |
| Native reader UI integration | 18/18 passed |
| Build of published version | Passed; deterministic matching SHA-256 |
| Zotero native background automatic update | 9/9 passed, `v0.1.1` → `v0.1.7` |
| Real Zotero/academic PDF comparison | 18/18 documents opened per arm, 46/46 subsequent page visits completed |

The native update check installed public `v0.1.1` with its published checksum, discovered `v0.1.7` through the actual published update feed, selected the published release asset, enabled background updates, downloaded/verified/activated `v0.1.7` without manual installer invocation, and preserved the margin-detection and fitting-direction preferences. The updated runtime's toolbar and bilingual states were also verified.

## Performance summary

Full real-document evidence: [18 real PDFs — controlled three-version A/B benchmark](2026-10-11-real-library-18-pdf-ab-benchmark.md).

Relative to published `v0.1.6`, on this sample, first exact page-boundary detection median went from 3,330 ms to 2,032 ms, initial detector page jobs fell from 171 to 52, and the sum of detector wall times went from 53.9 to 18.1 seconds. Fourteen independent raster pages were eligible for a safe crop check; none showed clipped ink beyond the existing safety margin. The test is not an exhaustive CPU energy or cross-platform measurement.

## Rollout notes

- The GitHub Release is a stable release, not a prerelease.
- Zotero's native update system may fetch it when the add-on updater next checks, or users may install the release XPI manually.
- Do not assume an update has already been installed in the user's production Zotero. All automated installation tests used disposable profiles.
- Versioned `v0.1.7` source/tag and its published XPI remain unchanged after the update feed and this verification report were committed to `main`.
