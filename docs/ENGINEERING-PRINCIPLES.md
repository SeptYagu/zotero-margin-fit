# MarginFit — mandatory engineering principles

Adopted: 2026-10-12. Status: binding for future reviews, implementation, and release planning.
These principles may be changed only after explicit approval from the project owner.

## 1. Evidence before engineering

1. Classify every review finding as **reproduced defect**, **verified user-facing regression**, **measured performance cost**, or **unverified hypothesis**. Do not present a hypothesis as a confirmed defect.
2. Before proposing a change, reproduce the claimed behavior in the relevant Zotero version and realistic PDF/workload whenever feasible. Unit tests, synthetic fault injection, and static reasoning prove different things; label them correctly.
3. For behavior of Zotero/PDF.js (page rotation, fingerprint updates, active tabs, input gestures), inspect the actual product and APIs before adding compatibility logic.
4. If a problem is not reproduced and its expected impact is small, record it as an observation, not an implementation requirement. Rare theoretical edge cases alone do not justify a hot-path tax.

## 2. Simplicity is a hard constraint

5. Prefer the smallest working mechanism and existing Zotero/Firefox/PDF.js facilities. Minimize code paths, persisted metadata, timers, coordination states, dependencies, and migration machinery.
6. Compare simple alternatives before selecting a fix: change file format, reuse native append/API operations, adjust an existing check, or add a focused test. **Append-only JSONL is a candidate, not an authorized implementation decision** until compatibility, migration, failure behavior, and performance are checked.
7. Do not add general frameworks for scheduling, retries, recovery, telemetry, predictive behavior, persistent journals, log compaction, or compatibility without a demonstrated need.
8. Scope changes narrowly. Do not refactor unrelated, functioning modules when addressing a verified bug.

## 3. Performance is a product requirement

9. Optimize for real reading: first accurate fit, cached page-turn latency, responsiveness during idle indexing, CPU, memory, and disk IO. Benchmark before/after on representative real PDFs under comparable conditions.
10. Count total work, not just local algorithmic complexity. Do not trade a cheap map lookup or periodic check for more expensive event machinery without measured net benefit.
11. Keep visible-page work ahead of background indexing. Avoid extra full-page renders, repeated geometry reads, micro-centering, and repeated analysis of cached pages.
12. A performance optimization is accepted only when it provides a measurable benefit or fixes an observed user-facing regression without meaningful accuracy or usability loss.

## 4. Preserve intentional behavior

13. Retain supported long-distance page-number exclusion in Width Fit, full vertical content/page-number extent, the 16-PDF-unit safety margin, and conservative fallback where evidence is inadequate.
14. Preserve manual page positioning, stable near-equal-page zoom, native page rendering/text/annotation functionality, and a simple one-worker background indexing architecture.
15. Reuse persistent page bounds across compatible versions; never increment the cache algorithm compatibility version merely because the plugin release version changes. Any deliberate invalidation needs owner approval.

## 5. Review, testing, and decision gates

16. A review must identify exact code locations, confidence/evidence, user impact, suggested **minimum** fix, and regression/performance test. Separate confirmed bugs from optional ideas.
17. Validate changes with focused tests first, then relevant isolated Zotero integration and representative PDF checks. Report what was **not** tested, especially active CPU cost and real reader behavior.
18. Do not create work merely to make code look cleaner, cover an improbable case, or increase test counts. If benchmarks show negligible gains, **leave the existing code alone**.
19. Obtain owner approval before substantial architecture changes or cache-format migrations. Documentation-only changes do not require a new plugin release; completed functional iterations follow `docs/RELEASE-POLICY.md`.

## Correction to the first v0.1.8 review

- **Reproduced by synthetic fault injection:** a failed cache write loses pending entries; a transient cache read failure can replace existing entries. These are genuine failure-path defects, but their fix need not be complex.
- **Not yet verified in actual Zotero usage:** persisted coordinates after a rotated PDF is saved/reopened; determine whether PDF fingerprint changes already invalidate them.
- **Not proof of multiple background workers:** there is one global IdleIndexer. Active-tab selection may be imperfect but is not equivalent to all PDFs being scanned concurrently.
- **Not proven worth optimizing:** periodic reader discovery, missing-page search complexity, gesture edge cases, and preemption latency. Require real-world reproduction and/or profiling before making them engineering tasks.

Default outcome for unsupported concerns: **document, do not implement**.
