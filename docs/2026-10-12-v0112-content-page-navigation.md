# v0.1.12: Preserve free movement, restore one-content-page navigation

User-defined behavior:
- The complete PDF stays in native PDF.js continuous scroll with a full-document scrollbar.
- Wheel/touchpad and Arrow Up/Down remain precise intra-page controls, never auto-recentered while staying on the same page.
- When normal scrolling enters the next/previous page, finish on that new page's content center (not the physical PDF top or blank margin).
- PageDown/PageUp move one physical PDF page directly, centering its recognized content rather than scrolling a screen-height.

Small implementation:
- Reuse existing Controller.input() 75 ms trailing quiet-window, only calling snapToContent on a verified page change.
- snapToContent uses existing Session.visible cache/detector and Controller.apply in explicit navigation mode. No second raster render, no new worker, no custom wheel listener.
- PageDown/Up have one conditional keydown capture route; ordinary arrows are left to native handling.
- Keyboard uses Controller.page() as the current page (not potentially stale lastPage).
- No native PAGE mode, no PDF canvas cropping, no new persisted fields.

Evidence:
- 93/93 unit checks.
- 28/28 native Zotero 10.0.6 checks, including real 24-page document, full scrollbar, one-page content-center changes, fine 23-pixel scroll, cross-page scroll snap and restoration from prior PAGE mode.
- Native keyboard event testing caveat: debug-generated untrusted KeyboardEvent did not arrive at *any* test listener (including new listeners on native window and container), so its failure is a harness limitation, not a demonstrated failure of the new handler. Direct native snapToContent tests and JS unit keyboard-dispatch tests passed. Physical PageDown/Up still require manual confirmation.
- No hardware touchpad driver input events were synthesized. The scrollTop/manual adjustment path was exercised inside native Zotero.
- The v0.1.11 background/JSONL integration previously passed 10/10 and cache code is unchanged.

Prior versions v0.1.8?0.1.10 mistakenly equated one-page navigation with PDF.js ScrollMode.PAGE (which removed all but one DOM page). That design remains retired.
