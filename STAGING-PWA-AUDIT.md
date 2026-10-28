# ONIT v0.37.5 — staging and session stability policy

## Staging behaviour

- Staging remains non-installable: no manifest link is injected and no new service worker is registered on `https://onit-cases-test.onrender.com`.
- Staging is never blocked by a retirement screen. Browser tabs and old standalone staging windows both load the current staging application.
- Legacy staging service workers and ONIT caches are quietly unregistered/deleted after the page is already running. This cleanup never redirects or reloads the current page.
- Production remains the only supported installable PWA.

## Session update behaviour

- ONIT never reloads itself automatically when a newer frontend release is detected.
- Release checks only record the pending version and show a non-blocking notice.
- A newer frontend takes effect on the next normal reopen/refresh, or via the explicit manual repair action.
- Automatic `_ui_refresh` navigation is disabled during normal sessions.

## Background hydration

- Warm snapshot / fast Home can render first.
- Full workspace hydration begins after the first useful screen is stable.
- Silent full sync re-renders only the currently visible section, rather than every hidden workspace section.

## Intent

This policy removes two visible failure modes reported during testing: the dead staging-retirement page and mid-session app disappearance/reappearance caused by automatic frontend reloads.
