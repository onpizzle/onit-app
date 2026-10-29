# ONIT v0.36.9.5 — Shared Action Runner Recovery

## Fixed
- Restored `runAction()` accidentally removed during v0.36.9.4 handover merge.
- Restored `acknowledgeTask()`.
- Removed optimistic generic click listener that could show SAVING before any API request actually started.
- Approval and workflow actions now enter SAVING only when `apiPost()` actually begins.
- Backend remains ONIT v0.31.16; no Apps Script change required.

## Verification
- JOB-2026-017 was checked before this patch: it remained In Review / not approved, confirming the stuck UI had not committed approval.
- All JavaScript and inline scripts syntax checked.
- All `runAction()` call sites have a live definition.
- `acknowledgeTask()` inline handler has a live definition.
- Version alignment: v0.36.9.5 / revision 36950.
