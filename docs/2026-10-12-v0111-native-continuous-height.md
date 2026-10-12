# v0.1.11 ? Continuous content-height Fit Height

User acceptance requirement: when Detect Margins is ON, Fit Height must behave like
Zotero's native Fit Height with Detect Margins OFF, except the fitting dimension is
the detected content height rather than the physical PDF page height.

Previous design failure (v0.1.8?v0.1.10):
PDF.js scrollMode=3 (PAGE) physically unmounted all but the current page from the
viewer. The scrollbar no longer represented the whole PDF; native arrow keys
and Page Down no longer had their usual continuous behavior. A custom wheel-to-page
handler was insufficient, requiring extra touchpad swipes and blocking normal access.
v0.1.10 only addressed one manual-zoom lock path, not the wrong interaction design.

Actual fix:
1. Delete PAGE-mode, single-page navigation and wheel interception code from runtime.
2. Continue using the existing content-height scaleDecision plus native PDF.js zoom and
   scrollTop positioning; all ordinary scroll/page/keyboard event handling remains native.
3. If the reader is still in PAGE mode from a previous release, set scrollMode=0
   (native vertical continuous mode) on detected-content Fit requests/startup.
4. Preserve user-controlled pan/scroll without micro-centering or snapping.

Tests:
- 91/91 unit regression checks passed.
- 20/20 real Zotero 10.0.6 continuous-document integration checks passed.
- 10/10 separate background indexer and JSONL cache integration checks passed.
- New isolated Zotero integration test tests/v0111-continuous-height-integration.js.
  Confirms a 24-page PDF keeps multiple/all DOM pages, full-document scrollbar,
  content fitting inside viewport, native scroll and page-number jumps, native wheel
  and Page Down events not intercepted, manual zoom, and old PAGE mode recovery.
- Synthetic untrusted input events are not claims of full hardware behavior.
- Previous tests/v018-height-integration.js tests the intentionally retired
  one-page design and must no longer be run as a current acceptance test.

No cache format change, file migration, background scheduler or geometry algorithm
refactoring was required.
