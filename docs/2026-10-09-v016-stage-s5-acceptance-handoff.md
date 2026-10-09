# MarginFit 0.1.6 — S5 final development acceptance and handoff

Date: 2026-10-09. **Development candidate complete; not publicly released.**
Test target: Windows Zotero **10.0.6**, isolated temp profile and Zotero DB. The user's actual Zotero instance/profile, PDF files and annotations were not modified.

## Product change
- Fitting safety doubled: 8 → **16 PDF viewport units** on each side; clamp at PDF page extents and apply only once.
- Production raster detector now tests ~25% pixels in diagonally staggered columns, with deterministic period-16 phase shifts; no extra offscreen PDF render.
- Horizontal and vertical evidence is combined in a conservative body support classifier; small marginal protrusions such as the lower-left folio of the synthetic music-theory page can be excluded from Width Fit without excluding the Chapter 4 footer from Height Fit.
- Pure-text pages reuse existing strict PDF.js operator-list bypass and native page-number pattern analysis.
- The original full-raster detector remains as low-confidence background/blank/dense fallback; unresolved margins remain conservative.
- Algorithm VERSION=4, storage schema=3; cache stores compact boundsKind/samplingRate/boundaryConfidence/widthFitRaw with validation and safe migration by recomputation, no PDF bytes.

## Tests executed
- `npm test`: **57/57 passed** (original 47 + 9 sparse tests + 1 cache metadata test).
- `npm run test:integration`: **70/70 passed** in isolated Zotero 10.0.6 on 0.1.6 build (latest run folder .test-harness/49d8c5636efd400faa93e29edb807042, `passed=true`).
- `npm run test:cache`: **21/21 passed**, including the artificial mixed-text score/folio/Chapter 4 fixture and actual Zotero Width Fit comparison (latest run folder .test-harness/702a6548bc5849d48bf69bc5e8cc3ba3, `passed=true`).
- `npm run build`: generated `dist/zotero-margin-fit-0.1.6.xpi`, **20,404 bytes**, SHA-256 `5fda2ee5102655bc89b2902c07904ff2ff18ce85d136308ec92bab5c633a5477`.
- Test source for fake book: `tests/make-fixtures.cjs` creates `mixed-folio-score.pdf` (24 pages). This is synthetic, **not** the user's screenshot's source PDF.

## CPU assessment
Deterministic Node microbench `node tests/sparse-performance.cjs` on 600×800 RGBA x65 iterations, after warmup:
- Body text: full scan 154.09 ms, sparse 54.60 ms (2.82× loop speed).
- Synthetic score with footer: full 121.42 ms, sparse 43.87 ms (2.77×).
- Blank/dense also show reduced sparse-only scan time but **runtime triggers an additional full scan** on these uncertain pages, so their end-to-end result can regress.
- These figures are for *JavaScript scan loops only*, **not** page.render, getImageData, cross-realm RGBA copying or Zotero total CPU. There is no scientifically justified overall CPU reduction claim yet. Higher chosen zoom may increase native rendering CPU.

## Residual risks and not-yet-proven claims
1. The actual original p.76 book PDF was never provided; a similar generated PDF passes, but real book page behavior remains unverified.
2. Staggered 25% raster sampling is **approximate**, not logically equivalent to complete extraction. One-pixel diagonal alias, thin independent music marks and rare glyphs may still be missed. The 16-unit safety and evidence thresholds mitigate but do not prove zero loss.
3. Edge-only visual footnotes can sometimes resemble an isolated folio; complex or atypical page classes should preserve/restore the conservative path.
4. Real end-to-end Zotero CPU/GPU memory and long-term diverse private historical-score PDFs are not statistically benchmarked. macOS/Linux not verified.
5. In v0.1.6, Height Fit intentionally includes the numeric folio and Chapter 4 footer. Sequential explicit requests may differ slightly in scale due to changing scrollbars/viewport.
6. There is no external publication: `updates.json` continues pointing to released v0.1.5. Native 0.1.5→0.1.6 auto-update cannot be claimed until an authorized 0.1.6 GitHub Release and public feed update occur.

## Release boundary and handoff
S0–S5 milestones were separately committed and pushed, and the active plan was reread between stages.
- Do not create v0.1.6 GitHub tag/Release or change `updates.json` without the user's separate release instruction.
- For a future release: reconcile release docs, inspect real p.76 PDF when available, reproduce clean final tests, re-hash/upload public XPI, verify public re-download, then update public feed and run the native Zotero auto-update acceptance test.
- Preserve the existing three preexisting untracked diagnostics under `tests/canvas-probe.js`, `tests/operators-probe.js`, `tests/performance-sampler.ps1`.
