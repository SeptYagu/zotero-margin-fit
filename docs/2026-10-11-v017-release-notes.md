# MarginFit v0.1.7

Release date: 2026-10-11
Compatible with Zotero 10.0.5–10.0.x on the supported Windows test platform.

## Faster first fit; less background work

- Fit the *actual visible page first*: fitting no longer waits for six remote PDF page samples.
- Detect at most the two adjacent pages after the reader settles, with forward/backward priority following the reading direction.
- Skip global book sampling on ordinary graphics, mixed, scanned, and score PDFs. Text-only pages with a plausible isolated folio candidate may still verify a sequence, stopping once four pages corroborate it.
- Reduce the *offscreen detector* raster longest edge from 800 to 560 pixels; preserve the reader's own rendering resolution, selectable text, and annotations.
- Avoid redundant PDF operator parsing and full-image fallback scanning when not useful. Reuse versioned PDF boundary caches.
- Calibrate inflated PDF text boxes against supported 25%-density diagonal ink evidence while preserving 16 PDF-unit safety padding.

## More stable navigation

- Respect a reader's manual pan within the current page until they leave that page, or explicitly request Fit.
- Avoid tiny horizontal recentering and the associated unnecessary layout writes.
- Keep the existing 500 ms idle rule, conservative fallback for uncertain/dark/blank pages, and the native Zoom/Reset behavior when margin detection is disabled.

## Real-document verification

18 independently selected PDFs from a real Zotero attachment collection and academic reading folders, tested sequentially in disposable Zotero 10.0.6 profiles against the *official v0.1.6 published XPI* and an intermediate v0.1.7 build:

| Measure (18 documents) | Published v0.1.6 | v0.1.7 |
|---|---:|---:|
| Median time from reader open to exact current-page boundary | 3,330 ms | 2,032 ms |
| Mean time to exact current-page boundary | 4,278 ms | 2,180 ms |
| Initial page-detection jobs | 171 | 52 |
| Summed detector elapsed duration | 53.9 s | 18.1 s |

All 18 documents and 46 follow-up page visits completed successfully for both versions. Independent raster-ink checks found no clipping beyond the existing 16-unit safety margin in the 14 evaluable pages; the others were skipped due to a nonwhite/dense background or conservatively fitted full page. One real scholarly paper showed a substantially improved right ink boundary.

The elapsed times include reader startup and cannot be equated exactly with CPU seconds or battery consumption. Cross-platform macOS/Linux and all unusual PDF layouts are not certified by these tests.

See [the full 18-PDF A/B benchmark and reproducibility record](2026-10-11-real-library-18-pdf-ab-benchmark.md).

## Installation and automatic updates

Download `zotero-margin-fit-0.1.7.xpi` from this GitHub Release and install through Zotero's add-ons interface; users with automatic add-on updates enabled may instead receive it through Zotero's native update mechanism after the verified release is published and the `updates.json` feed is updated.

The plugin modifies view zoom/scroll positioning only, not the source PDFs or annotation coordinates.
