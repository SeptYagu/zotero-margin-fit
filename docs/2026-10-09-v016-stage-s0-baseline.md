# v0.1.6 S0 — 2026-10-09 baseline and safety target

Source base: v0.1.5, Git head f620c55 before planning-only safety update 71bd4ed. No source code touched in S0.
New design decision: 16 PDF viewport units padding on each side (formerly 8), once only.
Correctness target: sparse 1/4 diagonal sample plus periodic phase shifts; 2D body support instead of extremal isolated footer, preserve all meaningful figures/music/footnotes or fallback.
S0 status: baseline characterized, not a claim of reproduction using original PDF.

Existing v0.1.5 implementation:
- core.inkBox reads every RGBA pixel and returns bounding extrema; expects fully sampled raster.
- runtime.detect calls getTextContent and operator list; strictly pure text/no annotations can skip raster; all others render max-800-pixel preview and read/copy entire RGBA.
- mixed-page raw uses union(textBBox,rasterBBox); an isolated lower-left folio contaminates width.
- fitPageRecord currently removes folio only for repeated strict pure text; it replaces raw for both fit width/height. Plan specifies separate widthFit/heightFit from now on.
- cache.storageVersion=2/core.VERSION=3. Upgrade together when semantics change.
- existing tests cover core ink, folio, 70 integration + 18 dedicated v015 integration; preserve user Zotero profile.

Test source: tests/make-fixtures.cjs creates artificial PDF cases (asymmetric-book, clean-scan, pure-folio, etc.). The user screenshot of music-theory p.76 has NOT been provided as its original PDF; synthetic geometry cases should be labeled surrogate, not live reproduction. Maintain golden 0.1.5 boundaries for comparison.

Before calling performance an improvement, capture separate PDF.js render, whole-page getImageData, cloneInto, sparse JavaScript sampling, support analysis, fallbacks and actual reader scale/CPU. Sampling 25% cannot imply 75% lower application CPU.

Stages commit/push independently after testing and re-reading plan. This S0 records only baseline and ready-to-implement constraints.
