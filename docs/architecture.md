# MarginFit ? Current architecture (v0.1.14)

This document describes the current shipped design, not the historical v0.1.0?v0.1.13 proposals. Archived v0.1.2 architecture: [historical version](architecture-v0.1.2-legacy.md). Source of truth: `src/core.js`, `src/runtime.js` and `src/persistent-cache.js`.

## UI

The native Zotero Reset Zoom button is hidden with the plugin toolbar's stylesheet. The plugin's Width / Height / Detect controls take its original position. On unload the stylesheet and toolbar are removed and native Reset Zoom reappears. Fit mode is one saved preference: `width | height | off`. Buttons are mutually exclusive toggles. Detect Margins is an independent saved boolean, and OFF falls back to native Zotero width/height commands.

## Fitting and scrolling

Current page exact bounds are used in PDF.js scale-one viewport coordinates. Visible page first, followed by only immediate neighbor prefetch. Sparse 560px detector with conservative text/ink reconciliation, dirty-border rejection and full-page fallback. 16 PDF unit safety padding at fit time. A verified isolated folio can be ignored in **horizontal** fit while preserving the vertical extent. No eager six-page parity prediction is applied to unmeasured pages.

Native PDF.js multi-page vertical scroll is retained. Free wheel/touchpad/up/down motions remain available within a page, with one content-center landing after crossing a physical page. Page Down/Up each move exactly one physical PDF page, aligning detected content. In Zotero 10.0.6 on Windows, actual OS PageDown/PageUp events are dispatched to the **main Chrome window**, while ArrowDown reaches the inner PDF frame. Therefore a scoped top-level capture route delegates PageDown/Up to the selected reader's `snapToContent`; text editing and modified shortcuts are excluded. The PDF document layout is never changed to single-page PAGE mode.

## Cached geometry

Append-only, line-based JSONL store with version header and last-write-wins page records, each containing only the four boundaries. Key uses PDF.js fingerprint(s) and page count; supports out-of-order writes and partial trailing records. No migration from abandoned old snapshot JSON. Persistent output is never a PDF edit and contains no document text.

## Background indexing

There is ONE cooperative `IdleIndexer` for the extension. Foreground and visible neighbor jobs outrank it. Reader selection follows the focused detached reader or selected tab in Zotero's foreground main window; it reuses the existing 500ms reader-discovery interval, no extra window watcher. Only the **currently active incomplete PDF** is indexed. Once complete, the worker stops; background scans never target hidden/inactive reader iframes because PDF.js's hidden render task may stall. On selecting an incomplete PDF it resumes.

Different PDF view instances may keep independent rendering and geometry caches. Mode preference can be shared, but a mode change in one reader must not silently zoom or move an inactive/split pane.

## Verification and limits

[Current verification](verification.md) contains the tested Zotero 10.0.6 results; all integration profiles and PDF fixtures are disposable. Windows OS-injected key tests reached the top-level route and caused 8 -> 9 -> 8 content-page steps. This is not proof of all physical keyboard, macOS, Linux or touchpad hardware variants. Unsafe six-sample parity prediction remains disabled; unconditional raster-first remains disabled because true pure-text pages become much slower.
