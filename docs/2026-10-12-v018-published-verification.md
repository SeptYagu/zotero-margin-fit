# MarginFit v0.1.8 — published verification

Date: 2026-10-12
Status: **public stable Release confirmed; official feed and public XPI verified**.

## Release identity
- Tag: `v0.1.8`; source: `df25f10`.
- Official release: https://github.com/SeptYagu/zotero-margin-fit/releases/tag/v0.1.8
- Windows-built XPI: `zotero-margin-fit-0.1.8.xpi`, 29,661 bytes.
- SHA-256: `7e768ee68ff9b78a6db387a85dda062ebc0e719685b0a5162473bc1c2df02f58`.
- GitHub Actions release workflow: https://github.com/SeptYagu/zotero-margin-fit/actions/runs/38274323509 — `completed: success`.
- GitHub Release verified `draft=false`, `prerelease=false`, exactly one XPI asset with matching digest.
- A fresh public download of the Release XPI reproduced the same byte length and SHA-256.
- `main/updates.json` updated by `cde1f9c` after the asset was publicly accessible.
- The actual public raw update feed was read back from GitHub and reported version `0.1.8`, the correct release asset download URL and matching SHA-256.

## Verified behavior
- Node tests: **90 / 90 pass**.
- Earlier native isolated Zotero 10.0.6 suites during v0.1.8 development: page turns, background indexing, cached open/reopen, folio migration, main reader integration and toolbar behavior passed.
- Original `Berger Musica Ficta.pdf` in isolated Zotero: 19 pages, mixed page sizes (612x1008 and 792x1224); original detector produced nine full-page `background` fallbacks. Scan-rim repair produced 19 reliable detections and duplicate toolbar auto-cleanup passed before the last edge-column refinement.
- Final code's sparse detector was separately run directly against a real raster render of all 19 original PDF pages: **19/19 estimated bounds, zero fallback**, and page one bounds approximately `[17,68,277,535]` in a 340x560 sampled raster (instead of detecting physical page extremities).
- Persisted far-out folio Width Fit on reopen and selective invalidation of suspect v0.1.7 raster cache rows both have regression tests.

## Known validation limits
- Final native Zotero 10.0.6 harness runs intermittently hung before completing initialization. A final full native end-to-end run with all the last changes was **not** certified; the post-publication native update smoke test was also attempted and must be recorded by its eventual result, not assumed passed.
- No comprehensive macOS/Linux, multi-hour latency, user-specific PDF-library visual audit or annotation-editing stress test.
- This is an official quick iteration release **for direct user testing**, per [the owner's release policy](RELEASE-POLICY.md). Bugs discovered in use are addressed in the following numbered Release; production Zotero PDF contents, annotations, and local profile were not altered during tests.

## Update availability
The v0.1.8 XPI and the versioned Zotero native update feed are publicly available. Zotero's own update cadence/caching may delay when an existing installation first prompts. Use the public Release page to install directly if necessary.
