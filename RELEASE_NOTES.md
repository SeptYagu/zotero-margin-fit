# MarginFit v0.1.12 ? One-content-page navigation

Regular public release for Zotero 10.0.5?10.0.x.

This version combines the interaction requirements of v0.1.11 with content-page navigation.

- The right scrollbar and PDF.js layout still represent the **entire PDF**, not a single mounted page.
- Touchpad, wheel, and Arrow Up/Down retain **fine adjustment within the current page**.
- When scrolling enters a different physical page, MarginFit uses the existing 75 ms input quiet-window to position that new page's detected content vertically in the viewport. It does not snap back during a movement that remains on the same page.
- **PageDown / PageUp** are handled as exactly one neighboring PDF page and land on that page's detected content, rather than scrolling by one screen-height. Modified shortcuts and typing/editing controls are not overridden.
- The existing sparse boundary detection, far-away folio behavior, JSONL cache, and one-worker background indexing are unchanged.
- Old single-DOM-page PDF.js PAGE mode stays completely disabled.

## Verification
- 93/93 Node unit checks passed, including the one-page key calculation, stale page state, fine movement, and page crossing.
- 28/28 native Zotero 10.0.6 integration assertions passed for full-document scrolling, actual content-page landing, fine-grained 23px scrolling and cross-page snapping. Background cache regression is covered by prior v0.1.11 native results, with no cache code changes.
- **Hardware-key caveat:** the debugger's untrusted synthetic KeyboardEvent did not reach any native keydown listener; the native test therefore exercises the actual jump method directly while the key dispatch logic is unit-tested. Physical PageDown/PageUp keys were not independently tested on hardware; they still require practical confirmation.
- No real user PDF or production Zotero profile was modified.
