# MarginFit ? Current verification (v0.1.17)

The older v0.1.2 records remain archived in [historical verification](verification-v0.1.2-legacy.md). This page is maintained for the CURRENT release.

## 0.1.17 validation (Windows Zotero 10.0.6)

- Owner tested and approved private candidate functionality and classic paper icons.
- 102/102 Node unit tests; native PDF.js 0/1/2 spread grouping, four controls, View-menu synchronization and odd/even icon fill verified in disposable profiles.
- Windows OS-level PageDown/PageUp: Odd Spreads 3 -> 5 -> 3, Even Spreads 2 -> 4 -> 2. Native continuous scrollbar stays intact.
- Native UI, Height Fit, default integration, cached reopen, all-open background indexing, annotation safety, Fit OFF and active-reader priority regressions passed.
- Limits: Windows test only, OS-injected keys rather than all physical keyboards; extremely mismatched page sizes and narrow windows were not optimized for exact dual-page fitting.
- See [private development report](2026-10-12-native-spread-private-preview.md).

## 0.1.16 validation (Windows Zotero 10.0.6)

- Real original 19-page Berger `Musica Ficta` copy: page 14 -> 15 native navigation in Width Fit showed 97px left/right difference before this fix; with automatic cross-page horizontal fit, 0.8px after. Explicit Fit remains 0.8px. A manual 31px horizontal move inside page 15 was not overridden.
- With Detect Margins OFF and Fit Height ON, OS-level trusted Windows PageDown and PageUp were delivered to the current PDF's native-page handler: exactly 8 -> 9 -> 8; native ArrowDown left intact. With detection ON, existing content-aware stepping remains.
- Fit Height uses 8 PDF-unit upper/lower safe gutter instead of 16, retaining 16 horizontally. Browser's additional scrollbar/viewport reserve remains in force.
- v0.1.16 test and release details: [report](2026-10-12-v0116-berger-height-page-keys.md).

## Native Zotero 10.0.6 Windows tests

- **99/99** Node unit tests passed with new active-reader ownership and inactive-pane no-refit checks.
- **78/78** default Zotero native integration checks passed, with the current three-button toolbar expectation and original native button hidden. Retained text selection, highlight coordinates, rotation, split panes, detached windows, PDFs unchanged, fallback detection, fit and unload/reinstall checks. The detached-reader startup timeout was raised only for cold profile startup, without dropping assertions.
- **34/34** plugin toolbar mode-toggling checks passed in prior v0.1.13 tests (same UI code).
- **28/28** content-height/continuous-scroll integration checks passed on the candidate.
- **10/10** background indexing/JSONL checks passed. One native debugger transport timed out *after* writing a valid `passed: true` result file; Zotero assertions, not transport error, are authoritative in this harness.
- **24/24** JSONL cache/faraway folio checks passed.
- **All-open native indexing**: the active one-page PDF B finishes first; hidden A automatically continues from partial cache to **24/24** without ever becoming active. The worker stops after all opened PDFs are complete. With active 24-page B, A remains untouched until B completes, then A starts.
- **Annotation parity**: background print scanning merges display-only annotation geometry; a generated annotated PDF matches normal display's content extents within 3 PDF units with reliable, non-full-page bounds.
- **Fit OFF**: detection/indexing remains active while Detect Margins is ON; viewport scale and position stay unchanged. Detect Margins OFF stops indexing.
- **Windows OS-level keyboard injection** into the confirmed foreground disposable Zotero window produced two actual MarginFit `snapToContent` calls (8 -> 9 and 9 -> 8). ArrowDown was delivered as native trusted input without a whole-page MarginFit call. This verifies the input route; it is NOT the same as testing the user's physical hardware.

## A/B analysis: do not switch algorithms yet

See [experimental evidence](2026-10-12-v0114-verification-and-ab-results.md).

- Parity six-page model: 138 held-out samples in 18 real research PDFs, 135 usable comparisons. A low-resolution independent reference found 20 predicted crops beyond the 16-PDF-unit safety padding plus 2-unit tolerance. Not safe as a replacement for precise page bounds.
- Complex mixed-pages operator-list-first versus raster-first: 20 page pairs; raster-first won on 17 pairs (normal arm order) and 16 pairs (reversed order), with paired median savings of 49ms and 85ms; render pixel hashes matched for all pages. Not a global win across all document types.
- Generated actual pure-text PDF: existing fastpath 3-4 ms versus naive raster-first 129-183 ms on three matching pages. Unconditional raster-first REJECTED. A cheap reliable classifier must be separately demonstrated before selective adoption.

## Limitations

OS-level simulated trusted keypresses are not a full physical input-device test. Active-window detection verified for two tabs, not every operating-system window manager. No evidence supports enabling the rejected parity/raster-first variants in v0.1.15. No user PDF/annotation or production Zotero profile was modified by tests.
