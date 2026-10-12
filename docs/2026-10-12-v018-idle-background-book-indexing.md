# Margin Fit v0.1.8 — Idle, book-wide border pre-indexing

Date: 2026-10-12
Status: design / not yet implemented
Branch: `feat/v018-content-page-turn`

## Goal

After opening a PDF and finishing **foreground work for the actually visible
page and its immediate neighbors**, use the user's quiet reading time to
progressively detect and persist **all remaining pages' four content-border
coordinates**. On later page turns, v0.1.8's Fit Height single-page view should
normally read the already prepared border instead of blocking on an on-demand
scan. A reopened PDF should resume only the missing pages.

This is a CPU/detector **idle-work** policy, not a PDF.js display pre-render
system. Never render thumbnails or prepare PDF.js visible canvases here.
No overlays, loading UI, held old frames or waiting for PDF.js's paint events.

## Existing v0.1.7 components to reuse

- `Session.serial()` already processes one detection at a time **per PDF
  session**; `Session.visible()` is the current-page foreground path.
- `Session.local()` detects the current page and at most two adjacent pages,
  then conditionally corroborates a text-page folio. It **does not** currently
  sweep the remaining book.
- `Session.cache` is shared by views of the same live `PDFDocumentProxy`;
  disk cache survives reopening. `read()` skips a valid cached page and
  `schedulePage()` asynchronously persists new results.
- The existing offscreen detector uses a capped 560-pixel raster and sparse
  pixel sampling; reuse it unchanged rather than making a second detector.

## Scheduling contract

1. On opening, **first** load the fingerprint/page-count cache, identify and
   fit the visible page, and complete the at-most-two neighbor prefetch.
   Ordinary foreground browsing or explicit Fit must never wait for the
   book-wide sweep.
2. **Initial warmup only:** after the visible page and neighbor detection is
   complete, give the reader approximately **2 seconds to settle** before
   beginning the first book-wide scan. After indexing begins, do not reset
   this full warmup merely because the user scrolls within a *cached* page
   or navigates among *cached* pages. Reuse the existing approximately 500-ms
   quiet/input window at page boundaries to avoid starting a new expensive
   background job during an active stream of wheel/scroll events. Once the
   user stops, continue without another two-second delay. Do not add a new
   stateful user-behavior predictor.
3. **Cache-gap scheduling:** maintain a set of completed page numbers; at
   each job boundary select the **closest missing page in the reading direction**
   beyond the locally cached run (e.g. current 20, already cached 21–25 ⇒
   next target 26), then eventually cover remaining missing pages in the
   reverse direction. Updating the current page among 20–25 does not cancel
   the worker, restart its idle warmup, or rerun any cached page. Recalculate
   the *next target only*, not a large pending queue, when user direction or
   location changes. An existing background job may finish before the next
   target is selected.
4. Run **only one background detector job globally**, regardless of how many
   PDFs/split views are open, and only for the currently active reader's PDF.
   Insert a short idle gap between pages (initial design: approximately
   one second). At each boundary, recheck activity, selection, enabled state
   and document identity. A passive user reading a long page gives the worker
   time to continue across the book.
5. **Prioritize actual foreground work, not every input event.** Scrolling
   **inside the same page** is still an authoritative manual positioning
   action for Margin Fit's visible-page controller; it should **not** cancel
   an already-running background job or reset the full two-second warmup
   when that page's borders are cached. While the user is continuously
   scrolling, defer *starting the next* background job until the usual
   brief quiet window. Changing to a page with cached bounds (including
   cached neighboring pages) uses them immediately and normally leaves
   the indexer running. But switching to an **uncached visible page** or
   explicitly requesting new foreground detection must take priority:
   cancel/defer queued background work, and where possible cancel a slow
   in-flight offscreen render so it does not block foreground detection.
   A deliberately aborted job is **not** a finished full-page fallback and
   must not be persisted. A document switch, plugin disable, or close stops
   or switches the background worker; none of these cases blocks the
   user's immediate native page turn.
6. A completed background detection updates only the shared page-boundary
   cache. **Never** change the displayed page, zoom or scroll position from
   the background worker; avoid triggering visible re-centering or duplicating
   a native PDF.js render. User navigation remains immediate even if the
   target page is still uncached.
