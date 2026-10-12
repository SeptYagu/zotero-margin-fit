# MarginFit v0.1.8 — takeover verification and remaining release gates

Date: 2026-10-12
Branch: `feat/v018-content-page-turn`
Status: development/isolated Zotero validation; NOT published and NOT installed in production Zotero.

## Confirmed implementation

- Immutable document identity: PDF.js fingerprint(s) + number of pages; no path/filename/mtime dependency.
- Independent cache compatibility `algorithmVersion: 1`; one four-coordinate content box per page.
- Delayed JSON snapshots (10 pages or 10 seconds), unordered page lookup, and no 3,000-page eviction.
- Legacy v0.1.7 version-5 fingerprint-and-stamp cache migration for reliable records; actual Zotero IO verified.
- Foreground-visible/neighbor priority followed by one cooperative idle book indexer; cached navigation does not restart it.
- Native PDF.js PAGE mode for Fit Height, one attached page, wheel/touchpad/page-number navigation.
- Cached page turns show no extra late positioning write in the synthetic Zotero integration test.
- Height mode now fits safe whole-page geometry even on deliberate fallback (blank/dark/dense);
  Width mode retains its conservative fallback behavior and fallback diagnosis remains visible.
- No new PDF bitmap rendering or annotation rewriting in the page-turn path.

## Verification run

- `npm test`: 84/84 unit tests passed.
- `npm run test:height`: passed native Zotero 10.0.6 page-turn geometry, trackpad, restore,
  no delayed second fit, and blank-page fallback.
- `npm run test:background`: passed idle pre-indexing without visible zoom/pan changes.
- `npm run test:migration`: passed stamped legacy fingerprint cache migration.
- `npm run test:cache` and `npm run test:ui`: passed.
- `npm run build`: produced local v0.1.8 development XPI.
- Main Zotero reader integration passed on the initial run and again after a tightened
  asynchronous rotation test. One intermediate run was intermittently early; the first
  edited test then mistakenly treated the `until()` helper's void return as a Boolean
  (a harness error, corrected). Final fresh isolated rerun passed, including awaited native
  rotation and cache remeasurement. A later multi-run stability check remains useful.
- `git diff --check`: clean (Git line-ending notices are not errors).

## Release blockers / further acceptance

1. **Width-only outlier boundary on reopen**: v0.1.7 sometimes preserves `widthFitRaw` in addition
   to full content `raw`. The new four-coordinate disk schema deliberately drops transient metadata,
   so a reopened book may lose the special isolated-folio Width Fit improvement. Choose and verify a
   canonical one-box policy or exceptional lightweight recalculation *without adding a second disk
   rectangle*. Keep full Height Fit safety and avoid losing meaningful graphics or notation.
2. **Real-document visual audit**: test v0.1.8 against varied real research PDFs, scans, scores,
   portrait/landscape, rotated and dark pages, before shipping. The v0.1.7 18-PDF benchmark
   does not establish v0.1.8 performance or fidelity.
3. **Interaction regression**: repeat page-turn/navigation and rotation integration in fresh
   isolated profiles; exercise long jumps, annotation editing/search, split views and reopen.
4. **Performance**: measure active reading responsiveness while idle indexing is working;
   synthetic detections are not CPU/battery evidence. Ensure no foreground detector starvation.
5. **Publication**: do not update `main`, v0.1.7 XPI or `updates.json` until the above are
   resolved and a separate verified release is staged.

No user's original PDFs, production Zotero profile, or public updater were modified.
