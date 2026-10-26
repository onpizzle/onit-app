ONIT v0.29.0 — POLISH, MOTION & ACCESSIBILITY PRIVATE PILOT

BASELINE
Built on the stable ONIT v0.28.1 Connection & Radar Consistency pilot.

WHAT CHANGED
- Subtle section, modal, toast and success-state motion.
- Strong visible keyboard focus states.
- Keyboard activation for clickable work/memory cards.
- Modal focus trapping and Escape-to-close for non-blocking dialogs.
- Screen-reader friendly toast/status announcements.
- Larger mobile touch targets for primary controls.
- Skip-to-main-content link for keyboard users.
- Settings > Accessibility > Reduce motion.
- Automatically respects the device Reduce Motion preference.
- Navigation now exposes the active page through aria-current.

WHAT DID NOT CHANGE
- No Apps Script/backend changes.
- No permission changes.
- No workflow changes.
- No Collision Radar merge; that pilot remains parked for Traffic testing.

TEST DEPLOYMENT
Upload index.html, service-worker.js and version.json to cases-private-pilot.
Suggested commit: ONIT v0.29.0 — polish motion and accessibility
