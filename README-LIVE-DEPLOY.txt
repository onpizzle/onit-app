ONIT v0.21.3 — APPROVED LIVE UPDATE

Includes only the approved user-facing update:
- Digital Pulse
- Digital department contributor permissions / organisation-wide live viewing
- Home | Work | Team | Pulse | More mobile navigation
- Larger mobile nav icons and labels
- More-sheet support from the approved build
- Pulse mobile header overflow fix
- Existing Cases controls remain intact

IMPORTANT ORDER
1. Update the EXISTING LIVE Apps Script deployment first to a New Version from the currently tested source.
2. Only after the live backend deployment succeeds, upload the frontend files in this package to GitHub MAIN.
3. Do NOT merge the entire cases-private-pilot branch.
4. Do NOT replace the live Apps Script URL with the private test URL.

GitHub MAIN files to upload:
- index.html
- pulse-module.js
- pulse-module.css
- service-worker.js
- version.json
- manifest.webmanifest

Suggested commit:
ONIT v0.21.3 — Digital Pulse + refined mobile navigation
