# MarginFit v0.1.9 — Append-only PDF boundary cache

Regular release for rapid user testing with Zotero 10.0.5–10.0.x.

## Changes
- Save detected PDF page bounds to append-only JSONL instead of rewriting a complete JSON file after each batch. Keep the original 10-page/10-second batching policy and a single serialized file writer.
- Store only the document key and page count in the header plus four numeric content-boundary coordinates per page. Preserve far-away page-number **Width Fit** optimization and the complete vertical content range.
- Intentionally do not import old JSON caches. Previously scanned PDFs are measured anew as their pages are visited or by the idle indexer. Existing .json files remain untouched and may be cleaned up separately.
- Recover pending records if a write fails, ignore incomplete trailing lines, and avoid overwriting files that cannot be read or have incompatible algorithm versions.
- No database, full-file rehash, compaction, or new background scheduling components.

## Validation
- 90/90 unit checks passed, including batch append, simulated failure, interrupted last line, >3,000 pages, parallel writers and reopening.
- Build completed; static checks and whitespace checks passed.
- **Important limitation:** a fresh native Zotero 10.0.6 test launch was attempted, but the disposable harness debugger disconnected (ECONNRESET) before reporting any assertions. The new IOUtils JSONL path has NOT yet passed a real Zotero integration test; this is a rapid user-test release, not an unqualified compatibility certification.
- Existing v0.1.8 native reader tests still document the unchanged Fit Height, low-resolution detector and idle indexer, but do not certify the changed cache persistence code.

## Rotation experiment
- Zotero's bundled PDF.js read independent original and incrementally rotated copies of a sample PDF. PDF bytes/size and page rotation changed. Fingerprint[0] remained constant; fingerprint[1] changed.
- This demonstrates that hashing only the first fingerprint can miss valid document edits, while the existing two-component cache key detects the tested rotation modification.
- The new native Zotero.PDFWorker.rotatePages test could not complete due to the same isolated harness startup problem; do not generalize the separate PyMuPDF rotation experiment to every Zotero PDF rewrite.
- No new rotation metadata is introduced pending a completed native test.
