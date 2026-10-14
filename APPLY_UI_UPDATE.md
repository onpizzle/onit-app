# ONIT v0.17.1 — Premium UI Patch

This is a **frontend-only** update for an existing ONIT v0.17.0 host.

## What this patch changes
- Approved warm off-white / premium neutral UI system.
- Orange ONIT accent and pill-button system.
- Updated dashboard shell, cards, forms, tabs, filters, brief lists, detail views, More/Data surfaces, notifications and modals.
- Redesigned sign-in, Join Team and Register Organisation experience.
- Matching System Owner, offline and update-repair screens.
- User-approved ONIT logo across the app and new PWA/browser icons.

## What this patch does NOT change
- Backend code.
- Brief workflow or approval logic.
- Google Sheet/Drive routing.
- Organisation isolation.
- User permissions or sessions.
- `onboarding.js`.
- `onit-config.js`.

## Safe install
Upload the contents of this folder to the root of the existing ONIT v0.17.0 host and replace files with the same names.

**Do not delete or replace your existing `onit-config.js`.** This patch intentionally does not include it, so your live directory/template URLs remain untouched.

Also keep your current `onboarding.js` and `ONIT_Organisation_Backend.gs` files exactly as they are.

After publishing, hard-refresh once or open `reset.html` if an installed PWA still shows the old UI.

Suggested commit message:

`ONIT v0.17.1 — premium UI refresh and approved brand system`
