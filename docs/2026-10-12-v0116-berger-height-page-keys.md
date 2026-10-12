# MarginFit v0.1.16 ? Berger page 15, Height Fit whitespace, and PageDown without detection

Date: 2026-10-12. All PDF tests used copies in disposable Zotero 10.0.6 profiles, not the production library database.

## Page 15: actual bug and measured cause
Input: the user's original 19-page Berger Musica Ficta PDF. Width mode on, ordinary native PDF viewer transition from page 14 to 15:
- Before fix: plugin's previously applied Width Fit was for page 14. Real page 15 content was shifted ~97 CSS pixels (left-margin minus right-margin); page-15 bounds themselves were plausible, with active ink concentrated about x43..515 PDF units.
- A second explicit Width Fit clicked on page 15 centered detected content to 0.8 CSS pixels of equal left/right space.
- Cause: the renderer did not recenter horizontally on a native page change when the user had not explicitly clicked Fit Width again. Existing in-page manual-motion protection must remain.
- Fix: on true page transition in Width mode, fetch the current page's cache/detection, apply a one-time page-boundary horizontal recenter, preserve existing Y position, use the automatic 4px deadband and cancel if newer user input takes over.
- Real Berger native verification: page 14 -> 15 automatically centers within 0.8 CSS pixels; manual horizontal 31px movement on page 15 is held; explicit button click recenters again.

## Height Fit whitespace
- Width Fit safety margin remains the original 16 PDF units per side.
- Height Fit now uses 8 PDF units above and below the content while retaining 16 units horizontally; ordinary 8px viewport-edge allowance/scrollbar handling is unchanged. This reduces apparent top/bottom whitespace while protecting the detected extremes. Cache coordinates unchanged.

## Height mode with Detect Margins OFF
- The previous keyboard callback gated the entire PageDown/PageUp navigation on Detect Margins ON; disabling recognition therefore restored ineffective native scrolling.
- The key handler now depends on Height mode regardless of recognition state. When detection ON, step to the actual detected content by the existing function. When detection OFF, step one physical page, invoking native Zotero Height Fit and aligning the physical page in the original multi-page continuous viewer. No ink analysis is performed in this branch.
- OS-level Windows key injection confirmed PageDown 8 -> 9 and PageUp 9 -> 8 while Detect Margins OFF. ArrowDown retains native behavior. Injection verifies the real top-level Firefox/Zotero route, but is not a test of all physical keyboards.

## Tests
- `tests/v0116-berger-page15-integration.js` requires the specific original PDF supplied with `-SourcePDF`, checks normal page transition, manual in-page move, repeated explicit Width Fit and Height padding.
- `tests/v0116-height-no-detect-os-keys.js` uses the external Windows OS-key injection during a disposable window test. Not run by default unattended suites.
- `tests/core.test.cjs`, `tests/sparse.test.cjs`, `tests/controller.test.cjs` cover expected geometry and automatic deadband behavior.
- Existing native baseline, height, UI, background and all-open indexer regressions retained. Neither PDF bytes nor Zotero production state changed.