7. If reading continues, resume from the remaining missing pages. Closing the
   PDF stops the worker and flushes valid finished coordinates. If the PDF is
   already completely cached, **start no worker or timer**. When another PDF
   becomes active, shift the worker there; the previous document's saved
   progress remains intact.

## Persistence and finite work

- Follow the separate v0.1.8 cache contract: PDF.js fingerprint(s) + page
  count identify the document; `algorithmVersion: 1` is independent of
  releases; each page stores **exactly four coordinates**.
- A sparse-detection result is considered complete; blank, dense or dark
  background results that intentionally choose **full-page bounds** are
  complete and also cached. Only real detector/render failures stay missing.
- Deduplicate cached, queued and in-flight pages. Do not schedule a second
  job merely because a foreground turn visits a page pending in the
  background queue.
- The v0.1.7 disk-store `MAX_RECORDS=3000` limit would silently evict
  earlier pages in books above 3,000 pages. Revisit/remove this cap for the
  new small four-coordinate format: once a page is fully indexed it should
  not be discarded merely because more pages are scanned.
- **JSON page order is irrelevant.** Use a page-number-indexed object/map:
  `{ "pages": { "26": [l,t,r,b], "3": [l,t,r,b] } }` is perfectly readable;
  `pages["26"]` retrieves page 26 regardless of insertion order. There is
  no need to sort or insert earlier page entries into positional order.
  **Do not literally append characters to the end of a complete JSON file**:
  that would make it invalid. Keep the in-memory map updated after each page,
  and write one syntactically valid JSON snapshot in **small batches**, e.g.
  roughly 10 new pages or 10 seconds, whichever comes first, plus flush on
  close/stop. The existing writer's in-process merge queue can prevent
  independent reader views from overwriting one another. For this compact
  cache format there is no need to invent an append-only journal or JSONL.

## Acceptance tests

1. Cold 100-page book: foreground visible page and immediate neighbors are
   processed first; once quiet, additional missing pages begin getting cached
   without user navigation.
2. Foreground interruption: start a slow background PDF render, then jump
   to an **uncached** page. Assert immediate native page navigation and
   foreground detection priority rather than queuing behind a book backlog.
   Aborted background work does not persist fake full-page bounds.
2a. Local scroll: repeated wheel/scroll events wholly within a **cached**
   page preserve manual position and do not cancel a running indexing job
   or restart the initial 2-second warmup. During a continuous scroll burst,
   no *new* background job starts until the brief quiet window.
2b. Cached navigation: with current page 20 and pages 21–25 all cached,
   browse 21→22→23 and confirm no new detector runs on these pages and
   no indexing restart. The next missing page 26 is selected once the
   current background job finishes.
3. Inactive PDF/split view: there is only one background worker in the Zotero
   process and no duplicate page analyses.
4. Reopen and resume: after a partial scan, close/reopen the same PDF, reuse
   all previously persisted page boxes and continue only the missing ones.
   Filename/path/mtime changes alone do not wipe the progress; incompatible
   fingerprints or an explicitly approved new algorithm version do.
5. Full-page fallback: scanned dark backgrounds and blank pages are persisted
   as four whole-page coordinates and not repeatedly rescanned.
6. Whole-book completion: each page is computed at most once per compatible
   cached revision, including a long PDF beyond the old 3,000-page cap.
7. Foreground UX: no automatic zoom/position write originating from a
   background result; no visible Fit Height page-turn delay introduced by
   indexing. Compare active reader latency and detection worker activity
   against v0.1.7 while indexing runs.
8. Restart, disable, document close or plugin unload stops work cleanly and
   retains completed page results. Never corrupt the user's PDFs or annotations.
9. Unordered JSON page keys are read by page number without sorting or
   re-detection. A scan that completes pages 20, 26, 3, 24 writes a valid
   JSON snapshot, preserves all four entries and their values, and reopens
   without a detector call. Test separate buffered writes/merges and a
   close-time flush.

## Implementation boundary

This document **does not authorize changing the official v0.1.7 release**.
Integrate into the v0.1.8 feature branch after implementation and isolated
Zotero tests. Keep the scheduler deliberately simple: idle threshold, single
background worker, skip cached pages, foreground preemption, incremental saves.
