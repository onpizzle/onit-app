# ONIT v0.36.8.4 — Safe Update Propagation

## Deploy
1. Upload the contents of this ZIP to GitHub `main`, replacing matching files.
2. Commit message: `ONIT v0.36.8.4 — safe staff update propagation`
3. Let Render production finish deploying.
4. Do not change Apps Script; keep Backend v0.31.10.

## Existing devices currently stuck on v0.36.8.2 or older
The older frontend intentionally disabled automatic page switching to stop the historical refresh loop. Those already-open sessions may therefore need one clean restart: fully close ONIT and reopen it, or hard-refresh once in the browser. Do not uninstall the PWA.

After a device has received v0.36.8.4, future releases are detected every 60 seconds and on focus/online events. ONIT only applies a pending UI release when the page is visible, online, idle for at least 8 seconds, no mutation is running, and no unsaved form section exists. A five-minute one-shot reload guard prevents refresh loops if a deployment edge temporarily serves an old shell.
