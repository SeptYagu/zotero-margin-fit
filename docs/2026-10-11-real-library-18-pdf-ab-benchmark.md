# MarginFit — controlled A/B on 18 real Zotero and OneDrive PDFs

Date: 2026-10-11
Status: measured and documented; development branch `fix/v017-actual-visible-ink-width`. **No public release or user Zotero installation was modified.**

## The question

Do the earlier PDF fit optimizations materially improve performance on actual research documents, rather than just synthetic fixtures? Does reducing raster resolution/sampling omit actual visible ink?

**Answer within this sample: yes for detection work and time-to-current-page geometry.** Independent ink checks found no new cropped content beyond the 16 PDF-unit safety margin on the 14 pages that permitted reliable raster comparison. This is evidence, not exhaustive proof for all PDFs.

## Real documents and reproducibility

Source libraries inspected read-only: Zotero's local attachment storage and linked research PDFs from the oral-examination and dissertation collections. A deterministic SHA-based selection over 441 probed candidate PDFs (not the complete corpus) yielded 18 real documents:

| Source | Count |
|---|---:|
| Zotero local storage | 10 |
| Dissertation research | 5 |
| Oral examination research | 3 |

| Broad document class | Count |
|---|---:|
| Text + graphics | 7 |
| Primarily textual | 5 |
| Scanned / image-heavy | 4 |
| Notation or graphics-heavy, little text | 2 |

Documents span 4–236 pages and approximately 0.21–9.22 MB. Classification is based on independent PDF text/image/drawing samples, not human-reviewed ground truth.

Same 18 source PDFs in the same order for each arm; for each, Zotero imported a **copy** into a fresh disposable Zotero 10.0.6 profile, opened page 8 (or last page for short PDF), then visited up to 3 subsequent pages. Sync and update mechanisms were disabled. No original PDFs, production Zotero database, or add-on update feed were changed. Arms were run serially with isolated profiles (no concurrent load from another benchmark).

- **Published baseline:** v0.1.6 tag build, exact release/feed SHA-256 `87BE45568ED38530CA16F2033D2222547CDBC811C2046841CAB1F98A0A39BC35`.
- **P2 intermediate:** commit `38dc991`, already has visible-first and reduced raster/neighbor work but still samples six L1 representative pages.
- **Latest adaptive L1:** commit `1947064`, only validates a folio sequence when the current page warrants book-wide checks.

The precise original file paths and raw per-page results are local-only in ignored `.test-harness/real-pdf-sample.json`, `.test-harness/real-ab-status.json`, `.test-harness/real-ab-analysis.json`, and `.test-harness/real-ab-ink-oracle.json`, and are intentionally not uploaded to the public repository.

## Quantitative results

All **18 documents completed successfully in all three arms**. All opened on the intended page, and all **46 follow-up page visits** in each arm became visible, had a cached boundary, and settled successfully.

| Metric | v0.1.6 | P2 intermediate | Latest adaptive |
|---|---:|---:|---:|
| First available exact current-page boundary, median | 3,330 ms | 2,048 ms | **2,032 ms** |
| First current-page boundary, arithmetic mean | 4,278 ms | 2,149 ms | **2,180 ms** |
| First current-page boundary, 90th percentile (nearest-rank) | 8,003 ms | 2,827 ms | **3,082 ms** |
| End of initial background work, mean from reader open | 5,154 ms | 3,992 ms | **3,123 ms** |
| Total independently detected PDF pages | 171 | 132 | **52** |
| Sum of PDF detector elapsed durations | 53.9 s | 34.3 s | **18.1 s** |
| Total recorded initial zoom/position writes | 46 | 28 | **28** |
| Mean follow-up navigation settlement time (46 visits) | 1,045 ms | 942 ms | 963 ms |

**From published v0.1.6 to latest:**
- 18 of 18 paired documents reached first current-page geometry earlier (median paired advantage 1,533 ms; descriptive paired bootstrap 95% interval 1,008–2,268 ms).
- Median first-current-page boundary time fell approximately **39%**; arithmetic mean fell approximately **49%**.
- Number of initial PDF detections fell **69.6%** (171 to 52).
- Sum of reported detector elapsed time fell **66.4%** (53.9 to 18.1 seconds).
- Recorded initial zoom/position writes fell **39.1%** (46 to 28); some omitted writes are desired no-ops.

