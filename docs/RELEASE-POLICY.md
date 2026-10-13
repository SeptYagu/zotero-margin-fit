# MarginFit release and update policy

Updated 2026-10-12, after the author publicly announced MarginFit on the Zotero forum.
**This replaces the earlier automatic quick-iteration release policy.**

## 1. Public users come first

MarginFit now has external users. A developer's convenience does **not** justify
publishing every tested change to everyone. The last approved public Release
and its updates.json feed remain stable until the project owner **explicitly
approves a particular new version for public release**.

## 2. Default: develop, test, report - do not publish

- Implement functional changes on isolated development branches/worktrees.
- Build clearly labeled **private test XPI** files when useful, and validate
  them in isolated Zotero profiles. Private testing is NOT a public Release.
- Report the reproducer, changes, observed behavior, tests, known limitations,
  performance and compatibility impact, and recommended release grouping.
- **Do not automatically** bump the public stable version; push release tags;
  create normal Releases or public prereleases; push to the publish/v* branch
  (which triggers a public Release); modify main/updates.json; or merge
  unapproved functional changes into main.
- Feature completion, passing tests, a user's request to test/continue, or
  silence are not authorization to publish. Prior blanket directions to
  publish each working iteration are hereby superseded.

## 3. Release review and explicit approval

Before any public release, present: the intended version, user-visible changes,
test evidence, upgrade compatibility, outstanding risks, and draft notes.
**Ask for the author's explicit approval to publish THAT version.**

Minimum review for the affected areas:
1. Unit tests, isolated native Zotero 10 integration suites, regression tests
   for toolbar, width/height, page keys, cache, all-open indexing, and annotations.
2. Representative real PDFs (including previously problematic scans/mixed sizes)
   for changed detection, crop, or page positioning logic.
3. No unexpected manual-position override, lost content, or significant
   CPU/memory/latency regression. Disclose untested platforms and hardware.
4. Installation/update from the current public stable version, packaging and
   manifest correctness, and concise release notes written for forum users.

Differentiate OS-injected keyboard events from actual physical keyboard checks.

## 4. Publication after owner approval only

Only after explicit approval: finalize version and reviewed merge, validate
XPI SHA-256, create the matching tag, push the publish/v* staging branch,
verify a real publicly visible normal GitHub Release, then update the public
main/updates.json feed to that exact published XPI and verify public hash/URL.
Communicate relevant release changes to the community as appropriate.

A reported bug may warrant urgent work, but it still does not authorize
silently distributing an unapproved automatic update.

## 5. Preserve engineering constraints

Follow mandatory ENGINEERING-PRINCIPLES.md. Keep faraway folio width logic,
content-aware/physical-page navigation, manual positioning, conservative
and efficient detection, persistent PDF cache, and one-worker all-open indexing.
Do not invalidate stored caches without measured justification and approval.
Documentation-only policy changes do not require a plugin version bump.
