# MarginFit v0.1.18 — More stable content fitting and complete two-page views

This release improves content fitting while keeping Zotero's native PDF layout, continuous scrolling, annotations, and existing cached page boundaries.

- **Fit Height keeps both sheets readable.** In Single, Odd Spreads and Even Spreads modes, MarginFit measures the topmost, bottommost, leftmost and rightmost detected content across the visible sheet(s), then chooses one shared zoom that keeps that content visible. The vertical safety gutter is now 5 PDF units (Fit Width retains its 16-unit safety).
- **Avoid the second zoom adjustment.** Before zooming, MarginFit checks the full-paper widths of Zotero's native spreads, including other pages that may trigger a horizontal scrollbar. When necessary, it reserves that scrollbar's height in the initial calculation, so an explicit Height Fit needs at most one scale write.
- **Smoother Fit Width scrolling.** Automatic width fitting follows actual content boundaries and waits until the outgoing page's content has left the viewport; small manual movements on the same page remain respected.
- **Improved page navigation.** Height page turns hook Zotero's navigation commands and reuse MarginFit's existing content alignment; single/odd/even spread behavior stays native.

No additional PDF raster scanning, cache-format migration, alternate renderer or per-page independent zoom was introduced. The original PDF and annotations are never changed.

**Verification:** 110 Node unit tests, isolated Windows Zotero 10.0.6 content-height and spread tests, six real viewer layout cases checking that all four content edges fit, and general reader / toolbar / caching regressions. Not all macOS/Linux configurations, scan edge cases or physical keyboards have been tested.

**Acknowledgment:** Thanks to [Dylan Awalt-Conley](https://github.com/dawaltconley) ([Center PDF](https://github.com/dawaltconley/zotero-center-pdf)) for suggesting the navigation-hook approach that inspired MarginFit's navigation improvements. MarginFit's implementation is independent; no Center PDF source code was copied.
