# MarginFit v0.1.13 ? Fit Width / Height toggles

Regular public release for Zotero 10.0.5?10.0.x.

- The native Reset Zoom toolbar button is hidden. The plugin's Fit Width button takes its original toolbar position, with Fit Height and Detect Margins beside it. On plugin shutdown, the native button is restored.
- Fit Width and Fit Height are mutually exclusive on/off switches. Clicking the active button again turns that mode off, preserving zoom and scroll. Clicking the other activates it.
- Detect Margins is independent. With detection OFF, the two fit buttons call native Zotero width/height fitting.
- The fit-mode state is kept when opening new PDFs. Turning it off cancels pending automatic adjustments.
- Continuous scroll, full document scrollbar, content-page stepping, specialized folio handling and JSONL cache are unchanged.

## Verification
- 97/97 unit tests passed.
- 34/34 isolated Zotero 10.0.6 toolbar integration checks passed, including native button hiding/restoring, width/height toggling, detection-off fallback, delayed adjustment cancellation, and new-PDF mode state.
- 28/28 native continuous content-page navigation checks passed.
- 10/10 native background indexing and JSONL cache checks passed.
- Physical keyboard/trackpad device testing remains separate from these synthetic integration tests.
