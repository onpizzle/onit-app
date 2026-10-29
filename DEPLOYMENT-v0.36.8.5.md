# ONIT v0.36.8.5 — Closed-App Web Push

## Frontend
1. Upload/replace the frontend files in GitHub `main`.
2. Commit: `ONIT v0.36.8.5 — closed-app Web Push`.
3. Wait for Render production to show LIVE.

## Backend — required
Deploy ONIT Backend v0.31.11 to the SAME Apps Script Web App deployment URL used by ONIT.
Do not change the frontend API URL.

## Firebase Web Push certificate — one-time
Firebase project: `onit-backend-api`
1. Firebase Console → Project settings → Cloud Messaging.
2. Under Web Push certificates, generate/copy the public VAPID key.
3. Apps Script → Project Settings → Script Properties.
4. Add property:
   - Name: `ONIT_VAPID_PUBLIC_KEY`
   - Value: the Firebase Web Push PUBLIC key.
5. Run `setupOnitV03111()` once from Apps Script. Authorise if Google asks.

## Staff device enrolment — one tap per device
Desktop / Android:
- Open ONIT → MORE → NOTIFICATIONS → ENABLE OUTSIDE-ONIT ALERTS → Allow.

IPhone / iPad:
- Install ONIT to Home Screen first.
- Open the installed ONIT app → MORE → NOTIFICATIONS → ENABLE OUTSIDE-ONIT ALERTS → Allow.

Each browser/device has its own push token. A staff member who uses a laptop and phone must enable both.

## Test
- MORE → NOTIFICATIONS → TEST SYSTEM ALERT.
- Then close ONIT and send that user a real Buzzer/new brief/action-required notification from another ONIT account.
- The receiver should get a native OS notification. Tapping it opens ONIT and routes to the related notification/brief where possible.
