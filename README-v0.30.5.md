# ONIT v0.30.5 — Digital Pulse Draft Safety

Frontend-only private-pilot fix.

- Pauses automatic Pulse re-render while a Digital user has unsaved form edits.
- Autosaves unfinished Pulse form entries to local browser storage.
- Restores drafts after tab changes, reconnects, focus changes, or app refresh.
- Clears only the successfully submitted form section; other unfinished Pulse drafts remain.
- Preserves v0.30.4 brief-alert audio reliability and v0.30.3 Pulse access fixes.

No Apps Script/backend update required.
