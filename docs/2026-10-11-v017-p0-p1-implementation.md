# MarginFit v0.1.7 P0/P1 implementation and validation

Date: 2026-10-11. Branch: `fix/v017-actual-visible-ink-width`.
Status: isolated Zotero 10.0.6 tests passed; development build only, NOT released.

## Changes
- Prior commit `6295a7a`: preserve user-position hold and suppress micro-centering.
- P0 `f4eaf41`: detect the actual visible page before L1 representatives.
- A foreground explicit Fit does not await six unrelated L1 pages.
- Shared serial worker remains single-render; L1 yields between samples.
- Representative six-page modeling and subsequent neighbor prefetch now happen lazily after current-page fitting.
- Folio-pattern detection still collects sufficient L1 evidence; one conditional later correction is allowed only for a verified folio in Width Fit, subject to the existing zoom dead zone and user-position protection.
- P1: reduce detector canvas maximum long edge from 800 to 560 pixels; native reader and annotation resolution are unchanged.
- P1: skip getOperatorList() entirely when text geometry is already suspicious and raster calibration is mandatory.
- Keep the sparse quarter-rate scan, 16 PDF-unit safety padding, and conservative raster fallback.

## Validation in disposable Zotero 10.0.6 profiles
- `npm test`: 70/70 passed (including L1 preemption and lazy folio follow-up).
- `npm run test:integration`: 75/75 passed (first visible page, reading position, scrolling, annotations, split and detached readers).
- `npm run test:cache`: 21/21 passed (folio/score, cache re-open and native width/height).
- `npm run test:ui`: 18/18 passed (native toolbar and actual margin diagnostics).
- `npm run build`: generated local `dist/zotero-margin-fit-0.1.7.xpi`.
- The cache regression was updated to distinguish cache-backed L1 samples from previously uncached newly visible pages. The synthetic score page-navigation test now awaits settled native page events.

## Performance evidence and remaining work
- Same synthetic/integration workload reported peak detector raster bytes 1,920,000 at 800px versus 940,800 at 560px (about 49%). This is NOT total Zotero memory or CPU reduction.
- First-smart-fit-from-import includes Zotero import/startup and is not a controlled apples-to-apples P50/P95 comparison.
- Need additional real scanned/notation PDF geometry A/B and cold/warm first-fit latency sampling before release.
- P2 (reduce speculative neighbor renders) and native zoom repaint CPU assessment remain unimplemented.
- Leave user's active Zotero, public release, update feed, and the three local untracked probe files untouched.
