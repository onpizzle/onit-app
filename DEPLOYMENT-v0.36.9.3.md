# ONIT v0.36.9.3 — Backend Verification + Startup Loader Isolation

## Backend
Keep ONIT Backend v0.31.14 exactly as deployed. No Apps Script update is required for this release.

## Frontend
Upload all files from this package to GitHub branch `main`, replacing matching files.

Recommended commit:

`ONIT v0.36.9.3 — verify backend and isolate startup loader`

Wait until Render shows LIVE.

## First launch after deploy
1. Close every ONIT window / installed ONIT app on the test device.
2. Reopen ONIT normally from `https://onit-d5sr.onrender.com/` or the installed app.
3. Do not repeatedly hard-refresh.

ONIT now health-checks its backend before workspace hydration.

If the backend is healthy, the normal Home workspace loads.
If it is not, a visible `ONIT CONNECTION CHECK` card appears with the exact failure and a `RETRY BACKEND` control. This replaces the old blank-shell / fake reconnect state.
