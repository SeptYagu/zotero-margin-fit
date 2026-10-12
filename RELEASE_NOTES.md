# MarginFit v0.1.10 ? Fix Fit Height page lock

**Regular public release** for Zotero 10.0.5?10.0.x.

When Detect Margins was active and Fit Height entered PDF.js's one-page mode, manual zoom could leave the reader with only one DOM-mounted page but without wheel-to-next-page handling, making the remaining PDF seem inaccessible.

- A manual scale change now immediately restores the prior native continuous-scroll layout. All pages remain accessible by standard scrolling.
- Clicking Fit Height again restores the deliberate one-page-per-turn fitting behavior.
- The existing page-turn gestures, far-away folio Width Fit, sparse detector, and v0.1.9 JSONL cache are unchanged.

## Verification
- 91/91 unit checks passed.
- 29/29 isolated Zotero 10.0.6 native Fit Height checks passed, including newly asserted mode restoration, multi-page DOM and re-entering Height Fit after manual zoom.
- v0.1.9 previously passed native 24/24 cache integration and 6/6 PDF rotation/IOUtils checks. Those tests were not rerun as part of this source-only Height Fit fix.
- A reported real-world lock may involve additional input paths; this fixes the reproduced manual zoom path and does not claim all possible UI input devices have been exercised.

User PDF files, annotations and the installed production Zotero profile were not modified during testing.
