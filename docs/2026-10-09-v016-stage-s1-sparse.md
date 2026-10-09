# v0.1.6 S1 — diagonal sparse geometry prototype

2026-10-09; initial independently tested prototype, NOT enabled as production detector.

- Implemented C.sparseInkBox(image,stride=4,phasePeriod=16), using exactly one out of every four horizontal pixels per raster row.
- Phase (y + floor(y / 16)) mod stride creates slanted offset with periodic phase changes.
- Per-row Int32 left/right and Uint32 ink counts; returns estimated bounds with visited/hits metadata.
- Corner background/blank/dense fallback preserves conservative behavior. A strict full bounding box guarantee is not claimed.
- New tests/sparse.test.cjs: 5/5 tests pass for ~25% sampling, horizontal/vertical thin strokes, diagonal alias mitigation, dark/blank/dense pages, odd widths and 33% mode.
- Existing C.inkBox() is unchanged and production runtime still calls the old detector.
- Next: support score, footer protrusion detection, explicit width-vs-height fit and cache invalidation; must preserve original display/annotations.
