# ONIT Full Code Audit — v0.36.9.3

## Scope audited

Frontend runtime reviewed as one system, not as individual patches:

- `index.html`
- `service-worker.js`
- `version.json`
- `sync-engine.js`
- `release-guard.js`
- `authority-engine.js`
- `autocare-module.js`
- `cases-module.js`
- `activation-command.js`
- `ideas-dump.js`
- `pulse-module.js`
- `assist-traffic-module.js`
- `core-intelligence.js`
- `attention-loop.js`
- `command-palette.js`
- `dialog-system.js`
- all matching CSS files

Backend reviewed together:

- `Code.gs`
- `Activation.gs`
- `AssistTraffic.gs`
- `Cases.gs`
- `Ideas.gs`
- `Pulse.gs`
- `appsscript.json`

The live ONIT Google Sheet was also inspected for required tabs and headers.

## What was ruled out

### Render/public ONIT link
The public Render address is serving the ONIT frontend. The link itself is not the cause of the blank startup state.

### GitHub frontend deployment
GitHub `main` contains the current v0.36.9.2 line before this fix. The user was not simply running a missing GitHub upload.

### ONIT database
The connected ONIT spreadsheet exists and its core schema is intact. Core tabs verified include `ORGANISATIONS`, `USERS`, `CLIENTS`, `BRIEFS`, `ASSIGNMENTS`, `ITERATIONS`, `ACTIVITY_LOG`, `NOTIFICATIONS`, `REPORTS`, `SESSIONS`, `BUZZERS`, `PUSH_TOKENS`, and `DATA_EXPORTS`, plus the Cases, Activation, Digital Pulse, Ideas, and Traffic tabs.

### Current account/session
The current ONIT user record is active and the stored session has not expired. The blank shell is therefore not explained by a deleted user or an expired session.

### Backend v0.31.14 code regression
Compared with v0.31.13, v0.31.14 changes only:

1. backend version number;
2. removal of Buzzer/personal-preference actions from organisation-wide state invalidation;
3. addition of `setupOnitV03114()`.

`Activation.gs`, `AssistTraffic.gs`, `Cases.gs`, `Ideas.gs`, `Pulse.gs`, and `appsscript.json` are unchanged between those two packages. The backend package itself did not introduce a bootstrap-code regression.

## Root problems found

### 1. No verified backend endpoint at runtime
The frontend trusted a single hardcoded Apps Script deployment URL. The ONIT code history contains more than one backend deployment URL, but startup never checked whether the selected URL was actually the compatible ONIT backend before attempting `homeBootstrap`/`bootstrap`.

Result: the UI shell could open successfully while all workspace hydration failed, producing an empty Home screen and a misleading reconnect message.

### 2. The reconnect message could claim cached data existed when it did not
`lastSuccessfulSyncAt` was stored separately in localStorage. A timestamp could survive even when no IndexedDB workspace snapshot was available.

Result: ONIT could say "Showing last synced data" while showing an empty dashboard.

### 3. `assist-traffic-module.js` replaced the global workspace loader
The module captured `loadFromGoogle()` and reassigned the global function. Every subsequent full workspace load then waited for an additional `trafficCommandData` request.

Result: code outside the core startup path could change the semantics and duration of every bootstrap. Fixes made in the core loader were not necessarily the final loader used at runtime.

### 4. Digital Pulse contained another global loader wrapper
The Pulse wrapper was effectively a no-op, but it added another unnecessary global interception point.

### 5. Excess background capability polling remained
Cases and Activation were refreshing capabilities every 60 seconds and on focus. Digital Pulse was polling every 60 seconds. These were not the direct cause of the empty first paint, but they increased background request pressure and made lifecycle debugging harder.

## v0.36.9.3 corrections

### Backend health resolution before workspace hydration
ONIT now has two known backend candidates. Startup performs an anonymous `health` probe before using either backend.

A candidate is accepted only when it returns:

- `success: true`
- `app: "ONIT"`
- a backend version at or above v0.31.13

The verified endpoint is saved locally and rechecked periodically. The URL is never selected only because it was previously cached.

### Automatic safe fallback
If the preferred deployment is unavailable/incompatible, ONIT tests the alternate known deployment. Read-only GET requests can fail over once when the selected backend becomes unreachable.

Mutating POST requests are not blindly repeated across deployments, avoiding duplicate writes.

### Explicit backend recovery UI
If no compatible backend is reachable, ONIT no longer displays an empty dashboard with an endless fake reconnect state.

It displays an `ONIT CONNECTION CHECK` card with:

- the actual health-check failure;
- `RETRY BACKEND`;
- `SIGN OUT`.

### Accurate cached-state messaging
ONIT only says it is showing a previous workspace when a real IndexedDB workspace snapshot was restored. A leftover sync timestamp alone is no longer treated as usable cached data.

### Core loader ownership restored
`assist-traffic-module.js` no longer overrides `loadFromGoogle()`.

Instead, the core application emits `onit:workspace-ready` after:

- cached snapshot restoration;
- fast Home bootstrap;
- full bootstrap.

Traffic/Assist listens to this event and refreshes its own supplemental data independently. It can no longer block or redefine core workspace hydration.

The unnecessary Pulse `loadFromGoogle` wrapper was removed as well.

### Lower background request pressure
Cases and Activation capability checks were reduced to a five-minute cadence and no longer fire simply because the window gained focus.

Digital Pulse quiet leadership polling was reduced to five minutes and skips hidden tabs.

### Existing stability protections preserved
The build keeps the v0.36.9.1/v0.36.9.2 protections:

- no automatic UI reload;
- no `clients.claim()` takeover;
- no active-session `skipWaiting()`;
- 60-second coalesced full-sync cooldown;
- single-flight full hydration;
- no duplicate state-version full sync;
- no organisation-wide wakeups for Buzzer/personal preference activity;
- startup snapshot + `homeBootstrap` first-paint path.

## Validation results

- All external frontend `.js` files: syntax PASS.
- Both non-empty inline `index.html` scripts: syntax PASS.
- All six Apps Script `.gs` files: syntax PASS under V8-compatible static parsing.
- Frontend literal API actions checked against backend: 101 actions, 0 missing.
- Local script references in `index.html`: 0 missing.
- External modules overriding `loadFromGoogle`: 0.
- `location.reload()` automatic calls: 0.
- `clients.claim()` calls: 0.
- `skipWaiting()` runtime calls: 0 (the phrase remains only in a comment explaining it is forbidden).
- `location.replace()` calls: 1, only in the deliberate manual installed-app repair flow.
- Version alignment: `index.html`, `version.json`, `service-worker.js` = v0.36.9.3 / UI revision 36930.
- Backend database schema: core required tabs/headers verified present.

## Deployment rule

Backend remains **v0.31.14**. Do not redeploy Apps Script for this frontend recovery build.

Deploy the v0.36.9.3 frontend to GitHub `main`. After Render is LIVE, close every ONIT window/app on the device once, then reopen normally.

Expected result:

- If the configured backend is healthy, Home hydrates normally.
- If the hardcoded deployment was the actual problem, ONIT automatically uses the compatible known endpoint.
- If neither known deployment is healthy/compatible, ONIT shows the exact backend health failure instead of a blank workspace.
