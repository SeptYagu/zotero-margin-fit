# v0.1.6 S2 — 16-unit safety, two-axis and support estimator

Date: 2026-10-09. Pure core geometry completed, no production raster pipeline switch yet.
- Core SAFETY changed from 8 to 16 PDF viewport units. Applied once by safeBox, clamped to page edges.
- New sparseBodyWidth estimator uses stagger-sampled row extrema, minimum widely distributed central body, and rejects large independent footer figures. Samples outside the body are eligible for exclusion from Width Fit only when small and fully confined to marginal header/footer.
- fitPageRecord retains full raw and exposes widthFitRaw only for high-confidence strict-text folios; Height Fit continues to use full raw. scaleDecision reads the mode-specific frame.
- S2 tests: 9/9 sparse geometry scenarios pass (including left page number plus Chapter 4, right number, wide independent figure, 16-unit safety and axis separation). Legacy 47/47 Node tests pass after updating previous hard-coded 8-unit expectations.
- Known limits: image-page estimation remains approximate and currently relies on simple row extrema. A narrow real bottom footnote can still resemble a folio; more real fixtures and Zotero integration needed before enabling in runtime.
- Next S3 must use the sparse estimator in mixed-PDF rendering and validate real Zotero reader scale. Build/test in a separate Zotero profile.
