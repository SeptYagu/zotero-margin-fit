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
2. After the reader has had roughly **2 seconds without a user interaction**,
   begin background work for the currently active document. This is a separate
   *background* quiet threshold; the existing 500-ms foreground settling
   logic remains unchanged. Adjust the two-second value based on actual
   usability tests rather than build a complicated predictive scheduler.
3. Select only **missing** page numbers. A simple priority order suffices:
   go forward in the current reading direction from the already warm neighbors
   toward the document end, then cover the remaining pages in the other
   direction. On navigation to a new page, rebuild the unfinished scan
   priority from that page; do not rescan cached pages.
4. Run **only one background detector job globally**, regardless of how many
   PDFs/split views are open, and only for the currently active reader's PDF.
   Insert a short idle gap between pages (initial design: approximately
   one second). At each boundary, recheck activity, selection, enabled state
   and document identity. A passive user reading a long page gives the worker
   time to continue across the book.
5. **Foreground always wins.** New scrolling, wheel input, page/TOC/search
   navigation, explicit Fit, document switch or disabling Margin Fit pauses
   the sweep immediately, cancels not-yet-started work and prioritizes the
   visible page. One ongoing expensive background PDF.js `renderTask` should
   be cancellable, where supported, so it cannot block a later foreground
   detection for many seconds. A deliberately aborted job is **not** a
   successful full-page fallback and must not be persisted.
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
- The existing 1.2-second debounced JSON writer can rewrite a growing whole
  document many times during book-wide indexing. Coalesce background
  persistence into **small batches / occasional flushes**, plus close/stop
  flush, rather than rewriting a potentially large cache after every page.
  Do not hold all finished results until the entire book is done.

## Acceptance tests

1. Cold 100-page book: foreground visible page and immediate neighbors are
   processed first; once quiet, additional missing pages begin getting cached
   without user navigation.
2. Foreground interruption: start a slow background PDF render, scroll or
   jump to an uncached page, and verify that the target navigation occurs
   immediately and its detection is not queued behind a large book backlog.
   Aborted work does not persist fake full-page bounds.
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

## Implementation boundary

This document **does not authorize changing the official v0.1.7 release**.
Integrate into the v0.1.8 feature branch after implementation and isolated
Zotero tests. Keep the scheduler deliberately simple: idle threshold, single
background worker, skip cached pages, foreground preemption, incremental saves.
