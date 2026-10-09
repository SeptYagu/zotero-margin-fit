# MarginFit long-standing issues — repair candidate, 2026-10-09

Status: **unit-tested candidate on a separate branch; GUI test pending**. Not an accepted patch on main; not published to the update feed.

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

Validation:
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
