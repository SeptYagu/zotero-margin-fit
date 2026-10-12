# MarginFit v0.1.7 — respect manual page position and avoid micro-centering

Date: 2026-10-10
Branch: `fix/v017-actual-visible-ink-width`
State: **implemented and verified in isolated Zotero 10.0.6, not released**.

## User-reported behavior and root cause

The reader was pulled back toward the plugin's exact geometric center after the user manually dragged, panned or scrolled inside a page. Even when the adjacent page's detected content frame differed by only 1–3 CSS pixels, `Controller.apply()` unconditionally reassigned `container.scrollLeft`, scheduled an asynchronous layout turn and waited another 50ms to suppress its own scroll event. Since each input created a new epoch, a later idle refinement could repeat this recentering. This was unnecessary visual jitter and browser scroll/layout work, not a new boundary-detection failure.

The user clarified that the second symptom frequently arises because **two nearby pages naturally have slightly different margins**, not because the algorithm always measures the same page incorrectly.

## Implemented behavior

1. `userHeldPage` marks a user-controlled page when wheel, touchmove, actual native container scroll, or keyboard scrolling is observed. Normal pagechanging, resize and rotation callbacks alone do **not** claim user control.
2. For as long as the currently visible page is the held page, automatic `apply()` cannot change zoom or position. Cache/detection work may proceed without snapping.
3. When the actual visible page changes, the hold resets and the normal automatic fit may run on the new page. A click/shortcut/menu explicit Fit Width/Fit Height request also clears the hold immediately and intentionally recomputes the fit. Toggling plugin OFF/ON resets it.
4. All *automatic* horizontal scroll position updates have a **4 CSS-pixel deadband**, measured against the current scrollLeft and clamped to the real scrollable range; explicit user Fit commands use a 0.5px threshold. The same write threshold applies to automatically required vertical anchor compensation.
5. Do **not** assign `scrollLeft` or `scrollTop` when their positions are already within tolerance. Do **not** schedule the previous unconditional 0ms layout-turn delay when scale stays unchanged, or the 50ms self-scroll settling delay when no position was written.
6. Real position writes remain separately tracked in `Controller.metrics.writes`. Skipped no-op corrections are counted in `metrics.skippedPositionWrites` for future performance checks.
7. Keep the established 500ms idle gate for genuinely necessary automatic fitting, native reading scale, user-restored viewport coordinate, PDF.js text/annotation layers, and 16 PDF-unit safety margin. The planned visible-page-first and lower-resolution render improvements are not implemented in this stage.

## Regression

- `npm test`: **68/68 passed**, including new tests for (a) same-page user pan hold, (b) automatic fit resuming on next page, (c) explicit fit overriding manual hold, and (d) 2.5px adjacent-page offset not writing scrollLeft or adding 50ms delay.
- `npm run test:integration`: **74/74 passed** in isolated Zotero 10.0.6. Previous expected *automatic recentering* after a manual scroll is deliberately replaced by an assertion that the final user position is retained and cache prefetch can complete. Added native interactive check confirms a horizontal wheel/pan on page 8 stays in place and explicit Fit Width re-centers when requested.
- `npm run test:cache`: **21/21 passed**.
- `npm run test:ui`: **18/18 passed**, preserving native dark-theme controls and positioning.
- Local `npm run build`: **passed**, created `dist/zotero-margin-fit-0.1.7.xpi` (23,503 bytes). No GitHub release or `updates.json` modification.

## Practical tradeoff and future work

The page may be naturally off-center by up to roughly four CSS pixels, because avoiding visible movement is more valuable than maintaining a mathematically exact center on two slightly different adjacent layouts. If the user intentionally moves the page much farther, **the plugin will not override them until they leave that page**.

This change reduces redundant scroll assignments and delayed callbacks but has **not** yet been demonstrated to reduce steady-state Zotero CPU by a specific percentage. The next separately prioritized optimization stages remain: visible page before L1 bulk analysis, target raster 560px, skip unused operator-list construction, limit neighbor prefetch, and evaluate native high-scale rendering CPU.

Only disposable Zotero test profiles are used. The user's live Zotero library and installed v0.1.6 are not changed.
