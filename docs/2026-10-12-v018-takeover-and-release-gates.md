# MarginFit v0.1.8 — takeover verification and remaining release gates

Date: 2026-10-12
Branch: `feat/v018-content-page-turn`
Status at takeover: development/isolated Zotero validation. Later updated for the owner's rapid normal-release policy; no production Zotero installation was performed.

## Confirmed implementation

- Immutable document identity: PDF.js fingerprint(s) + number of pages; no path/filename/mtime dependency.
- Independent cache compatibility `algorithmVersion: 1`; one four-coordinate fit box per page.
  **Required retained feature:** X coordinates use verified central body edges if an isolated
  page number lies unusually far left/right, while Y coordinates always preserve the
  full ink/page-number vertical extent. This keeps the original requested Width Fit
  enlargement across reopening with no extra stored array or repeated raster scan.
  Unproven outliers/important charts always retain full raw bounds.
- Delayed JSON snapshots (10 pages or 10 seconds), unordered page lookup, and no 3,000-page eviction.
- Legacy v0.1.7 version-5 fingerprint-and-stamp cache migration for reliable records; actual Zotero IO verified.
- Foreground-visible/neighbor priority followed by one cooperative idle book indexer; cached navigation does not restart it.
- Native PDF.js PAGE mode for Fit Height, one attached page, wheel/touchpad/page-number navigation.
- Cached page turns show no extra late positioning write in the synthetic Zotero integration test.
- Height mode now fits safe whole-page geometry even on deliberate fallback (blank/dark/dense);
  Width mode retains its conservative fallback behavior and fallback diagnosis remains visible.
- No new PDF bitmap rendering or annotation rewriting in the page-turn path.

## Verification run

- `npm test`: initially 86/86; after scanned-edge/toolbar and selective cache migration improvements, 90/90 unit tests passed.
- `npm run test:height`: passed native Zotero 10.0.6 page-turn geometry, trackpad, restore,
  no delayed second fit, and blank-page fallback.
- `npm run test:background`: passed idle pre-indexing without visible zoom/pan changes.
- `npm run test:migration`: passed stamped legacy fingerprint cache migration.
- `npm run test:cache`: passed native Zotero reopen with far-left score folio; original
  Width Fit enlargement retained without rerendering, and pure-text verified folio
  cases persisted body X with complete page-height Y.
- `npm run test:ui`: passed; `npm run test:height`, `test:background`, `test:integration`
  and `test:migration` were rerun successfully after the width-folio preservation fix.
- `npm run build`: produced local v0.1.8 development XPI.
- Main Zotero reader integration passed on the initial run and again after a tightened
  asynchronous rotation test. One intermediate run was intermittently early; the first
  edited test then mistakenly treated the `until()` helper's void return as a Boolean
  (a harness error, corrected). Final fresh isolated rerun passed, including awaited native
  rotation and cache remeasurement. A later multi-run stability check remains useful.
- `git diff --check`: clean (Git line-ending notices are not errors).

## Compatibility decision (resolved)

**Special width optimization is required and preserved.** Real Zotero 10.0.6
mixed-score reopen checks and pure-text folio checks passed. Do not delete
`widthFitRaw` detection. The stored 4-box is an *effective fit box*, not always
an exhaustive full-ink horizontal rectangle; original PDF bytes are untouched,
and horizontal panning remains possible.

## Remaining broader acceptance (not blockers for owner-requested rapid testing releases)

1. **Real-document visual audit**: test v0.1.8 against varied real research PDFs, scans, scores,
   portrait/landscape, rotated and dark pages, before shipping. The v0.1.7 18-PDF benchmark
   does not establish v0.1.8 performance or fidelity.
2. **Interaction regression**: repeat page-turn/navigation and rotation integration in fresh
   isolated profiles; exercise long jumps, annotation editing/search, split views and reopen.
3. **Performance**: measure active reading responsiveness while idle indexing is working;
   synthetic detections are not CPU/battery evidence. Ensure no foreground detector starvation.
4. **Publication policy revised by owner**: ship each complete iteration as a public,
   non-prerelease version for direct Zotero updates. Publish the verified XPI first, then
   update the feed to its exact SHA-256. Do not overwrite historical v0.1.7 assets.
   Final fresh Zotero harness startups intermittently stalled; clearly record this limitation,
   while final isolated JavaScript sparse scanning of all 19 pages of the Berger source PDF
   yielded 19 candidate boxes and zero fallback.

No user's original PDFs, production Zotero profile, or public updater were modified.
