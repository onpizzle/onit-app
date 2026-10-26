# ONIT v0.32.2 — AutoCare v1.2 + Universal Dashboard UI Guard

Built on v0.32.1 Global UI Sync. No brief, approval, Traffic, Digital Pulse, Cases, Buzzer or data workflow is removed.

## What changed
- Adds a separate `dashboardUiRevision` to the published release contract.
- Every Home render stamps the running dashboard revision and resolved role mode.
- AutoCare now checks **Frontend** and **Dashboard UI** separately.
- If the app version is current but the dashboard renderer is stale/mismatched, ONIT schedules a safe UI repair automatically.
- Owner, CD/DCD, Traffic, Account, Team Lead and Staff all use the same universal dashboard shell; role-specific content remains intentional.
- System Health shows Dashboard UI status.
- Settings/About shows the running Dashboard UI revision.
- Service worker broadcasts both app UI and dashboard UI revisions to browser/mobile/desktop clients.
- Unsaved forms and mutations remain protected; the repair activates once the screen is safe.

## Deployment
Replace the v0.32.1 frontend files in the live ONIT repository with this package and deploy. Backend v0.31.0 AutoCare remains compatible and does not need to change for this frontend-only release.
