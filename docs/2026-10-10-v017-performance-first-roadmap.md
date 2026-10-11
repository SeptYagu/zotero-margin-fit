# MarginFit v0.1.7 — performance-first roadmap

Date: 2026-10-10. **Research and benchmarks only — no runtime optimization implemented by this document.** Current working branch: `fix/v017-actual-visible-ink-width`. Published v0.1.6 remains untouched.

## Product decision

Optimize median/majority-user responsiveness and actual Zotero CPU rather than seek mathematical pixel-perfect boundary equivalence. The existing 25% diagonally staggered pixel sample, distributed edge support and 16 PDF-unit safety margin are sufficient as the performance-oriented baseline. Avoid any normal-path second scan intended only to cover rare single-pixel adversarial content. Keep meaningful ordinary text, score staves, figures and footnotes in routine regression cases.

**Crucially distinguish:** (a) time until first smart fit; (b) additional PDF detection CPU while scrolling; (c) Zotero native rendering CPU after the user has enlarged the page. Changing JavaScript sampling alone cannot eliminate (c).

## Measured bottlenecks

### 1. Serial pre-analysis blocks the visible page

`src/core.js:Session.l1()` unconditionally tries up to six representative page samples (odd/even at 25/50/75%) in a serial queue. `Controller.begin()` and **explicit `Controller.request()`** both await the entire L1 result before fitting the user's current page. `Session.local()` may then process the current and six neighboring pages in another serialized sequence.

Representative real Edidin PDF v0.1.7 detection records for pages 8–12 took 285, 1165, 546, 450 and 495 ms. Their mean is ~588 ms, not a controlled concurrency benchmark. Nevertheless six serial expensive renders can plausibly stall fitting for seconds. This is a scheduler/design issue, not a sparse-sampling issue.

### 2. Real isolated Zotero rendering/scan A/B

Disposable Zotero 10.0.6 profile, the affected real PDF's p10 and one generated score/folio page; resource cache warmed; three sequential runs per canvas long-edge. Times in ms are **means of 3 short runs**, heavily exposed to PDF.js render/font-cache scheduling and JIT variation; do not interpret as production latency guarantees.

| PDF test | Target long edge | Canvas | Render ms | Sparse pixel scan ms | Full measured pipeline ms* | Approx. sampled ink x min..max in PDF units |
|---|---:|---:|---:|---:|---:|---|
| Real text (p10) | 688 (current actual) | 432×688 | 120.7 | 20.0 | 175.3 | 65..366 |
| Real text (p10) | 560 | 352×560 | 46.7 | 13.0 | 84.0 | 65.11..364.89 |
| Real text (p10) | 440 | 277×440 | 46.0 | 7.3 | 69.0 | 65.67..364.33 |
| Real text (p10) | 350 | 220×350 | 43.7 | 6.3 | 66.7 | 64.87..365.62 |
| Synthetic score/folio | 800 (current) | 600×800 | 9.3 | 19.0 | 35.0 | 33..454 |
| Synthetic score/folio | 560 | 420×560 | 5.7 | 9.7 | 23.3 | 32.86..454.29 |
| Synthetic score/folio | 440 | 330×441 | 17.7 | 5.7 | 38.3 | 30.91..454.55 |
| Synthetic score/folio | 350 | 263×350 | 9.7 | 4.0 | 32.3 | 32..452.57 |

*Pipeline includes repeated `getTextContent()`, `getOperatorList()` (warm cached), one render, `getImageData()`, `cloneInto()`, and 25% sampling, without entire navigation, startup or disk-cache I/O. The measured `getImageData`/clone stages were usually 0–1ms each, so eliminating cross-compartment copy is NOT a high-priority speculative optimization. Synthetic score is NOT the user's original music-theory page.

Pixel-area change: 800→560 long edge reduces a typical full raster to ~49% area; for the 688-edge real text p10 to 560 it reduces area to ~66%. The 560 sampled edge differs by only ~1 PDF unit from the baseline real page and less than 1 for the synthetic score; the product retains a 16-unit safety pad. Still verify several real scanned/music PDFs before selecting a global default.

