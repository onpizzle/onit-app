ONIT v0.17.5 — Approved Layout + Larger Typography

This update keeps the approved v0.17.4 layout and working login/API connection. Only typography has been increased slightly (mostly +1px, key headings/numbers +2px) for readability.

Upload the contents of this folder to the existing ONIT GitHub repository root and replace matching files.
Suggested commit: ONIT v0.17.5 — increase UI font sizes

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
