# ONIT v0.30.7 — Pulse Quiet Leadership Sync

Frontend-only refinement on top of v0.30.6.

- Digital editor remains protected from auto-refresh while working.
- DCD/CD/MD/Kunbi view-only Pulse no longer visibly refreshes every 7 seconds.
- Leadership checks Pulse quietly once per minute.
- If saved Pulse data has not changed, the UI is not touched at all.
- If saved Pulse data changed, only then is the current Pulse view redrawn, with scroll position restored.
- Manual REFRESH remains available for an immediate check.
- Global ONIT bootstrap refreshes no longer force a Pulse redraw.
