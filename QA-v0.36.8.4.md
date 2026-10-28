# ONIT v0.36.8.4 — QA

## Update propagation fix
- Restores automatic application of a detected frontend release, but only at a safe idle boundary.
- Requires: visible page, online state, no active mutation, no unsaved UI section, and 8 seconds without user input.
- Uses the existing reload guard with a five-minute TTL so one stale deployment response cannot cause repeated reloads.
- Keeps release checks at 60 seconds and also checks when the app regains focus or comes back online.
- Memory/search typing remains excluded from unsaved-work protection from v0.36.8.3.
- Notification routing fixes from v0.36.8.3 are retained.

## Expected behaviour
1. User is typing or editing: update waits.
2. User stops and the form has unsaved work: update waits.
3. User is idle with no unsaved work: one safe UI refresh applies the new release.
4. If the refreshed request still returns the old shell, the reload guard prevents a loop and ONIT asks the user to close/reopen instead.

## Version alignment
- index.html: v0.36.8.4 / UI revision 36814
- version.json: v0.36.8.4 / UI revision 36814
- service-worker.js: v0.36.8.4 / UI revision 36814
