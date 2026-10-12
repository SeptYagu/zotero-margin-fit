# MarginFit v0.1.7 — Adaptive book-wide sampling

Date: 2026-10-11
Branch: `fix/v017-actual-visible-ink-width`
Status: development implementation, isolated Zotero 10.0.6 validation, NOT released.

## Product observation
After visible-page-first P0, the running controller no longer consumes the parity prediction model from the old six-page L1 process. The only surviving runtime justification for sampling distant pages is to corroborate a pure-text page-number (folio) sequence. Six unconditional page renders per new PDF are unnecessary for scanned, graphical, notation, vector or otherwise noncandidate pages.

## New runtime policy
1. Detect current visible PDF page exactly, then at most its two immediate neighbors during the existing idle window.
2. If the current page is not a reliable pure-text fast-path record with a standalone folio candidate, **skip the entire distant six-sample L1**. Skip on short (<4-page) PDFs too. Leave the full-page/raster geometry unchanged.
3. For a qualifying current-page folio candidate, reuse current and already-cached adjacent pages as evidence, then lazily test the existing representative sample pages only if needed. Require **at least four independent pages** with a consistent page-number offset and a matching relative location. Confirm that the resulting pattern matches the original current page before applying any folio exclusion.
4. Stop immediately once four-page corroboration succeeds. No arbitrary 6-page minimum. If it never succeeds, keep original full text bounds; avoid another complete attempt for the same unsuccessful current-page/rotation combination.
5. Use the same serial detector worker and 500ms scroll idle check, including cancellation and retry when scrolling intervenes. Retain the user-position hold and 5% zoom dead zone.
6. Track `folioSkipped`, `folioValidationRenders`, `folioEarlyStops` in session metrics.
7. The legacy explicit `l1()` helper remains for compatibility/regression tests but is not called by the production PDF controller.

## Observed isolated Zotero regression
- Unit tests: **75/75**, including ordinary pages skipping global analysis, constant footer years rejected, four-page early stop, cache reuse, and interruption/resume.
- Zotero reader integration: **76/76**, including PDF text/annotations/scrolling/toolbar/split view and manual page position.
- Cache/folio integration: **21/21**, including native notation/synthetic score, known consistent folio, false-positive constant footer, and persistent current/neighbor record reuse.
- v0.1.7 ordinary fixture open: **3 recorded page detections** (current page 8 plus pages 9 and 7), compared with **9 detections in the P2 implementation** of the same test fixture (which still sampled six unrelated L1 representative pages). This is a **workload-specific render-count reduction**, not a demonstrated proportional CPU or wall-time improvement.
- Exact content recognition and cache values remain consistent with existing test tolerances.

## Release constraints
Run fresh combined regressions and build before committing. No changes to public v0.1.6 release, update feed, or user's installed Zotero. Leave the three pre-existing untracked probing scripts untouched. More representative real-world PDF sampling and repeatable cold/warm CPU measurements should precede a production release.
