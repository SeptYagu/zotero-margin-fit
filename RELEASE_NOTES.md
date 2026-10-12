# MarginFit v0.1.15 ? All opened PDFs indexed again

This release restores the original requirement inadvertently lost in v0.1.14: scan the selected PDF to completion FIRST, then automatically scan ALL other still-open PDFs with the single background worker. No activation of each hidden document is needed. New user selection regains priority. The worker stops only after every open document is cached or Detect Margins is disabled.

Cause: background PDF.js display-intent raster rendering can become stuck waiting for animation frames in an inactive iframe. Background-only print-intent rendering is not RAF-driven; the same real Zotero test previously stalled at page 16/24 but now reaches 24/24 while the tab remains inactive.

Safety: print mode omits display-only annotation appearances. The detector now merges visible annotation rectangles into the background content bounds, with conservative full-page fallback if annotation geometry is unreadable. Generated native annotated-PDF tests verified background bounds match foreground within 3 PDF units and remain precise.

Fitting controls are independent: Width/Height OFF stops automatic fitting, but cache indexing continues if Detect Margins stays ON.

Unchanged: full-document continuous scrolling, one-content-page keys, dirty-border detection, folio exception in Width Fit, persistent JSONL and no speculative parity/raster-first optimization.
