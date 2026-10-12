# MarginFit v0.1.8

**Regular release for rapid Zotero user testing.** Supports Zotero 10.0.5–10.0.x.

## New reading behavior
- Native PDF.js PAGE view for Fit Height: one displayed PDF page at a time; mouse wheel and touchpad page navigation, page-number jumps, restored continuous layout on return to Width Fit.
- Reuse content boundaries across readings in compact, PDF-fingerprint-based persistent four-coordinate caching, independent of plugin release numbers.
- Progressively index uncached pages while the reader is idle with a single foreground-preemptible detector job.
- Preserve deliberately requested **far-away page-number Width Fit**. Verified body X bounds and complete-content Y bounds survive reopening within the four-coordinate cache format.

## Fixes from the real Berger Musica Ficta PDF
- Correctly handle a 19-page scan with mixed physical page sizes, dirty scanner edges, dark corners and irregular horizontal/vertical border streaks.
- The old scanner-corner rule returned a full-page fallback on 9 of 19 pages. The improved sparse detector finds candidate boxes on all 19 while maintaining the ~25% ink sampling density.
- Correct gross OCR overhang once independent visible-ink evidence has safely rejected scanner dirt.
- Clean up orphan duplicate toolbar button pairs after rerender/discovery.
- Re-evaluate suspicious old v0.1.7 scanned-page cache entries at the physical paper rim; reuse clean older entries.

## Validation and scope
- 90 unit checks passed.
- Earlier isolated Zotero 10.0.6 height-mode, background-indexer, legacy-migration, cache, native toolbar and reader-integration checks passed during the development cycle.
- The original 19-page Berger PDF was examined and validated in isolated Zotero before the final supported-column refinement. The *final* sparse detector was separately run against raster images of all 19 actual PDF pages, with 0 fallback outcomes and improved page-one edge detection.
- Later fresh isolated Zotero runs sometimes stalled at reader/profile startup before reporting checks. Those runs are **incomplete**, not passed. User-facing release is intended to make practical visual testing fast; this is not a claim of exhaustive certification on all scanned PDFs or platforms.
- The source PDF, text layers, highlight coordinates, and production Zotero profile are not edited. The add-on only adjusts native fitting and viewport positioning.

Please report reproducible PDF pages, page-mode/scroll behavior, or duplicate toolbar observations for the next immediate version.
