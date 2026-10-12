# MarginFit v0.1.7 — P2 targeted neighbor prefetch

Date: 2026-10-11
Branch: `fix/v017-actual-visible-ink-width`
Status: implemented on development branch; **not publicly released or installed**.

## Changes
- Before: current page and up to 6 nearby pages (3 forward, 3 back).
- Now: current page and at most 2 immediate neighboring pages, with the direction of the most recent page turn first. Reading backward reverses the priority.
- Neighbor prefetch precedes the six distant L1 representative samples, so near-future reading pages are cached sooner. The single serialized detector worker and 500 ms idle gate remain.
- Existing versioned disk cache and de-duplication remain: an already cached neighbor is not rendered again.
- Session metrics now track unique visited pages, newly rendered speculative neighbors, and actual prefetch cache hits. A hit is counted only if speculative rendering finished before first visit with the same rotation; this conservative definition can undercount in-flight reuse.
- When a sparse sample finds no reliable evidence (dark edges, blank or missed, or dense background), immediately return full-page conservative fallback. Do not perform a second full-image pixel scan merely to confirm the fallback.
- No change to 560px detector canvas, 25% sparse sampling, 16 PDF-unit safety margin, native PDF resolution, PDF bytes, annotations, or plugin UI.

## Results in disposable Zotero 10.0.6
- Unit tests: 72/72 passed, including actual navigation-direction regression.
- Integrated Zotero reader: 76/76 passed, covering initial page detection, prefetch order, user-held positions, scrolling, annotations, split panes, and detached windows.
- Cache/folio test: 21/21 passed; no repeat of previously cached L1 sample pages.
- UI test: 18/18 passed; native toolbar alignment, and measured visible margins remain correct.
- Integration on restored page 8 observed 2 actual speculative neighbor renders and 1 initial unique page visit before moving; no hit expected at this point.
- Same integration PDF previously recorded 10 initial detector records under six-neighbor plan, versus 9 under this narrow-neighbor run. This is an **individual workload observation**, not a universal percentage or a CPU benchmark.
- Theoretical maximum neighbor renders for a cold, uncached, long document falls from 6 to 2 per settled page (before overlap with L1 or already visited pages).
- Offscreen full-image fallback pass is removed, leaving safe full-page display when sparse evidence is insufficient.

## Limitations / subsequent evaluation
- Six L1 representative samples remain, chiefly supporting conservative parity estimation and serial folio-number verification. Conditional/adaptive L1 sampling is a separate change requiring broader PDF validation.
- No controlled P50/P95 wall-clock first-fit dataset, measured sustained Zotero CPU reduction, or wide real-world scan/music-page corpus is yet available; do not claim those improvements.
- Keep local untracked performance probes untouched. Leave published v0.1.6, updates.json, and the user's installed Zotero profile unchanged.
