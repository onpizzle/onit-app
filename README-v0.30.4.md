# ONIT v0.30.4 — Brief Alert Audio Reliability Fix

- Keeps a shared browser audio context armed after the first user interaction.
- Queues new-brief sounds if the browser blocks audio before that first interaction.
- Replays the queued signature brief tone immediately after audio becomes available.
- Does not repeatedly toast/announce the same brief while waiting for audio.
- Adds a visible Brief sound status: ARMED / WAITING FOR FIRST TAP.
- Preserves v0.30.3 Digital Pulse access fix and v0.30.2 signature brief alert.
