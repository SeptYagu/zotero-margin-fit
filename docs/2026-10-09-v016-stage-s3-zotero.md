# v0.1.6 S3 — reader integration validation

Date 2026-10-09, Windows Zotero 10.0.6 in **isolated profile and database** (not the user's live Zotero).

The production runtime now calls sparseInkBox() for raster/mixed pages, retaining the existing pure-text no-render optimization. Approximate 25% sampling is labeled boundsKind=estimated; background/blank/dense cases revert to C.inkBox() and conservative fallback. Sparse body evidence may create a separate widthFitRaw while raw still preserves the page's overall estimated content for Height Fit. The font text content in the central body contributes to width as a protection against weak raster ink.

tests/make-fixtures.cjs gained a deliberately *synthetic*, 24-page music theory case: mixed-folio-score.pdf with thin staff lines, lower-left folio and Chapter 4 at bottom. It is not the user's book.
- Baseline unit tests: 47/47 passed.
- New pure geometry sparse tests: 9/9 passed.
- Full isolated Zotero integration: 70/70 passed after adjusting prior 8-unit height expectation to 16 units each side.
- Dedicated isolated Zotero checks: 21/21 passed; among them mixed music surrogate uses 1/4 sampling and has widthFitRaw excluding the left folio; actual Zotero smart Width Fit increased the body compared with using raw bounds; Height Fit keeps the footer.

Caveat: sequential PDF.js explicit Fit Height requests can change viewport/scrollbar state; the 21-check test tolerates <5% resulting scale difference, but directly asserts the unchanged raw-height semantics elsewhere. Existing user-provided screenshot was not a source PDF and therefore has not been tested directly.

Stage S4 is required before shipment: persist estimated-vs-verified metadata with upgraded cache schema and algorithm version, build version 0.1.6, compare overall detection and rendering costs, then full regression.
