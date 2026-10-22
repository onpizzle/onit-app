ONIT v0.22.0 — ONIT RADAR PRIVATE PILOT

Purpose
- Adds role-aware ONIT Radar to the top of Home.
- Uses existing ONIT data only; no backend schema changes required.
- Maximum 3 attention items at a time.
- Human decides; Radar suggests actions but does not automate reassignment/approval.
- Ignore Today is device-local and resets the next Lagos day.
- Workload signals are explicitly not employee performance scores.

Role behaviour
- Creative Leadership: final approvals + risk on assigned/managed work.
- Traffic: Traffic Queue + workload/timeline collision signals.
- Account Management: Traffic waiting, review waiting, deadline risk.
- Team Lead: work waiting for first-stage review + assigned risk.
- Staff: revisions, urgent assigned work, next job.
- System Owner: organisation risk + capacity watch.

Deploy
PRIVATE PILOT ONLY. Upload index.html, service-worker.js and version.json to cases-private-pilot first.
