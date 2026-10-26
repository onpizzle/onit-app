ONIT v0.26.0 — PERFORMANCE / INSTANT INTERACTION PRIVATE PILOT

What changed
- Faster single-tap feedback on mobile and desktop.
- Loading bar is delayed slightly so fast actions do not flash a distracting loader.
- Nested loading states are counted correctly instead of fighting each other.
- Live Firebase changes are coalesced into one render per animation frame.
- Profile-photo hydration, broadcasts and realtime startup are deferred until the main screen is usable.
- Core workflow actions show SAVED immediately after server confirmation while ONIT quietly syncs the refreshed state.
- Static assets use cache-first repeat loads with background refresh.
- Navigation preload is enabled where supported.

No Apps Script/backend change is required.
Private pilot only. Upload index.html, service-worker.js and version.json to cases-private-pilot.
