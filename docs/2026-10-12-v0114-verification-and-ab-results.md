# v0.1.14 verification and A/B evidence

Date: 2026-10-12. Candidate branch \`test/validation-and-algorithms\`. Disposable Windows Zotero 10.0.6 profiles; copied real PDFs read-only from the prior 18-document sample. Original user PDFs and Zotero production profile never modified.

## Restored default native acceptance
The v0.1.13 default \`test:integration\` still asserted 2 new toolbar buttons and an active native Reset Zoom; reproduced failure at old contract. Updated this *one test driver* to assert three plugin controls and the native button hidden. Kept all still-useful assertions. Split pane test discovered shared mode changes could refit the other pane; \`syncMode\` now updates that preference and cancels work but does not zoom an inactive pane. Detached reader cold startup needed 60s rather than default 20s in that check. **78/78 passed**, including PDF bytes, highlight selection, panes, rotation, and uninstall.

## Trusted input route
Windows OS-level \`keybd_event\` was sent ONLY after verifying that the actual foreground \`zotero.exe\` command line contained the disposable test profile path. \`PageDown\` and \`PageUp\` reached Zotero's main Chrome window, while \`ArrowDown\` reached the inner reader iframe. Added narrowly scoped main-window PageDown/Up listener for the selected PDF controller. Recorded actual calls: \`snapToContent(9,8)\` and \`snapToContent(8,9)\`. The full PDF stays in continuous scroll mode. Hardware-key testing beyond OS-injected input remains unverified.

## Idle indexer
A two-reader tab test reproduced a bug: B selected yet global index target A, because a background controller could steal the worker. Active-reader eligibility is now determined from the selected tab/detached focused window using the existing discovery tick; one worker only. Observed active B -> A -> B handoffs and correct B page growth. A separate test reproduced a hidden-inactive-A rendering stall after B's 24 pages completed, leaving the worker busy. The safe behavior is to stop after selected PDF is fully indexed and restart only upon selecting an incomplete PDF. After correction, test confirmed A stays unchanged while B active, worker stops after B completes and A resumes when selected. No speculative parallel renderer.

## Six-page odd/even model: accuracy screening
Used the exact 18-document saved sample, independently rendered with PyMuPDF grayscale at 0.55 pixels per point. Predicted normalized parity union from up to six representative quarter/middle/three-quarter pages; held out remaining pages, compared predicted extents (plus 16 safety units) against independent visible ink. **138 held-out, 135 evaluable, 20 exceeded the protected prediction by more than another 2 units.** Dark/blank pages not scored as wins. These are screening estimates, not a full Zotero display oracle. Unconditional parity-based scaling is NOT adopted.

## Mixed-document raster-first paired timing
Native Zotero PDF.js test on 7 real research PDFs classified broadly as text+figures, 20 page pairs. Each arm obtains text and raster. Baseline also requests PDF.js operator list before raster; raster-first skips that request. Results are for these detector components, not whole reading-session latency. Normal order: raster-first lower latency on **17/20**, paired median gain **49ms**. Reversed order: **16/20**, paired median gain **85ms**. Raster pixel fingerprints identical in both paths on every compared page. Measurements include warm/cold worker and OS variation; do not generalize exact milliseconds.

Pure-text negative control in native Zotero: 3 generated strict text-only PDF pages took **4,3,3ms** with operator-list-based fastpath, versus **135,129,183ms** via unconditional raster-first. This is too severe a regression. In a separate 15-page control sampled from 5 broadly 'text' *documents*, all tested pages still failed strict pure-text operator allowlist, demonstrating that document category alone cannot determine page type. Decision: leave the current operator-list classification on by default; investigate a cheap safe page-specific gating signal only if subsequent measurements justify the complexity.

## Evidence files and reproducibility
- \`tests/integration-bootstrap.js\`: restored 78-assertion native acceptance driver.
- \`tests/v0114-active-reader-integration.js\`: real two-PDF scheduling and completion/resume.
- \`tests/v0114-os-key-input.js\`: native isolated reader captures trusted key route and content-step invocations, requires OS/hardware input during its active ready window.
- \`tests/v0114-mixed-native-ab-faithful.js\`, \`tests/v0114-mixed-native-ab-reversed.js\`, \`tests/v0114-text-native-ab.js\`: isolated PDF.js timing drivers.
- Local ignored \`.test-harness/parity-ab-2026-10-12.json\` and the saved original \`real-pdf-sample.json\` contain detailed anonymous per-page results; actual source document paths are not committed.
- Old design proposals and v0.1.2 verification documents remain archived as historical evidence.

All behavior fixes in v0.1.14 were driven by reproduced failures. The two optional algorithm changes were NOT enabled.
