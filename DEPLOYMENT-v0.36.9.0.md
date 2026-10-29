# ONIT v0.36.9.0 — Stop Update/Refresh Loop

Frontend-only production hotfix. Backend remains unchanged.

## Fixes
- Removes automatic UI reload/apply behavior entirely.
- A newer release may be announced once per device, but ONIT never refreshes itself.
- Stale v0.36.8.x pending-update, reload-guard and broadcast keys are cleared.
- A release notice is persisted so reopening ONIT does not repeat the same popup.
- Version alignment: index.html / version.json / service-worker.js = 0.36.9.0, UI revision 36900.

## Deploy
Upload all files in this folder to GitHub `main`, replacing matching files.
Commit: `ONIT v0.36.9.0 — stop update refresh loop`
No Apps Script/backend change is required.
After Render is LIVE, close ONIT completely and reopen once.
