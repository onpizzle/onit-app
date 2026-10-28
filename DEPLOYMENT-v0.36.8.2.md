# ONIT v0.36.8.2 — Production Deployment

1. Upload the contents of the v0.36.8.2 repo-root ZIP to GitHub `main`.
2. Commit message: `ONIT v0.36.8.2 — Memory typing + notification routing + functional audit`
3. Render production auto-deploys from `main`.
4. Do NOT change Apps Script. Keep ONIT Backend v0.31.10.
5. After Render shows LIVE, hard refresh once (Cmd+Shift+R on Mac Chrome).
6. Verify:
   - Memory: type a full phrase continuously.
   - Notifications: open bell; click a brief notification; verify exact brief opens.
   - Bell: opening the panel alone must not clear unread items.
   - Brief Search and Team Sort still work.
   - App remains stable without `_ui_refresh` cycling.
