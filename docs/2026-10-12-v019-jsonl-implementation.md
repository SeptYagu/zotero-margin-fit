# MarginFit v0.1.9 JSONL design, testing, and rotation evidence

Date: 2026-10-12. Implemented on feat/v019-append-jsonl.
Follows docs/ENGINEERING-PRINCIPLES.md: minimal implementation, measured costs, no speculative compatibility system.

## On-disk format
A distinct file per PDF, named <PDF.js fingerprints>-<page-count>.jsonl under
Zotero profile/marginfit-boundaries. Do not import/delete existing .json cache snapshots.
First line: {"algorithmVersion":1,"key":"...","numPages":24}
Other lines: [page,left,top,right,bottom]
Later complete records for the same page supersede earlier ones. Keys can arrive in any order.
Last unterminated line is ignored and separated before the next append.
Never persist failed renders, partial sampled records, extra folio metadata or PDF content.
To preserve the requested special Width Fit, saved X derives from verified body coordinates
when appropriate; saved Y always spans the entire detected content including the remote folio.
Flush at 10 pending pages or 10 seconds, plus close. One promise queue per file.
IOUtils.writeUTF8 uses create for first write and appendOrCreate for subsequent batches;
the full file is read once when a document opens, not on each batch.
On a write error, preserve pending entries for retry and reopen/inspect the file tail.
On an unreadable or incompatible cache file, do not overwrite it.

## Evidence
90/90 JavaScript unit checks passed on 2026-10-12. npm run build succeeded.
Disposable Zotero 10.0.6 native reader test, including IOUtils and Zotero.PDFWorker.rotatePages,
did not complete: startup debugger returned ECONNRESET, and no result.json was produced.
Report native I/O correctness as **unverified**; never conflate the Node fake IO with Zotero.

## Physical PDF rotation study
Installed Zotero 10.0.6 PDF.js extracted from app/omni.ja.
Test folder: %LOCALAPPDATA%/Temp/MarginFitRotationFingerprintTest.
Generated an independent PDF and an incrementally modified 90-degree rotation copy
with PyMuPDF. SHA256 changed, page width/height orientation changed.
PDF.js fingerprint array before: [c38f4408c280c38a2ec2bf16c38c2775, 45e426e4abd5dfc5acd1e8146c3570d6].
After: [c38f4408c280c38a2ec2bf16c38c2775, dd6404d4c108a2ab5d777b01bc324ad2].
PDF.js page rotation changed 0° -> 90°. This proves the first fingerprint alone
can remain stable on a real file edit, and both fingerprints in the new cache key
detect the tested incremental save.
Zotero's installed reader.js itself calls Zotero.PDFWorker.rotatePages(...) then reader.reload()
for the in-app command, confirming its intent to rewrite the PDF rather than transient viewport
rotation. However no completed **native Zotero** saved-PDF fingerprint measurement exists yet.

## Explicitly not added
Old-cache import, archive cleanup, a per-page rotation field, scheduled compaction,
complex retry machinery, or broader UI/event refactoring.
