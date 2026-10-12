# MarginFit v0.1.13 — design / implementation audit

Date: 2026-10-12. Baseline: public main commit 49c1f06, v0.1.13.
Scope: evidence-only. No plugin code, version, user PDF or Zotero profile modified.
Evidence classes: code-confirmed; native-test-confirmed; unverified; superseded; deferred.

## Confirmed gaps

### P1: Default native integration test has a stale specification (reproduced)
- The package.json test:integration script still runs tests/integration-bootstrap.js.
- That test expects exactly TWO added buttons plus a retained original Reset Zoom (around line 65).
- Actual run against the v0.1.13 XPI in isolated Zotero 10.0.6 failed at precisely that obsolete assertion.
- The v0.1.13-specific test:ui had previously passed 34/34 and verifies THREE replacement controls and hidden native Reset Zoom.
- This is a broken DEFAULT ACCEPTANCE ENTRYPOINT, not proof of a runtime toolbar defect.
- Minimal fix: migrate valid older coverage into the new default runner and replace obsolete expectations.

### P1: Current-state documentation is contradictory (code-verified)
- The README lead describes the new three-button toolbar, but a following paragraph still calls v0.1.8 the current release; the tag and manifest are v0.1.13.
- docs/architecture.md and docs/verification.md still specify native Reset Zoom must remain visible and old full-L1-first scheduling.
- docs/verification.json retains the old two-new-controls contract.
- README still mixes historical 800px detector raster, JSON cache and stale serialized metadata with the present 560px sparse detector and four-coordinate JSONL cache.
- Keep dated CHANGELOG/design documents as history; refresh only current-state guides and acceptance metadata.

## Implemented but physical/real-world verification outstanding

### P2: Keyboard/touchpad end-to-end verification
- The current runtime captures PageDown/PageUp in height mode and invokes next/previous detected-content page positioning.
- Native reader tests verified snapToContent and physical-document scrolling, but direct hardware PageDown/PageUp was NOT exercised.
- Zotero debugger-generated KeyboardEvent failed even to reach the test's ordinary keydown listeners, so it does not establish a plugin key handling defect.
- Require real input testing or a real event trace before editing event handling.

### P2: Active PDF selection with multiple open readers
- There is exactly one global IdleIndexer; a single reader was tested natively (10/10).
- No completed native multi-tab/split reader check proves the idle worker always prioritizes the currently active reader.
- Current focus target may follow controller focus timing. This is unverified, not an established user-facing bug.
- Do not add tab tracking infrastructure without a reproducible failure.

## Implemented and tested; do not reopen without contrary evidence
- Three plugin toolbar buttons replace original Reset Zoom, mutually exclusive Width/Height/Off: v0.1.13 native 34/34.
- Continuous full-PDF layout, free fine scrolling inside a page and content-aligned page transitions: native 28/28.
- Persistent four-coordinate, fingerprint-keyed, independent-algorithm-version JSONL cache: actual test:cache 24/24 in THIS audit, including reopen without rerender and unusual distant folio Width Fit.
- Background single-worker missing-page indexing: previous isolated Zotero 10/10.
- Conservative sparse dirty-edge scan, strict text-only fastpath, 16-PDF-unit margin and full footer height: implemented and covered by focused tests.

## Historical agreements that were later intentionally superseded
- The ORIGINAL written specification file 09-智能去白边阅读开关.md actually requested prioritizing retention of native Reset Zoom; the initial shipped version followed that.
- The user later requested in-place replacement. This was added only in v0.1.13: a changed design decision, not a violation of the initial written requirement.
- The PDF.js PAGE single-mounted-page behavior from v0.1.8 was explicitly rejected after user feedback, removed in v0.1.11, and replaced with continuous layout plus one-content-page steps in v0.1.12.
- Full eager representative parity L1 processing remains as dormant Session.l1/helper code and old tests, but the ACTIVE production path prioritizes visible page, immediate neighbors and on-demand folio corroboration. This was a performance-motivated design change.
- Old snapshot JSON/migration was explicitly discarded when JSONL was authorized in v0.1.9.
- The v0.1.5 proposed raster-first classification for mixed pages was explicitly deferred for lack of real A/B evidence; it is not an outstanding confirmed defect.
- Additional rotation metadata is not justified: genuine Zotero saved rotation changed PDF bytes/fingerprint in tested scenario; both fingerprints are used in current cache key.

## Actual tests run during this audit
- npm run test:integration: FAILED at old expected two new controls / retained native Reset Zoom.
- npm run test:cache: PASSED all 24/24 actual Zotero 10.0.6 assertions; reopening reused 3 cached pages without fresh analysis.
- Other counts cited above come from v0.1.13 release verification, not rerun during this audit.

## Recommended action order (minimal engineering)
1. Repair default integrated acceptance runner; retain applicable old assertions, remove obsolete contract.
2. Update current README, architecture, verification.md/json; preserve historical archived design documents.
3. Test real keyboard PageDown/PageUp and touchpad on a representative reading PDF.
4. Verify active-reader priority with two Zotero PDFs / split view before changing any background scheduling.
5. Do not revive PAGE mode, migration code, unproved raster-first or speculative concurrency/telemetry frameworks.

This is an audit record, not an instruction to change code or publish another release.