### 3. Majority scrolling CPU is driven by the requested higher reading scale

Prior controlled Zotero 0.1.2 experiment reported native page-width scale 1.171 vs smart-fit 2.267, ratio ~1.94× and native canvas pixel area ~3.74×. With matching scale, OFF vs ON exhibited no consistent large CPU difference. High-resolution native PDF.js repaint work after zoom cannot be removed by reducing the small offscreen detection raster. This is an inherent price of readable larger print. Do not describe smaller detect scans as fixing the 20%+ CPU observed during high-zoom continuous scrolling.

## Recommended implementation stages (ordered by likely overall benefit)

**P0 — Visible-page first / lazy background samples.**
- First render/fitting job: prioritize the *actual current page*, not the six remote L1 representatives. Do not make an explicit Fit command await unrelated L1 pages.
- Defer remaining parity/book samples until genuinely idle; initially test one sample for each needed parity, and acquire more only if parity models disagree or page geometry suggests a split.
- Keep a single shared page job to avoid duplicate renders. Handle uncertain page-number patterns by using current-page bounds first and applying any later refinement only after idle; avoid repeated visible zoom jumps.
- Existing L1-before-L2 invariant tests must be consciously updated to new scheduling contract, not disabled.

**P1 — Reduce detection raster from long-edge max 800 to candidate 560.**
- A/B against 800 using real text, scans, score staves, drawings, rotated pages. Preserve native display resolution, annotation layers, zoom scale and 16-unit fitting pad; only the detector raster changes.
- Compare 560 vs ~480 on robust ordinary pages after 560 passes. Do not blindly prefer 350 based on tiny pilot.
- Report separately render, getImageData, clone, scan, end-to-end detect and first-fit wall time.

**P1 — Skip unnecessary PDF operator parsing.**
- Current `detect()` calls `getOperatorList()` on pages where `suspectText` is already true and the result cannot bypass rendering. Move the `!suspectText` guard *outside* the expensive operator-list retrieval. Leave validated pure-text fast path unchanged.
- For blank/scanned pages without any text, the existing code already avoids the text-only operator path.

**P2 — Reduce needless background work.**
- L2 currently analyzes current page plus up to six neighbors after idle. Trial current±1 and opportunistic next-page only; mark prefetched hits and actual user visits so speculative renders must earn their cost.
- The legacy full scan after `sparseInkBox()` returns blank/dense/dark fallback is a candidate for skipping: return the full-page conservative record directly when no sparse evidence exists. Low priority for the common path, but removes waste for those classes.
- Avoid eager global re-analysis and duplicate render/page jobs; retain profile-local fingerprint cache. Existing `getImageData`/clone overhead is small in the pilot, so do not build a complex cross-realm bypass first.

**P3 — Avoid unnecessary native redraws.**
- Maintain the current 500ms idle threshold and 5% scale dead zone unless real same-scale traces show jitter. Investigate redundant automatic fit reapplication/scrollLeft writes only after fixed-scale scroll CPU profiling.
- Do not lower the user's desired smart-fit reading zoom merely to make CPU charts look favorable.

## Acceptance

For each proposed stage use isolated Zotero profiles. Retain published 0.1.6 compatibility and avoid user's real Zotero library modifications. Benchmark several actual documents under cold and warm cache conditions, separately report: first-use page-fit latency P50/P95, render count per opened PDF and per visited page, re-render counts, native smart-fit same-scale scrolling CPU, wrong-fitting important content, visible left/right margins.

The primary success criterion is **fewer total extra renders and a faster first visible fit at the same fitting quality**, not a theoretical pixel-access ratio. Any optimization should be dropped if improvement is within scheduling noise or it causes repeated visible zoom changes. No Release, updates.json change, or installed-plugin mutation without separate authorization.
