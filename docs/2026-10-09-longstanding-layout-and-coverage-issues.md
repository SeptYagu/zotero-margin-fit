# MarginFit long-standing issues — repair candidate, 2026-10-09

Status: **repair branch verified in isolated Zotero and pending merge**. GUI, PDF reader and cache regressions passed; public update feed stays v0.1.5.

User reports across multiple versions:
1. Content appears to have more left than right whitespace even when smart Width Fit is applied.
2. Some PDFs appear to be unaffected by the plugin.
3. Added Fit Height and Detect Margins buttons look dim gray, particularly in dark mode; ON/highlight contrast is weak.
4. Added buttons sometimes appear at the right side instead of adjacent to the native zoom controls.

Independent isolated Zotero 10.0.6 DOM audit prior to repair:
- Native zoomIn color: `rgba(255,255,255,0.55)`; plugin buttons: `rgb(64,64,64)`, so dark-mode contrast was demonstrably incorrect.
- Native zoom controls lived in `.start` at x≈53–117, plugin group was appended in a separate `.section` at x≈810–840.
- Cause: `renderToolbar` Zotero callback supplied `append` (targeting the right section), while fallback insertion used `zoomAuto.after(bar)`; existing connected bars were never rehomed.

Changes in this candidate:
- `positionToolbar()` anchors added buttons right after `zoomAuto`; discovery reapplies the invariant after toolbar reconstruction and handles temporary early append.
- Matches foreground color of native `zoomIn` via computed style on toolbar reconciliation, allowing theme changes without hard-coded white/black.
- SVG controls increased to 20 px and stroke width 2. Selected controls get an inset ring and higher-opacity background. Fit Height has `aria-pressed` linked to active mode; Detect Margins retains its ON/OFF pressed state.
- `Controller.metrics.lastHorizontalFit` captures requested and actual scrollLeft, max scroll range, effective left/right visible margins, delta and which fitting bbox was used. **This does not change horizontal alignment yet**: actual PDF screenshots needed to choose the correct fix.
- Uncertain PDF detection reason is included in the tooltip/status for known fallback classes (dark/nonwhite borders, blank, dense background, render failure, unreliable); **this does not expand supported PDF classes yet**.

Initial validation (2026-10-09; later superseded by the 2026-10-10 results below):
- 61/61 Node tests pass, including three new toolbar placement/theme-color tests, an actual-margin diagnostics test, and unchanged core tests.
- `npm run build` successfully builds 0.1.6 XPI.
- `tests/v016-ui-integration.js` documents required native Zotero checks: left native grouping, dark UI computed colors, pressed states, forced reparent recovery, actual margin metrics.
- GUI integration attempt through Remote Desktop Commander failed **before test execution**: Zotero debugger driver timed out and the result JSON was never created. The test is **pending**, not a failure of the repaired UI.
- The known separate 0.1.6 baseline had previously passed 70/70 Zotero tests; those results **do not** constitute validation of the new candidate.

Environment note: C: drive was full during the attempt. Cleanup removed only 75 historical generated `%LOCALAPPDATA%\Temp\ZoteroMarginFitTests` directories; the latest six and all official Zotero profiles were left untouched. Approx. 1.5 GB became available.

Next:
1. Run `npm run test:ui` and `npm run test:integration` in functioning *windowed* isolated Zotero; inspect computed-style and insertion-order assertions.
2. For a real affected PDF, record `lastHorizontalFit` and screenshot, distinguish scroll clamp vs content-bbox asymmetry and make a separate geometry correction only if proven.
3. Record `status.reason` on PDFs that do not fit tightly; distinguish legitimate conservative fallback from unsupported graphics or estimation errors.
4. Only then merge this branch into main, re-run the full acceptance matrix and consider an authorized release.

## Follow-up verification (2026-10-10)

Windowed isolated Zotero 10.0.6 GUI debugging successfully reconnected on the repair branch. UI checks passed 14/14 then 16/16. Verified: native zoom grouping, native dark-mode foreground, both selected states, repeated render callback, forced displacement and automatic restoration.

### Horizontal alignment measurement

On a real isolated-test PDF, requestedScrollLeft=392.67, actualScrollLeft=392, maxScrollLeft=767. Browser viewport rectangle was 990 CSS pixels wide including a 13-pixel scrollbar; actual scrollable clientWidth was 977 CSS pixels. The original diagnostic falsely measured left margin 8.67 and right margin 20.33 because it counted the scrollbar on the right only.

After correcting right edge to the scrollable client area (root.left + container.clientWidth), the same controlled PDF measured left 8.67 and right 7.33 CSS pixels, delta 1.35 CSS pixels. This is consistent with integer scroll rounding, not proven clipping. Do not change centering geometry on this evidence; the user's affected PDFs must be measured individually.

### PDF classes and regression

On this branch npm run test:integration passed 70/70 and npm run test:cache passed 21/21. Strict pure text pages use the no-raster fast path; clean scans and vector-rich real scholarly PDFs are analyzed; blank and dark background pages intentionally fall back to conservative view; wide figures remain horizontally scrollable. Thus the statement 'some PDF has no visible fitting' covers both intended safe behavior and possible unverified defects; the user's actual failing PDFs still need diagnostic samples.

Known fallback causes are displayed in the Detect Margins tooltip and remain visible across toolbar updates. Final isolated Zotero UI suite passed 18/18 on 2026-10-10 (run .test-harness/3bdc52a608f941c2985f7b91bb848c92). The full PDF reader suite passed 70/70 and the cache/synthetic score suite passed 21/21 on the repair branch. All results are from isolated profiles, not the user installation.

Do not release or update the public 0.1.5 update feed without explicit authorization, and do not modify the actual Zotero user profile.
