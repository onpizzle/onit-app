# ONIT v0.36.8.2 — Functional Audit QA

## Scope
Production frontend functional audit on top of v0.36.8.1. No backend/schema changes.

## Confirmed defects fixed
1. Memory search input rebuilt on every keystroke, causing focus loss after one character.
2. Background Memory refreshes (external source load, silent bootstrap, Firebase/Unified Sync) could rebuild the Memory root and steal focus.
3. Base notification rows had no click target.
4. Notification panel open path could mark all notifications read in the base implementation.
5. Notification routing failed safely only for live briefs; old/non-live brief notifications had no robust destination.
6. Global unsaved-form protection treated search/sort controls as unsaved work, potentially blocking sync/update behaviour.
7. Duplicate `parseJsonArray()` definition allowed a weaker later implementation to override the safer helper.

## Behaviour after patch
- Memory accepts continuous typing without replacing the input node.
- Search results/counts update independently of the search field.
- Memory query survives background sync and external source refresh.
- Notification entries are keyboard-accessible buttons.
- Clicking a brief notification opens the brief when loaded; otherwise ONIT opens Memory pre-searched for the brief code.
- Data-export notifications route to Data; Pulse/Digital to Digital Pulse; Case to Cases; Activation to Activation; Ideas/Signal to Ideas Dump.
- Only the notification opened by the user is marked read.
- Opening the bell does not bulk-mark notifications read.
- Brief Search, Memory Search and Team Sort are transient UI and no longer set unsaved-form protection.

## Automated/static checks
- All .js files parse with Node syntax check: PASS
- Inline index scripts parse: PASS
- `index.html`, `version.json`, `service-worker.js` all report v0.36.8.2: PASS
- UI revision aligned at 36812 across all three version sources: PASS
- All local script references in index.html resolve in package: PASS
- Inline event-handler function audit: PASS (no unresolved handlers)
- Only one `parseJsonArray()` definition remains: PASS
- Memory direct `oninput=renderMemory(...)` removed: PASS
- Unified Sync prefers `memoryUpdateDynamic()` rather than full Memory re-render: PASS
- Release check remains passive; pending UI update processor does not auto-reload mid-session: PASS

## Environment limitation
A full authenticated browser session against the live Google/Firebase backend was not executed in the build container. Final verification must be done on Render production after deploy, with a real ONIT account.
