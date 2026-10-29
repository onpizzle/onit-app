# ONIT v0.36.8.9 — Release Alignment Hotfix

Frontend only. No Apps Script/backend change.

Purpose:
- Fix repeated "ONIT update ready" popup caused by v0.36.8.8 internal revision mismatch.
- Align index.html, version.json, and service-worker.js to v0.36.8.9 / UI revision 36819.

Deploy:
1. Upload these frontend files to GitHub `main`, replacing matches.
2. Commit: `ONIT v0.36.8.9 — fix update-ready loop`
3. Wait for Render LIVE.
4. Open ONIT once and hard refresh if the installed shell does not move automatically.
5. No Apps Script redeploy is required.
