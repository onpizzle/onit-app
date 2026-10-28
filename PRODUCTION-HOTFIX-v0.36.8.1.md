# ONIT Production Hotfix v0.36.8.1

## Confirmed root cause
Production v0.36.8 had an internal release-revision mismatch: `index.html` declared `UI_REVISION=3670`, while `version.json` declared `uiRevision=3680`. The release guard therefore always believed a newer UI revision existed and repeatedly called the automatic refresh path, appending `_ui_refresh` to the URL.

## Fix
- Align app shell, `version.json`, and service worker on v0.36.8.1 / UI revision 36811 / dashboard revision 36801.
- Make background release checks passive: they can detect an update but cannot automatically navigate/reload the current ONIT session.
- Preserve the existing manual `forceFrontendUpdate()` repair path.
- Set `mandatoryUiSync` false.
- No workflow, role, backend, Cases, Pulse, Activation, Ideas, or Traffic changes.

## Deployment
This package is based directly on the currently live production v0.36.8 package. Deploy to the production `main` branch as an emergency hotfix. Render auto-deploy should create v0.36.8.1. Do not modify the backend.

Suggested commit: `ONIT v0.36.8.1 — stop production UI refresh loop`
