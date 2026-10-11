# MarginFit v0.1.6 — published release verification

Date: 2026-10-10. Status: **publicly released and native Zotero auto-update verified**.

## Published artifact

- Tag: [v0.1.6](https://github.com/SeptYagu/zotero-margin-fit/releases/tag/v0.1.6), resolving to source commit `403c0875bcc76d2b91b642913f1660a6e80444f4`.
- Public XPI: https://github.com/SeptYagu/zotero-margin-fit/releases/download/v0.1.6/zotero-margin-fit-0.1.6.xpi
- Filename: `zotero-margin-fit-0.1.6.xpi`; size: **21,503 bytes**.
- SHA-256: `87be45568ed38530ca16f2033d2222547cdbc811c2046841cab1f98a0a39bc35`.
- The public asset was downloaded without GitHub authentication on the Windows test machine and independently hashed. Bytes and digest match the vetted local XPI and the release asset digest reported by GitHub.
- A hash-verifying GitHub Actions workflow published the exact prebuilt Windows XPI. GitHub workflow run `38100033610` and regular check `38100033601` both completed successfully.

## Published Zotero update feed

- Feed: https://raw.githubusercontent.com/SeptYagu/zotero-margin-fit/main/updates.json
- The remotely fetched feed returns version `0.1.6`, the exact public release download URL, and the identical `sha256:` digest.
- Feed published in Git commit `a6508a1`, after the XPI was already downloadable.

## Native Zotero update verification

`npm run test:update` passed **9/9** checks in an isolated Windows Zotero **10.0.6** profile/database:
- Genuine previously published 0.1.1 XPI was installed with its SHA-256 digest.
- Native Zotero AddonManager discovered 0.1.6 from the public update URL.
- The background update mechanism independently downloaded, verified and activated 0.1.6, without manually installing the new XPI.
- Existing Detect Margins OFF and Fit Height settings survived the update.
- Updated native reader UI buttons appeared with the expected tooltip/state and were then uninstalled from the isolated profile.

Pre-release regression tests on the same 0.1.6 source: **61/61** unit tests, **70/70** reader integration checks, **21/21** cache/folio integration checks, **18/18** native toolbar UI checks.

## Scope and remaining limitations

The tests did **not** modify the user's normal Zotero profile, database, PDFs, annotations, or installed plugin. Automatic background updates on the user's own Zotero may run according to Zotero's normal update schedule; no immediate update was forced.

Empty, dark-background and certain complex pages deliberately retain conservative margins. Exact success on the originally reported book page 76 is not asserted because its source PDF was not provided. Sparse sampling is not guaranteed to detect every theoretical thin isolated mark.

Release packaging and feed publication are complete; no further GitHub Release or feed actions are required for v0.1.6.
