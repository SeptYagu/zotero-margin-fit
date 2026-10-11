# MarginFit 0.1.7 — sparse text/ink calibration, October 10 2026

Status: **implemented and validated on isolated Zotero 10.0.6; development candidate on branch `fix/v017-actual-visible-ink-width`; NOT released.** Main and `updates.json` still publish 0.1.6.

## Observed defect

A real electronic scholarly PDF displayed a persistent apparent offset: actual rendered body ink extends to approximately x=366 in a 432 PDF-unit-wide page, whereas PDF text advance metrics projected an exaggerated right boundary up to x≈439 (clamped by MarginFit to 432). Prior versions centered the inflated rectangle precisely; horizontal scroll math was not the defect. The same source PDF also has mixed page dimensions. Analysis used a **read-only original** from Zotero storage, imported as a disposable attachment into an isolated test profile; no source edits or private PDF files are committed.

## Implemented detection and fitting

1. Keep the existing true pure-text no-raster path when the text frame is not suspicious.
2. Mark a text frame *suspect* if one side is nearly against the page boundary while the other has a substantial margin, or if the two margins are strongly unbalanced and the smaller is within a narrow outer band.
3. For suspect pages, render the same pre-existing low-resolution (max-long-edge 800px) page **once**. Use the normal `sparseInkBox()` diagonal one-in-four sampler with deterministic period-16 phase staggering. **Do not perform a complete pixel scan merely because font geometry is suspect.**
4. `sparseEdgeSupport()` independently verifies left and right ink extrema: at least max(8, 1.8% of canvas height) independently sampled rows, at least three of eight vertical buckets, at least 25% of page height between first and last supporting row, and at least three ink samples per row. The edge tolerance is 2×stride+2 pixels. Do not treat a lonely outlier as confidence.
5. On a side where the PDF text frame exceeds the sampled ink edge by >max(16 PDF units, 3.5% of page width), *and* that side has distributed sampled-ink support, let raster override that inflated **horizontal side only**. Otherwise retain original conservative text-raster union. Height calculation is unchanged.
6. Preserve 16 PDF-unit per-side fitting padding, distinct `widthFitRaw` and vertical footer treatment, `boundsKind='estimated'`, measured sampling rate, and versioned cache invalidation (`core.VERSION=5`). Low-confidence/dark/blank/dense raster pages can still trigger legacy conservative fallback behavior; full scans are not the default calibration method.

## Real document validation

The affected user's original 14-page PDF was evaluated **without copying it into the repository**. After change, PDF pages 8–12, including the photographed printed page 87 (PDF p10), all passed the live Zotero fit test:

| PDF page | Corrected right boundary (PDF units) | Sparse sample | Left/right visible margin delta (CSS px) | Detector elapsed time (ms) |
|---|---:|---:|---:|---:|
| 8 | 368 | 25% | 0.57 | 285 |
| 9 | 366 | 25% | 1.24 | 1165 |
| 10 | 368 | 25% | 0.57 | 546 |
| 11 | 368 | 25% | 1.46 | 450 |
| 12 | 368 | 25% | 0.57 | 495 |

The original 0.1.6 p10 right bound was 432 (too wide). Corrected real-page geometry is now centered within <2 CSS pixels. Times include PDF.js page rendering, RGBA extraction, cross-realm copying and sparse JS sampling, so 25% pixel visits do not imply 75% overall CPU saving.

## Regression

- `npm test`: **65/65 passed** (the existing tests plus specifically supported/unsupported sparse calibration cases).
- `npm run test:integration`: **70/70 passed**.
- `npm run test:cache`: **21/21 passed**. This includes a synthetic music-score/isolated-page-number fixture that now correctly retains one-in-four sampling. Previously the full-scan calibration trigger broke that test.
- `npm run test:ui`: **18/18 passed**.
- `npm run build`: built the local 0.1.7 XPI; no tag, Release, public feed update or live Zotero install performed.

## Limitations

Sparse bounds are **statistical estimates**, not provably pixel-perfect. A thin glyph missed entirely by fixed-phase sampling may not be represented; the invariant is to avoid tightening without multiple distributed near-edge observations and to retain 16-unit padding. A true asymmetrically typeset page can still trigger a low-resolution render; the added confidence threshold should normally prevent false cropping but requires broader real-world material to quantify false positives. A cached reading result avoids re-rendering after first analysis, but first-page L1 latency on a book with repeatedly suspect text metrics may remain higher than the prior pure-text fast path.

No proprietary PDF or user Zotero library files were committed.
