# ONIT v0.32.1 — AutoCare v1.1 + Global UI Sync

Built on v0.32.0 AutoCare. No workflow, role, dashboard, Digital Pulse, Cases, Traffic, Buzzer or data model is removed.

## Global UI Sync

Every published ONIT client now follows one frontend release: `version.json`. This applies to browser sessions and installed PWAs on mobile and desktop.

- Checks the published UI release every 60 seconds while ONIT is active, plus on focus, resume and reconnect.
- Uses semantic version + `uiRevision` so only newer UI builds trigger an update; it will not downgrade a user to an older cached release.
- Broadcasts a new release across other open ONIT tabs/windows on the same device.
- Service worker announces newly activated UI versions and removes older ONIT caches.
- The service worker broadcasts the new release to open clients; the page applies it when no form or mutation is active.
- Visible sessions protect unfinished forms or active mutations. The update stays pending and activates automatically as soon as the screen is safe.
- JavaScript/CSS UI assets are network-first with offline cache fallback, while the app shell and version file are always network/no-store.
- Manual `REPAIR INSTALLED APP` remains available as the hard recovery path.

## Important boundary

Global UI Sync updates the ONIT frontend automatically. It does not deploy new source code by itself: once an approved frontend release is published to the existing ONIT host, every client converges on it automatically.
