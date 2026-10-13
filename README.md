# MarginFit

**Smart content fitting and persistent margin detection for Zotero 10 PDF readers.**

MarginFit 隐藏 Zotero 原生 Reset Zoom，并在同一位置提供 **适合宽度、适合高度、识别边界** 三个按钮。它保留完整 PDF 的连续滚动、页内微调和阅读位置。

## Current release: v0.1.17

The original Zotero Reset Zoom button is hidden while MarginFit runs; it is restored when the add-on is disabled or uninstalled. The plugin supplies its own **Fit Width**, **Fit Height**, **Detect Margins** and a native **Page Spreads** button in the original toolbar location.

The rightmost **Page Spreads** button cycles Zotero's built-in PDF display: one outlined page (single), filled-left/outlined-right (Odd Spreads, 1-2, 3-4...), and outlined-left/filled-right (Even Spreads, cover alone then 2-3, 4-5...). Changing the native View-menu setting also updates the button.

Fit Width and Fit Height are mutually exclusive **ON/OFF toggles**. Click the active fit again to turn it off without altering the current zoom or scroll position. Switching to the other mode activates that fit. With Detect Margins disabled, the fit buttons use the original Zotero page-width/page-height functions.

When Fit Height is active, Page Down / Page Up step by one PDF page even with Detect Margins OFF (using native page boundaries); with detection ON they align the actual content. When detected-content Fit Height is active, the entire PDF remains in native continuous layout, including the full-document scrollbar. Small wheel/touchpad movements and Up/Down arrows remain free within a page. Crossing into a different page aligns the newly visible page to its content. Page Down / Page Up step one *native page spread* at a time in Fit Height (a single page in Single mode, whole paired spreads in Odd/Even mode). Windows main-window key routing is supported from v0.1.14. Fit Width also re-centers the content once when entering a different page, without undoing later manual adjustments on that page.

## Detection and cache

- The visible page is detected first, followed by its immediate neighbors. The sparse 560-pixel-long-edge raster detector and reliable text geometry provide four content edges.
- Text-only PDF pages may use a strict drawing-operator allowlist to avoid unnecessary rasterization. Complex scans, graphics, dirty borders and uncertain pages use conservative fallbacks.
- Fit Width uses a **16 PDF-unit safety margin**, while Fit Height uses a **smaller 8 PDF-unit top/bottom margin**, preserving printed page numbers where needed. An identified faraway folio may be excluded from **width** fitting while the full vertical content extent is retained.
- A compact append-only **JSONL** cache stores four page coordinates, keyed by PDF.js fingerprints and page count. Older snapshot JSON caches are intentionally ignored without migration.
- The one shared background worker **finishes the currently active PDF first**, then automatically indexes other still-open PDFs until all are cached. Changing the active PDF preempts other scanning. Hidden PDF rasterization uses non-RAF print intent while protecting display-only annotations. Fit Width/Height OFF does not stop caching; the Detect Margins master switch does.
- No OCR, network analysis, PDF-content rewriting or annotation-coordinate changes.

## Installation

Get the current XPI from [GitHub Releases](https://github.com/SeptYagu/zotero-margin-fit/releases), then use Zotero **Tools → Plugins → Install Add-on From File**. Existing installations use Zotero's automatic update feed at `updates.json`. The project targets Zotero 10.0.x private reader interfaces.

## Build and verification

Requires Node.js 20+ for build and unit testing, and Zotero 10.0.x for native integration:

```sh
npm test
npm run build
npm run test:integration
npm run test:spread
npm run test:ui
npm run test:height
npm run test:background
npm run test:cache
npm run test:active
npm run test:all-open
npm run test:annotation
npm run test:fit-off-cache
```

Native tests create **disposable Zotero profiles** and import generated PDF copies. They do not modify your production Zotero database or PDF files.

The OS keyboard-routing test is `tests/v0114-os-key-input.js`. It requires sending real operating-system Page Down / Arrow Down / Page Up inputs to its *isolated test Zotero window* during the test; ordinary synthetic JavaScript events do not cover Firefox's main-window handling. Physical hardware devices beyond that input test remain a separate manual check.

See [current architecture](docs/architecture.md), [verification summary](docs/verification.md), [release policy](docs/RELEASE-POLICY.md), [engineering principles](docs/ENGINEERING-PRINCIPLES.md), and the [v0.1.15 restored all-open indexing report](docs/2026-10-12-v0115-all-open-background-indexing.md).

## A/B decisions (v0.1.14)

- Six-page odd/even boundary prediction: **not enabled**. Independent raster-reference checking found predicted crop boxes outside the 16-unit safety allowance on some unseen pages.
- Raster-first on mixed graphics/text pages: **not enabled globally**. Measured gains for complex pages did not justify removing the very fast pure-text path; page classification needs its own safely measurable gate.

Dated design plans, historical tests, and `CHANGELOG.md` are archives of how the product evolved, not definitions of the current UI.

Licensed under MIT.
