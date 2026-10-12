# Fit Height manual-page lock ? reproduced and fixed

Date 2026-10-12, isolated Zotero 10.0.6, MarginFit v0.1.9 baseline.

## Reproduction
- Fit Height sets PDF.js native scrollMode=3 (PAGE), which keeps one physical page in the DOM at a time.
- The plugin translates wheel events to page changes only when !manual.
- A native scalechanging event sets manual=true, and the old code did not leave PAGE mode.
- In a real Zotero test, wheel on the page moved 1->2, container wheel moved 2->3;
  forcing the manual state left a subsequent wheel at 3->3.
- This is a reproducible dead end under manual zoom, not a lost PDF page.

## Minimum fix
In the existing scalechanging callback, after marking manual zoom, call leaveHeightMode()
if PAGE mode is active. This restores the previously selected native scroll/spread
layout; existing code already handles the cleanup. Explicit Fit Height re-enables
PAGE mode and resumes per-page zoom. No added timers, handlers or data structures.

## Validation
- 91/91 unit tests (previously 90).
- 29/29 isolated Zotero native height tests (previously 26): manual zoom exits PAGE,
  full multi-page DOM returns, and a subsequent explicit Fit Height re-enters PAGE.
- No change to JSONL cache, PDF coordinate detection, or document bytes.

## Scope
Does not assert every device-specific trackpad gesture or every Zotero native mode
switch was reproduced. This fix addresses the actually confirmed manual-zoom path.
