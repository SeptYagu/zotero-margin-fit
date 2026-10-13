# MarginFit native spread selector: private development preview

Status: PRIVATE TEST CANDIDATE. Not published. Based on the public v0.1.16.
This isolated branch uses a distinct 0.1.17pre1 manifest identity to avoid
confusing the experimental build with the stable version. The public release,
official tags, main branch, and main/updates.json remain untouched.

## User-visible change

The Zotero PDF toolbar gains one native three-state button beside Width, Height
and Detect Margins. It cycles:

- 1 = Single Page (native PDF.js spreadMode 0)
- 1|2 = Odd Spreads (native 1): 1-2, 3-4, 5-6...
- 2|3 = Even Spreads (native 2): cover page 1 alone, then 2-3, 4-5...

The button reflects external native View menu changes through Zotero's
spreadmodechanged event and has English / Chinese hover descriptions.
No custom page renderer, separate layout settings, or new scan/cache machinery.

When Fit Height is selected, Page Down / Page Up advances one native group
regardless of which physical page is marked current. Single mode still
advances one page. Detection ON uses existing content-aware navigation; OFF
retains physical-page positioning. Height Fit positions the native spread
horizontally as a group rather than centering only its first page.
Native continuous scrolling and all other reading modes are preserved.

## Tests and evidence

- Native Zotero 10.0.6 PDF.js layout probe confirmed odd pairs [1,2],[3,4],
  even cover [1] followed by [2,3],[4,5] (not a guessed modulo rule).
- npm test: 102/102 passed, including odd/even grouping, cover, last-page cases.
- Native three-state toolbar cycle; native View change synchronization;
  actual PDF.js grouping, group-aware navigation, second-page normalization,
  Detect OFF and continuing multi-page scrollbar: passed.
- Real Windows OS keyboard input in disposable Zotero profiles: odd mode
  PageDown/PageUp 3 -> 5 -> 3; even mode 2 -> 4 -> 2.
- Existing native suites passed: UI, Height Fit, standard integration,
  cache and reopened documents, all-open background indexing, background
  worker, annotation handling, Fit OFF caching, and active-reader priority.
- Nothing installed into the production Zotero profile. Input test verifies
  OS-synthesized trusted key events, not human keyboard or macOS/Linux.

## Known scope and review

This is deliberately minimal. The existing Height Fit scale is based on
the target page; extremely mismatched page sizes or narrow windows may not
allow both pages to fit entirely on screen. This private candidate does NOT
attempt a custom two-page scaling engine.

Before any user-facing release, review the private build visually with
representative books, review page visibility on a narrow window, and obtain
explicit owner approval for a specified stable release. Do NOT push a normal
GitHub Release, a publish/v* staging branch, any release tag, or the public
automatic-update feed without approval.
