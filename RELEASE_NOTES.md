# MarginFit v0.1.17 - Native page-spread toggle and spread-aware navigation

This release makes Zotero's built-in PDF two-page layout easier to use, without a separate renderer.

- **New paper icon** immediately to the right of Detect Margins. Click to cycle through native Single Page, Odd Spreads (1-2, 3-4...), and Even Spreads (cover alone, then 2-3, 4-5...) settings.
- **Distinct icon states:** one hollow page for Single; filled left and hollow right for Odd; hollow left and filled right for Even. Changing the Zotero View-menu spread setting updates the icon.
- **Page Down / Page Up advance one visible spread in Fit Height**, with correct odd/even grouping, lone cover and unpaired last page. Single-page mode still steps one page.

Width/Height Fit, margin recognition, persistent PDF-bound caches, one-worker all-open PDF background indexing, continuous scrolling, and arrow-key navigation remain supported. Original PDF pages and annotations are not modified.

Validation: 102/102 Node unit tests; native Zotero 10.0.6 UI, spread, Height Fit, standard reader integration, cache, all-open indexing, annotation and active-reader suites. OS-level Windows PageDown/PageUp inputs in a disposable profile verified Odd Spreads 3 -> 5 -> 3 and Even Spreads 2 -> 4 -> 2. The project owner tested and accepted the private candidate's features and appearance.

Limitations: for highly mismatched adjacent page sizes or narrow windows, the target-page-derived Height Fit zoom may not fully display both pages simultaneously. macOS/Linux and every physical keyboard device have not been tested.
