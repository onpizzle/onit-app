ONIT v0.30.6 — Digital Pulse Stable Save + Leadership Live Sync

Fixes:
- Digital editors no longer auto-refresh while working in Pulse.
- Pulse drafts register with ONIT's global dirty-form protection, preventing service-worker/update reloads from discarding work.
- Drafts persist across tabs and browser restarts and restore to the last Pulse tab.
- Every Pulse work area has an explicit save action.
- Save Readiness saves only the Morning Readiness checklist/status.
- Leadership view (DCD/CD/MD/Kunbi and other view-only users) auto-refreshes every ~7 seconds while Pulse is open.
- Leadership Today view shows Digital Team Readiness saved by each Digital user.
- Global ONIT frontend reload protection now correctly respects uiDirtySections.
- v0.30.5 and earlier v0.30.x features preserved.

Backend:
Replace Pulse.gs with the v0.30.6 Pulse.gs supplied separately, then deploy a new Apps Script version.
No setup function is required; no sheet schema changes are introduced.

Frontend:
Upload index.html, pulse-module.js, pulse-module.css, service-worker.js, version.json,
assist-traffic-module.js/css and cases-module.js/css to cases-private-pilot.
