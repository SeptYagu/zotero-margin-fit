# Margin Fit v0.1.8 — Content-height page-turning mode

Date: 2026-10-11
Status: product behavior agreed in principle; PDF.js native-mode feasibility **verified**; **not implemented, not released**.
Branch: `feat/v018-content-page-turn`.

## Exact product goal

When the user selects **Fit Height / 适合高度**, treat each PDF page as a discrete reading unit. Render **one and only one PDF page at a time**, maximize its **detected content's vertical extent** within the scrollable reader viewport, and hide the unused **top and bottom paper margins by placing them outside the viewport**. A mouse-wheel notch should show the *next/previous page's content*, not shift the current page by a few lines.

This does **not** mean shrinking the whole physical PDF page to fit the window. Nor does it mean raster-cropping, rewriting the PDF, changing annotation coordinates, or sacrificing text selection. Preserve the content boundary's existing 16 PDF-unit safety padding.

Content-width may exceed available viewport width; horizontal pan remains available. Height fitting primarily constrains vertical content, not physical paper dimensions or horizontal width.

**Fit Width / 适合宽度** retains existing continuous-scrolling behavior. Switching back from Fit Height must restore the user's prior native scroll/spread mode without affecting other Zotero tabs or writing a persistent global Zotero setting. Detect Margins OFF restores Zotero's normal reader behavior.

## Source-level findings and real Zotero 10.0.6 proof

Zotero's embedded PDF.js already supports `pdfViewer.scrollMode=3` (PDF.js `ScrollMode.PAGE`). It does **not** require a custom page renderer:
- Real isolated Zotero 10.0.6 + official Margin Fit 0.1.7, using a 24-page asymmetric generated fixture: native `scrollMode=0` created **24** page elements in the PDF viewer; setting `scrollMode=3` reduced the viewer to **1** page element while staying on PDF page 8. Assigning `currentPageNumber=9` changed the visible page and maintained a single page element.
- With content-height fitting on PDF page 8: view height **456 CSS px** while the *entire page* was **645 CSS px** high. Page physical DOM top and bottom were approximately **−90 px** and **+555 px** relative to the viewport. The detector content extent `[top,bottom]=[138.57,651.66]` PDF units, at actual page scale roughly `645/800=0.80625`, thus appeared from approx. **22 px to 435 px** of the 456 px viewport. This meets the requested geometry: full content visible, paper blank ends off-screen.
- The native page-mode setter did not throw and navigation succeeded. The **16-unit protected content box was quantitatively confirmed** inside the viewport from **8.8 px to 448.3 px** out of **456 px**, despite the physical page extending outside the viewport at −90 px and +555 px. Returning to the original scroll mode restored the original continuous page layout. **These observations do not yet constitute end-to-end wheel-gesture verification**, nor do they establish no annotations/search regression.
- Existing v0.1.7 `Controller.apply` vertically recenters only on explicit request or scale change; after a same-zoom page navigation it can leave the new content misaligned. Mode switching alone does **not** solve the whole feature.

Reproducible verification: `npm run test:page-mode-probe` executes `tests/v018-page-mode-probe.js` inside a disposable Zotero 10.0.6 integration profile. It asserts that native PAGE mode has a single page DOM element; content bounds, including 16-unit padding, fit inside the viewport while the physical page is taller; page-number navigation preserves one page; and restoring the original scroll mode brings back continuous layout. **Second, automated assertion-based run passed**. Both probe results are local and ignored under `.test-harness/`. No user's PDF or production profile was altered.

See publicly documented PDF.js `ScrollMode.PAGE` and Zotero users' single-page-scrolling request. Zotero does not currently offer the combined content-height paging workflow as a single built-in command.

## Implementation design

**1. Mode lifecycle and isolation**

- Add a per-`Controller` `heightPageMode` flag and preserve `previousScrollMode`, `previousSpreadMode` before first activation.
- On enabled `request('height')` or reopening a saved height-mode reader: set `viewer.spreadMode=0` (one page, no odd/even spread) and `viewer.scrollMode=3` only if supported, without installing global hooks/patching PDF.js code. Keep a feature probe and safe fallback if the native mode differs on newer Zotero versions.
- On `request('width')`, disabling detection, unloading, or restoring native UI: restore original scroll/spread modes **only if still controlled by Margin Fit**; avoid overwriting deliberate user changes. Listener/timer cleanup must be idempotent.
- Apply only to the active PDF reader/controller; tab/split/window controllers retain separate state.

**2. Render the content viewport, not physical page**

For PDF page `p` with reliable raw ink bounds `[left,top,right,bottom]`, existing `safeBox` provides `[l,t,r,b]` with ±16 PDF units padding and clipping to page boundaries.

Let `K` be PDF.js viewport CSS pixels per PDF unit, `H` the scrollable container height with a small viewport padding `M`. Target scale:

```
scale_p = min(MAX_SCALE, max(MIN_SCALE, (H - M) / (K * (b - t))))
pageTop_p = cumulative DOM offset for current page
scrollTop_p = clamp(pageTop_p + K * scale_p * (t + b) / 2 - H / 2)
```

Use actual PDF.js `unitScale` correctly: `getPageView(p-1).viewport.scale / viewer.currentScale`. Prefer the existing exact `scaleDecision` for source of dimensions and safety, with a page-turn-specific policy that **always centers the next page's detected safe content even when zoom stays within the 5% dead zone**. This is a positioning requirement, not a demand to zoom unnecessarily.