**Attribution:**
- P0/P1/P2 together deliver the major first-page responsiveness gain versus v0.1.6.
- Adaptive L1 (P2 to latest) reduces detected page count by **60.6%** (132 to 52), and detector elapsed work by **47.2%**, while first-boundary mean changes by only +31 ms (2,149 to 2,180 ms). **Do not claim that adaptive L1 itself measurably accelerates first fit.**
- Subsequent navigation times are roughly similar, as nearby pages are normally already cached. The sample demonstrates lower speculative work rather than a compelling native scrolling FPS or CPU-speed advantage.

## Independent boundary fidelity check

A separate PyMuPDF render of the initially opened page at 1 pixel per PDF point supplied an approximate ink bounding box, independently of Zotero's PDF.js geometry. Test skipped nonwhite-corner/dense-background images rather than pretending they supplied a trustworthy whitespace ground truth.

- 14 target pages had reliable detected bounds and independent usable ink boxes. None showed visible ink beyond the latest version's 16 PDF-unit safe bounding rectangle, with the renderer/sampling tolerance used.
- One other target page was retained in conservative full-page fallback (both versions), not eligible for a useful crop comparison.
- Three pages were excluded from the ink oracle (dense / blank-looking or nonwhite-corner backgrounds). These are **not** passed fidelity checks.
- For most of the 14 comparable pages, latest and v0.1.6 raw bounds differed by roughly 0–2 PDF units, consistent with detector resolution quantization.
- **A real exception and improvement:** an academic PDF in local Zotero storage, anonymized benchmark ID P07, page 8. Independent ink extended to right x≈323 PDF units; old boundary was x=378, latest boundary x≈323.7. Rightward overestimation fell from ~55 to less than 1 PDF unit (full box width overestimation fell from ~56 to ~1.9). No corresponding ink was clipped. This supports the text-ink calibration correction on an actual research paper.

This check validates protected *raw bounds*, not every eventual Zotero display zoom/scroll state or intentional folio-excluded `widthFitRaw` on every page.

## Limits and decision

The corpus is stratified but small and not a probability sample of all Zotero PDFs. Each arm ran once over the full 18-document sample; startup, OS file caching, font rendering, and device load can affect wall time, and arm order was v0.1.6 -> P2 -> latest. A separate four-document pilot with latest before baseline still found all four pages faster, mitigating but not removing possible warm-cache ordering bias.

`firstGeometryMs` is **time from reader open until the target page has an exact measured boundary**, including Zotero reader open/startup overhead. A page requiring no additional scale/scroll write may already be correctly fitted, so zero writes must **not** be called a fit failure. Summed `elapsedMs` values are cumulative detector wall durations, **not direct CPU seconds**. Total Zotero CPU, native high-zoom redraw load, long-session battery use, and video scrolling frame rate were not measured in this run.

**Engineering decision:** the earlier optimization series provides substantial real-workload benefits without a demonstrated ink-clipping regression in the checked pages. Preserve the current architecture; use actual user's varied PDF corpus for an additional visual acceptance pass before publishing v0.1.7, especially scanned/dense/nonwhite and complex musical scores. Do not add full rescans merely for rare pixel-perfect mathematical cases, and do not trade reading zoom for cosmetic CPU gains.

## Reproduction

- `tests/select-real-pdfs.py`: deterministic, read-only source selection with explicitly supplied named roots. Private manifest stays in `.test-harness`.
- `tests/real-pdf-benchmark.js`: Zotero isolated-profile benchmark driver; copy imports, page navigation, bound and detector metrics.
- `tests/run-integration.ps1`: optional `-BenchmarkXPI`, `-BenchmarkManifest`, `-BenchmarkLabel` parameters; ordinary test behavior unchanged.
- `tests/analyze-real-pdf-benchmark.py`: paired per-document summary, descriptive bootstrap interval, and boundary-difference inventory.
- `tests/validate-real-pdf-bounds.py`: independent conservative PyMuPDF ink oracle.
- Official XPI and version-specific test XPIs were built from their matching immutable Git tags/commits, with verified release hash for v0.1.6; no published release files were changed.
