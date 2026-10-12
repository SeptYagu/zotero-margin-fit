# MarginFit v0.1.11 ? Continuous Fit Height

**Regular public release** for Zotero 10.0.5?10.0.x.

This release corrects the Fit Height interaction model, not just an isolated scroll bug.

## Expected behavior
- **Detect Margins ON + Fit Height:** determine scale using the current PDF page's detected content height, but retain Zotero/PDF.js's original continuous document and full-document scrollbar.
- Mouse wheel, touchpad, arrow keys, Page Down/Up, native page-number jumps and manual zoom retain normal PDF reader behavior. There is no synthetic "two swipes per page" or one-page-at-a-time state.
- A PDF left in single-page mode by a prior release is returned to native continuous mode on a fresh Fit request.
- **Detect Margins OFF:** uses Zotero's original native Fit Height behavior as before.

## Changes
- Remove all PAGE-mode activation, custom wheel interception, gesture accumulation and one-page navigation code.
- Keep the existing height content-bounds scale computation, per-page background cache, JSONL v0.1.9 persistence, and Width Fit folio handling.
- Historical v0.1.8 PAGE-mode experiment records remain archived for traceability, but are no longer active functional acceptance tests.

## Verification
- 91/91 unit tests passed.
- 20/20 isolated Zotero 10.0.6 continuous Fit Height regression checks passed.
- 10/10 separate isolated Zotero background indexing and JSONL persistence checks passed.
- Native acceptance checks cover: full multi-page DOM and document scrollbar, content bounds fitted to available viewport, native scrolling, page-number navigation, uncaptured wheel/Page Down events, manual zoom, and recovery from prior PAGE mode.
- Synthetic keyboard events verify the extension does not prevent the native action; testing all physical keyboard and touchpad devices is not claimed.
- No production Zotero profile, user PDF, annotations, or saved reading data were modified during testing.
