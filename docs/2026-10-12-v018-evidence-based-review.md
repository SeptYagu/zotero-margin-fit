# MarginFit v0.1.8 — evidence-based verification of review findings
Date: 2026-10-12
Baseline: published v0.1.8, source tag at df25f10. Policy: docs/ENGINEERING-PRINCIPLES.md.
Scope: verification only. No plugin source, PDF originals, updater, or production Zotero profile changed.

## Evidence grades
- **Confirmed in code/fault injection**: an actual deterministic code path, not evidence of real-world frequency.
- **Confirmed in prior isolated Zotero integration**: backed by an existing saved result.json.
- **Confirmed only on Windows Node test**: filesystem timings may not match Zotero's IOUtils.
- **Not verified**: native behavior or user impact not demonstrated. Do not open a fix task on this alone.

## 1. Cache write/read failure
- Paths: src/persistent-cache.js:145-168. Fault injection confirmed both data-loss paths:
  failed write clears unsaved dirty pages; transient read error can cause overwrite with only changed pages.
- No evidence they are frequent in normal Zotero use; initial P0 priority was unjustified.
- Minimum possible fix: leave pending pages queued until successful commit; do not treat arbitrary read errors as empty-cache/not-found.
- No new database, retry framework, or caching format required to address these specific defects.

## 2. Append-only file-format candidate
- Firefox IOUtils supports appendOrCreate in writeUTF8 (Mozilla bug 1788997, Firefox 108+);
  direct compatibility/performance in local Zotero 10.0.6 was NOT established in the fresh probe.
- Measured on this PC via Node local TEMP filesystem (one run, 10 pages/write):
  100 pages: snapshot 10.82ms/11781 bytes, JSONL 8.02ms/2892 bytes.
  500 pages: snapshot 52.01ms/277141 bytes, JSONL 42.34ms/14892 bytes.
  2000 pages: snapshot 236.16ms/4457842 bytes, JSONL 169.11ms/60893 bytes.
- Final file size for 2000 pages: JSON ~44925 bytes, JSONL ~60893 bytes.
- Conclusion: fewer bytes, but only ~67ms saved over 2000 pages on this test.
  A full JSON-to-JSONL migration is NOT presently justified on demonstrated latency benefits.
## 3. Rotation semantics and persistent geometry
- Official Zotero team confirms desktop Rotate Page Left/Right permanently edits selected pages of the PDF;
  transient whole-document PDF.js view rotation is a separate feature historically disabled as a keyboard shortcut.
  Sources: https://forums.zotero.org/discussion/125899/breaking-rotate-shortcut-in-the-pdf-reader
  and https://forums.zotero.org/discussion/124338/rotate-pdf
- src/core.js:496/609 verifies rotation in live in-memory cache. Existing integration-bootstrap
  has live rotation testing, but NOT rotation-edit/close/reopen/fingerprint testing.
- src/runtime.js:673-682 recreates current rotation on loaded four-coordinate bounds, so a
  document retaining its fingerprint while its page orientation changes could reuse stale coordinates.
- Simulated reopen with 180-degree metadata and old box reuses it with zero detector calls.
- Native rotate-PDF/reopen/fingerprint experiment NOT completed; do not change storage schema
  or invalidate existing caches until it identifies a real mismatch.

## 4. Multiple PDFs / active reader indexing
- src/runtime.js:587 instantiates one global IdleIndexer; core.js:657-740 contains one target,
  one busy flag, and one background job token. Opening N PDFs does NOT start N full-book indexers.
- Existing native integration result 1baa76ee...: one document background-indexed,
  retained visual position, saved 10 page results; not a multi-reader experiment.
- Code may retarget to the last controller calling focus(), irrespective of selected UI tab;
  incorrect real-world selection was NOT reproduced. Do not add active-tab infrastructure yet.

## 5. Periodic reader discovery
- src/runtime.js:608: discover() every 500ms; src/runtime.js:611-647 walks readers/toolbars.
- Native CPU/profile measurements unavailable (isolated fresh Zotero startup stalled).
- No demonstrated measurable load: DO NOT replace polling with event-driven framework.

## 6. Next-uncached-page lookup
- src/core.js:692-700 scans cache from current position at every page completion.
- Node 10,000-page synthetic fill: 49,995,000 Map.has checks, ~771ms total,
  or ~0.077ms per page across the entire simulated book.
- Nonlinear complexity exists, but observed absolute cost is tiny versus raster page detection.
  No task to add a cursor/index until full-workload profiling shows a bottleneck.
## 7. Large wheel/trackpad events
- src/runtime.js:132-159 handles events with |deltaY| >= 80 as separate discrete turns.
- Direct Controller.heightWheel test: six synthetic pixel-mode events with deltaY=90
  caused six turnPage calls. This does NOT prove a real touchpad sends that exact stream;
  real mouse detents may legitimately request six turns.
- Native previous v0.1.8 test 65702dbc... passed a low-amplitude trackpad burst and inertia test.
- Await a real input-event trace or user reproduction before changing gesture policy.

## 8. Foreground preemption
- src/core.js:613/719: foreground invalidates/cancels active background token;
  src/core.js:473/496 serializes the detect jobs. Non-cancellable async calls remain serial.
- Simulated 800ms background stage ignoring cancellation: newly visible uncached page waited 708ms.
- This is a genuine scheduling limitation under an artificial slow stage,
  NOT evidence of a frequent real-document lag. Cache-hit foreground path remains synchronous.
- Require a real PDF latency trace before redesigning cancellation or concurrency.

## Native verification status
- Previous v0.1.8 isolated Zotero saved results: 26/26 Height navigation checks
  (65702dbc...), 10/10 idle indexer checks (1baa76ee...), 24/24 cache/scanned-score checks
  (cd9b1880...). These are prior results, not this verification run.
- Attempted new disposable Zotero 10.0.6 driver covering IOUtils append, rotation reopen,
  two open PDFs, and polling; startup/database initialization stalled, no result.json was produced.
  **None of those new native assertions are reported as passed.**
- Local probe script preserved under ignored .test-harness for a later retry.

## Decision
1. Consider only the two cache fault paths for minimal, focused correction after agreeing on scope;
   no present evidence that an append-only format is necessary.
2. Do not implement rotation metadata, selected-tab scheduling, polling refactor, gap cursor,
   gesture lock, or extra cancellation mechanisms without genuine product evidence.
3. If Zotero integration becomes healthy, target the unanswered rotation/fingerprint experiment
   first, followed by native IOUtils-append comparison. Preserve current v0.1.8 runtime meanwhile.
