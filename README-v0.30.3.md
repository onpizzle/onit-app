# ONIT v0.30.3 — Digital Pulse Access Fix

Fixes Digital Pulse being blocked by a transient/failed capability pre-check.

- All active ONIT users can open/view Pulse.
- Digital department users retain edit controls.
- Backend permissions remain authoritative for mutations.
- Capability check failure now falls back to the authenticated session instead of blocking navigation.
- Includes the Pulse JS/CSS files explicitly so the latest shell cannot run against a stale Pulse module.

No Apps Script/backend change is required.
