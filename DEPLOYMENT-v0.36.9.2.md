# ONIT v0.36.9.2 — Startup Hydration Recovery

Frontend-only stability correction on top of v0.36.9.1. Backend remains v0.31.14.

## Root cause fixed
- v0.36.9.1 went straight to the heaviest `bootstrap` request on every reopen.
- `apiGet()` retried the heavy bootstrap while `loadFromGoogle()` also retried it, allowing repeated heavy Apps Script requests during a slow/cold startup.
- The previously proven startup snapshot + `homeBootstrap` first-paint path had been dropped.

## v0.36.9.2 behavior
- Restores the last confirmed workspace snapshot immediately when available.
- Otherwise loads lightweight `homeBootstrap` first.
- Hydrates the full workspace quietly after first paint.
- Uses single-flight GET requests so duplicate bootstrap/pulse calls share one request.
- Full bootstrap gets a 45-second timeout, but never blocks first paint when snapshot/homeBootstrap is available.
- Silent full hydration gets one attempt; interactive full load gets at most two sequential attempts.
- Successful full hydration writes a new IndexedDB startup snapshot.
- A transient background hydration failure no longer blanks a usable workspace or shows a false reconnect banner.
- Keeps the v0.36.9.1 no-auto-reload / no-mid-session-worker-takeover protections.

## Deployment
1. Upload all files in this folder to GitHub `main`, replacing matching frontend files.
2. Commit: `ONIT v0.36.9.2 — restore fast startup hydration`
3. No Apps Script deployment is required if Backend v0.31.14 is already live.
4. After Render is LIVE, fully close ONIT once and reopen normally. Do not repeatedly hard-refresh.
