# MarginFit v0.1.14 ? Activity priority, trusted keys, repaired acceptance

Regular release for Zotero 10.0.5?10.0.x.

- **PageDown / PageUp:** The real Windows OS keyboard input route now reaches the selected PDF, even when Zotero dispatches those keys to the main Chrome window rather than the reader iframe. One press moves exactly one content page. Arrow keys still permit normal fine scrolling.
- **Idle indexing:** One shared cooperative worker finishes the currently selected PDF only. It switches promptly with tab focus; after that PDF is complete, hidden readers are not scanned (their PDF.js rendering may be suspended). Selecting another unfinished PDF resumes indexing there.
- **Inactive PDF protection:** Shared fit-mode preference updates no longer cause a hidden/split pane to change zoom or position.
- **Tests and docs:** Fix stale default native integration UI assertions; retain remaining native PDF behaviors, increase isolated detached reader cold-start wait. Replace stale current-state documents while archiving earlier historical reports.
- **Existing features unchanged:** Three in-place toggle controls, continuous full-document scroll, content-page transitions, sparse detection, faraway page-number-aware Width Fit and JSONL cache.
- **Algorithm decisions:** Real PDF A/B did *not* authorize activation of six-sample parity-based cropping or unconditional raster-first; the current precise-page and strict pure-text paths remain.

Verification: 99/99 unit tests, 78/78 complete native Zotero acceptance checks, 28/28 height/navigation checks, 34/34 UI checks and 24/24 cache checks, 10/10 idle/JSONL checks; native two-PDF activity and OS-injected trusted PageDown/PageUp navigation exercises recorded. Physical keyboard hardware and macOS/Linux input routes remain unverified.

All tests used disposable Zotero profiles and PDF copies, not production data.
