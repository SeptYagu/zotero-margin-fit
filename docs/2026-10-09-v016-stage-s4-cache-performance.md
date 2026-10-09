# v0.1.6 S4 — Cache schema and sparse scan performance

Date 2026-10-09. Development build 0.1.6, **not released**.
- source core.VERSION increment 3→4; cache STORAGE_VERSION increment 2→3. Existing 0.1.5 records are invalidated safely and re-detected.
- Persist compact `widthFitRaw`, `boundsKind` (estimated/verified), `samplingRate` and `boundaryConfidence`; validate numeric values, box dimensions and unchanged top/bottom for Width Fit. Full raster/text/PDF bytes are never stored.
- Updated package and manifest to source version 0.1.6, built local dist/zotero-margin-fit-0.1.6.xpi (20,404 bytes on this build); GitHub public release/feed untouched.
- `npm test`: 57/57 passed (includes 9 sparse tests and one new cache metadata validation).
- Pure JS microbenchmark: tests/sparse-performance.cjs; 600x800 RGBA, 65 iterations per synthetic scene after warmup. Measurements vary with CPU scheduling:

  | Pattern | Original full scan | Diagonal ~25% scan | scan-loop speedup |
  |---|---:|---:|---:|
  | body text | 154.09 ms | 54.60 ms | 2.82x |
  | thin score + running folio | 121.42 ms | 43.87 ms | 2.77x |
  | blank | 104.35 ms | 50.87 ms | 2.05x |
  | dense | 237.85 ms | 81.21 ms | 2.93x |

Blank/dense **fall back to another full scan** in runtime; therefore their end-to-end path does *not* inherit that displayed loop speedup. The benchmark does not include page.render(), getImageData(), cross-compartment RGBA clone, scroll re-render or cache I/O. It must not be reported as 2.8x overall Zotero CPU efficiency. Main benefit is fewer JavaScript pixels inspected (120,000 of 480,000 in typical 600×800 page).

Next: rerun isolated full Zotero 70 checks and special 21 checks on newly versioned XPI. Build and audit error cases before authorizing any release.
