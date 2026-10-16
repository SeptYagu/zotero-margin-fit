# MarginFit v0.1.19 — Stable Fit Width across consecutive pages

Fit Width now uses a continuous shared horizontal position for pages with compatible detected content bounds. This reduces the distracting left/right repositioning that can occur while reading a PDF.

- **12 PDF-unit safety margin** for the shared horizontal position, chosen after comparing 12, 14 and 16 units across two independent batches of 140 PDFs (6,108 analyzable text-boundary pages).
- **No anticipatory movements.** MarginFit keeps the current horizontal position while it remains safe; it moves only as far as needed when the currently viewed page makes the shared position invalid.
- **Simple handling of unusual pages.** An incompatible page starts a fresh continuous group; the plugin does not try to carry the previous group's position past it or snap back later.
- **Content visibility has priority over the 4px jitter guard.** This preserves the detected content even when a small but necessary horizontal correction is required.
- **No changes to Fit Height, Zotero native two-page rendering, detection-off fitting, or the original PDF and annotations.** The existing raster/ink detector and its conservative full-page fallback remain unchanged.

**Validation:** 115 automated Node tests; an isolated Zotero 10 test of 34 particularly difficult PDF pages with the actual MarginFit detector and viewport positioning (34/34 detected content areas visible at 12 units, including musical examples, images, edge text and original printed borders); plus general isolated Zotero integration regressions. The manually inspected 34-page set showed no meaningful information loss. This is strong targeted evidence, not a guarantee for every unusual PDF or operating system.

Release contains no new preferences, extra timers, alternate renderer, or additional PDF scanning.