After setting `scrollMode=3`, calculate against the current page's new DOM geometry *after* PDF.js has attached/reflowed the page. Use guarded `epoch/token` checks. In no case synthesize a separate cropped bitmap or shift text and annotation layers by CSS transforms.

Reliable full-height ink fit is the success criterion; avoid clamping height by full physical PDF paper. Respect MaxScale and unusual geometry limits. If ink bounds are unreliable, use **the full physical page for that page only**, and retain discrete paging. Never zoom a dense scan to an untrustworthy tiny area.

**3. Discrete page input**

- Install a `wheel` listener on the PDF scroll container with `passive:false`, in capture phase if necessary, only while enabled height page mode is active. For vertical wheel events targeted at the document, `preventDefault()` to stop browser pixel scrolling; translate direction to `viewer.currentPageNumber = clamp(current ± 1,1,pageCount)`.
- A conventional wheel notch should advance one page, and reversing the wheel should return one page.
- **Touchpad/pixel wheel** events require accumulated delta with a threshold and short gesture lock so a single inertia burst cannot accidentally flip 5–10 pages. Normalize `deltaMode`, with separate per-device policies and test both. Do not throw away intentionally separated wheel notches merely because they arrived quickly.
- Ignore `ctrlKey` or `metaKey` zoom gestures, horizontal wheel (`deltaX`/Shift), and wheel events in nested selectable / scrollable UI (search, annotation editor, popover). Prevent interference with text selection and touch input.
- Map Zotero's next/previous buttons, page-number input, arrow/PageUp/PageDown keys (where not editing text), TOC jumps, search jumps, and bookmark jumps to the *same* `showContentPage(p)` transaction. Do not rely exclusively on wheel. Keep native buttons and links functional.
- Any change to physical page triggers immediate exact-page fit/centering, reusing cached bounds. Do **not** wait for the standard 500 ms prefetch idle delay before restoring vertical content alignment.
- On manual zoom/pan beyond the content-fit policy, avoid trapping the user. Temporarily allow normal intra-page scrolling when zoom is manually changed, and resume strict content-page mode on explicit Fit Height (or define/retest an explicit page-exit policy). Never use an arbitrary auto-snapping timer to undo manual actions.

**4. Stability and edge cases**

- Virtualize/attach only current page using native PAGE mode; keep existing session neighbor prefetch and serial detector worker unchanged unless the native mode changes page visibility assumptions.
- Suppress self-generated `scroll/pagechanging/scalechanging` events via existing `muted` and token guards; no double turn or timer feedback loop.
- Initial open, restored-page location, split views, rotations, PDF reloads, different paper sizes, cover pages, blank pages, and dark backgrounds all require testing.
- If page content is very short, maximize within `MAX_SCALE`, preserve extra screen background space, and avoid unwanted zoom to 500% on a near-empty header/title page (consider a **height-mode-specific enlargement cap** subject to actual UX testing).
- If the PDF is larger than the viewport horizontally, center the content but allow normal horizontal panning, and preserve it until navigating away, without horizontal wheel being converted into a page turn.
- Never alter the PDF or original annotations.

## Concrete acceptance tests

1. A page with large *physical* top/bottom white margins: after Fit Height, only **one page exists in the rendered viewer**, content's entire protected `[t,b]` interval lies inside the viewport, blank outer margins are mostly offscreen, and canvas text/annotation DOM remains original.
2. Three consecutive wheel detents advance exactly three pages; one reverse detent goes back exactly one page; trackpad swipe/inertia does not cascade unexpectedly.
3. A page with virtually no margins, a short title page, a small score, a scanned-image page, and a rotated page each remain fully readable; fallback shows full page without cropping.
4. Repeated switching 1→2→1→2, different page dimensions, and 30 rapid page turns never put page content above/below viewport or show two pages at once; re-centering after same-zoom turn is explicitly checked.
5. With manual zoom, mouse dragging, selection, annotation editing, TOC/search jump, nested UI wheel, and text input focus, there is no lost input or forced re-centering. Ctrl+wheel and Shift+wheel retain their native purposes.
6. Switching back to Fit Width or disabling the plugin restores the previously selected Zotero scroll/spread layout; second view / another tab unaffected; disabling/unloading restores all hooks.
7. All existing unit, integration, caching, UI, real-PDF boundary and performance tests stay green. Avoid reintroducing unnecessary global page detection.
8. A dedicated performance regression confirms the PAGE-mode implementation does not add high-frequency geometry scans or synchronous redraws per wheel tick.

## Recommended engineering sequence

1. Feature-probe and test native `scrollMode=3` lifecycle, including saving/restoring prior mode.
2. Add one `showContentPage(p)` transaction with exact page fit and content-box centering, independent of wheel.
3. Add wheel/keyboard gesture adapter with device-sensitive edge conditions; ensure all navigation paths converge.
4. Test real PDF documents and scanning score files, including wide landscape pages, across actual Zotero 10.0.6 isolated profiles.
5. Only then expose stable v0.1.8 functionality, with an easy escape to normal continuous scrolling via Fit Width / OFF.

Do not publish over v0.1.7 until complete integration acceptance. Existing production Zotero and published GitHub Release remain unchanged.
