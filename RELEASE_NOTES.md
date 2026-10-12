# MarginFit v0.1.16 ? Better page centering, tighter Height Fit, independent page keys

Three reader experience fixes:

- **Berger, Music Ficta page 15:** After ordinary navigation from page 14, Fit Width previously left an approximately **97 CSS-pixel difference** between left and right whitespace. Clicking Fit Width again reduced the difference to 0.8 pixels. Now the reader re-centers once at a real page boundary without the extra click, while preserving user horizontal movement within the same page.
- **Tighter Height Fit:** Safety padding above and below actual content is reduced from **16 to 8 PDF units per side**. Left/right protection remains 16 units; real content recognition and PDF annotations are not removed.
- **Fit Height works with Detect Margins OFF:** Page Down / Page Up still move exactly one entire *physical* PDF page, using native Zotero page height. With detection ON, they continue to land on the page's actual detected content. Up/Down arrow fine scrolling and the full continuous PDF scrollbar remain unchanged.

Background indexing still completes all opened PDFs, with the current reader first, and persistent JSONL cache works as before. Parity prediction and indiscriminate raster-first remain disabled.

Verified using a disposable Zotero 10.0.6 profile with an imported copy of the original 19-page Berger PDF, unit tests, and OS-level trusted PageDown/PageUp input. No modification to original PDFs or annotations. OS-level synthesized keyboard input is not equivalent to human physical-key testing on every device.
