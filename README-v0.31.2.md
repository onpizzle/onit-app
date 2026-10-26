# ONIT v0.31.2 — Owner/DCD Role Authority & Digital Pulse Access Hardening

Frontend-only regression fix built from the approved v0.31.1 baseline.

## Fixes
- System Owner now always resolves to the OWNER dashboard from the signed-in user record, even when a stale backend `dashboardMode` value is present.
- DCD/CD/MD and Kunbi/Kumbi now always resolve to the agency-wide LEADERSHIP dashboard before any stale server dashboard mode is considered.
- Traffic keeps its Traffic Control dashboard; ordinary Account/Team Lead/Staff modes can still use the backend hint as a fallback.
- Digital Pulse navigation remains visible for every signed-in active ONIT user. A transient/stale capability response can no longer hide the Pulse tab from DCD or other active staff.
- Digital users remain the only users with edit controls. DCD/CD/MD/Kunbi/Kumbi/System Owner retain leadership read access, report download and one-page Case controls where the deployed v0.30.8 backend capability allows them.
- Service-worker cache and asset query versions bumped to v0.31.2 so installed/PWA copies fetch the corrected frontend instead of reusing v0.31.1 JavaScript.

## Deployment
Frontend only. Replace the existing hosted frontend files from this package and publish through the existing GitHub/Case Pilot workflow. No Apps Script backend deployment is required for these regressions.
