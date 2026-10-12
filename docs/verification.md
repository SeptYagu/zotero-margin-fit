# MarginFit ? Current verification (v0.1.14)

The older v0.1.2 records remain archived in [historical verification](verification-v0.1.2-legacy.md). This page is maintained for the CURRENT release.

## Native Zotero 10.0.6 Windows tests

- **99/99** Node unit tests passed with new active-reader ownership and inactive-pane no-refit checks.
- **78/78** default Zotero native integration checks passed, with the current three-button toolbar expectation and original native button hidden. Retained text selection, highlight coordinates, rotation, split panes, detached windows, PDFs unchanged, fallback detection, fit and unload/reinstall checks. The detached-reader startup timeout was raised only for cold profile startup, without dropping assertions.
- **34/34** plugin toolbar mode-toggling checks passed in prior v0.1.13 tests (same UI code).
- **28/28** content-height/continuous-scroll integration checks passed on the candidate.
- **10/10** background indexing/JSONL checks passed. One native debugger transport timed out *after* writing a valid `passed: true` result file; Zotero assertions, not transport error, are authoritative in this harness.
- **24/24** JSONL cache/faraway folio checks passed.
- **Active-reader end-to-end**: opening document B makes B the index target, switching tabs moves the one worker to A and back, A does not index while B active. Once B's 24 pages are complete, no hidden PDF renders; selecting A resumes A.
- **Windows OS-level keyboard injection** into the confirmed foreground disposable Zotero window produced two actual MarginFit `snapToContent` calls (8 -> 9 and 9 -> 8). ArrowDown was delivered as native trusted input without a whole-page MarginFit call. This verifies the input route; it is NOT the same as testing the user's physical hardware.

## A/B analysis: do not switch algorithms yet

See [experimental evidence](2026-10-12-v0114-verification-and-ab-results.md).

- Parity six-page model: 138 held-out samples in 18 real research PDFs, 135 usable comparisons. A low-resolution independent reference found 20 predicted crops beyond the 16-PDF-unit safety padding plus 2-unit tolerance. Not safe as a replacement for precise page bounds.
- Complex mixed-pages operator-list-first versus raster-first: 20 page pairs; raster-first won on 17 pairs (normal arm order) and 16 pairs (reversed order), with paired median savings of 49ms and 85ms; render pixel hashes matched for all pages. Not a global win across all document types.
- Generated actual pure-text PDF: existing fastpath 3-4 ms versus naive raster-first 129-183 ms on three matching pages. Unconditional raster-first REJECTED. A cheap reliable classifier must be separately demonstrated before selective adoption.

## Limitations

OS-level simulated trusted keypresses are not a full physical input-device test. Active-window detection verified for two tabs, not every operating-system window manager. No evidence supports enabling the rejected parity/raster-first variants in v0.1.14. No user PDF/annotation or production Zotero profile was modified by tests.
