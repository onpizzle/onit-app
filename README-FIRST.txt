# ONIT v0.17.4 — Approved Layout / Atomic CSS Fix

This patch fixes the broken-looking v0.17.3 dashboard caused by the installed PWA loading a mismatched/stale stylesheet.

What changed:
- The approved premium UI CSS is now embedded directly inside `index.html`.
- The UI structure and CSS therefore arrive as one atomic file and cannot get out of sync.
- Service-worker cache bumped to `onit-v0.17.4-atomic-ui`.
- External `premium-ui.css` is retained only as a source/reference file; the live UI does not depend on it.
- Working v0.16.1 Apps Script API/login connection remains unchanged.
- No `onit-config.js`, `onboarding.js`, or backend `.gs` file is included.

Upload the CONTENTS of this folder to the root of the existing GitHub repository, replacing matching files.
Commit message: `ONIT v0.17.4 — fix approved UI rendering`

After Render is live, open `/reset.html` once, then reopen the main ONIT URL.
