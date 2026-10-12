# v0.1.13: Fit Width and Height as ON/OFF controls

Requirement: hide Zotero's Reset Zoom toolbar control and replace it *in the
same location* with plugin-owned Fit Width, Fit Height, and Detect Margins.
Width and Height are mutually exclusive toggle modes, each with a second-click
OFF state. Detect Margins remains independent.

History: the first *committed* releases retained original Reset Zoom rather
than replacing it. The user's original-position design is newly implemented,
not a feature that existed in those released versions.

Implementation: one stylesheet owned by the plugin toolbar hides #zoomAuto
while the toolbar is mounted. The new Width control occupies the hidden
element's place, followed by Height and Detect Margins. No native button
disabled-state tampering or periodic DOM patching is required. Unloading
MarginFit removes the stylesheet and restores the original button.

Fit mode uses a single persisted preference: width / height / off.
Switching OFF cancels outstanding fitting and leaves PDF zoom/scroll unchanged.
Switching between modes immediately requests the new fit. Newly opened
readers inherit the fit mode. With margin detection OFF, both controls
use Zotero's native page-width / page-height fitting routines and still toggle.

Verification on isolated Zotero 10.0.6:
- 97 / 97 unit checks.
- 34 / 34 native toolbar checks: original hidden, replacement in same
  location, mutually exclusive toggles and selection rings, detection-off
  fallback, OFF state persistence for new PDF, no late zoom adjustment,
  and native restoration on plugin shutdown.
- 28 / 28 content-page navigation checks.
- 10 / 10 background indexing and JSONL caching checks.

No changes to PDF content, background indexer, sparse detection algorithm,
content-page navigation, or PDF cache format.
