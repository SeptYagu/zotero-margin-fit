# MarginFit version and release policy

Adopted 2026-10-12 per project owner.

1. When an iteration is functionally complete and its available acceptance tests pass, increment the plugin version, ship a **normal public GitHub Release** with the corresponding XPI, and update Zotero's public `main/updates.json` to the published asset's real SHA-256. Do not leave completed work solely on a development branch or unreleased draft.
2. Keep each iteration testable through Zotero's existing automatic add-on update mechanism; offer a direct GitHub XPI link. Never silently install into a user's production Zotero profile or modify originals.
3. Publish in order: unit tests, relevant native isolated Zotero tests and representative real PDF checks where the harness runs, deterministic build/hash, tag, published asset verification, update feed, optional native update smoke test, and final verified release note.
4. Tests which cannot complete must be explicitly named in release notes, never marked passed. A limited test release can go forward for user feedback when its risks are disclosed, existing smoke tests have passed earlier, no known critical blocker remains, and release is specifically intended for rapid user testing.
5. Preserve deliberate long-distance page-number Width Fit, manual pan, low-cost sparse sampling, and per-document persistent four-coordinate caching. Maintain v0.1.7 historical release intact.
6. Reports of bugs in a newly published version form the next iteration rather than preventing the user from obtaining the current tested improvements.
7. All reviews, changes and optimization proposals must comply with [mandatory engineering principles](ENGINEERING-PRINCIPLES.md). Unverified hypotheses are not release requirements; preserve simple, measured solutions.

Public auto-update feed has to refer to an **already available** XPI; never move the feed ahead of GitHub's published asset.
