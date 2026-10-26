ONIT v0.28.1 — Connection & Radar Consistency Private Pilot

Changes:
- Preserves last good dashboard state when Apps Script/bootstrap refresh temporarily fails.
- Shows last successful full-sync time on Home.
- Uses clearer stale-data messaging instead of implying ONIT is broken.
- Automatically retries full bootstrap with bounded backoff after repeated refresh failure.
- Forces a full recovery sync as soon as connection health returns.
- Normalises Radar deadline logic across current/internal/client/original deadlines.
- Leadership Radar falls back to the backend Live Brief Overview overdue count if an overdue brief cannot be mapped to an individual deadline field.
- Leadership Deadline Risk metric cannot show zero while the backend overview reports overdue briefs.

No Apps Script/backend change required.
