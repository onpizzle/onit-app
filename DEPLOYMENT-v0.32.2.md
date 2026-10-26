# ONIT v0.32.2 — Deployment

This is a **frontend-only** update when ONIT Backend v0.31.0 AutoCare is already deployed.

1. Open the same live ONIT GitHub repository / Case Pilot project.
2. Replace the existing frontend files with the files from the v0.32.2 frontend package.
3. Make sure `index.html`, `service-worker.js`, `version.json`, `autocare-module.js` and the other shipped module files are committed together.
4. Commit and deploy to the main/live branch.
5. Open the live ONIT URL once online. Confirm Settings → About shows `Frontend v0.32.2` and `Dashboard UI r32201`.
6. Open System Health. `Frontend` and `Dashboard UI` should settle on `CURRENT`.

Recommended commit:
`fix: enforce universal dashboard ui sync v0.32.2`

No backend redeploy is required for this release if Backend v0.31.0 AutoCare is already live.
