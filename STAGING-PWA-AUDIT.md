# ONIT 0.37.1 — staging retirement stability audit

## Outcome
Patched the supplied 0.37.0 frontend. This is a source delivery, not a deployment. It addresses the staging-retirement portion of the stability audit; it does not claim a completed audit of unrelated application workflows.

## Findings and fixes
- Confirmed blank-screen styling defect: visual-contrast.css applies `body * { color:#171717!important }`, overriding the white retirement copy over a #171717 background. The button remains visible. The replacement notice uses a white background and dark text, an explicit heading, and accessible links/buttons.
- The previous staging gate combined a mutable global flag with broad staging/preview hostname matching. All staging decisions now require the exact HTTPS staging origin; production cannot match, even with a stale global flag.
- The original gate evaluated standalone mode at DOMContentLoaded. The new policy snapshots explicit mode at the earliest inline script and rechecks before rendering. Browser mode wins if signals conflict. Top-level context is required; exceptions and unknown mode default to the application. Media-query `.matches` and `navigator.standalone` must be strictly boolean true.
- No referrer, query string, localStorage value, service-worker controller, notification permission, viewport size, or installed-app event establishes retirement eligibility. No persisted install flag was found in the supplied source.
- Display-mode changes, pageshow/BFCache restore, focus and visibility events can remove an existing notice, never create one. Removing it is final for that document. Each fresh navigation starts with a fresh mode decision.
- Retired staging notice says exactly “This staging app is retired.” It has a normal, explicit Open Production link to the production root in a new browsing context, plus Continue staging testing. There is no automatic redirect and no location assignment in the retirement path.
- Removed the staging load handler that unregistered every same-origin worker and deleted ONIT caches on every staging load. Retirement no longer mutates workers/caches at all. This optional cleanup was omitted to avoid disrupting browser testing or another tab. Existing stale workers can remain registered until manually removed; the supplied worker uses network-only shell navigation and does not cache index.html.
- AutoCare treats staging as BROWSER ONLY and does not attempt worker repair there. Staging still suppresses installation prompts and manifest injection. Production registration remains unchanged (relative root worker, updateViaCache none).
- Release Guard now uses the same exact origin classification.
- Existing manual update/repair code performs same-origin redirects and same-origin ONIT cache cleanup. It is not retirement logic and cannot change eligibility. Worker/cache APIs cannot reach the separate production origin from staging.
- Version, asset query strings, worker cache name and release revisions are aligned to 0.37.1 / UI 3701 / dashboard 37011 so clients can discover this patch.

## Manifest and worker scope
The supplied archive contains 27 frontend files but no manifest.webmanifest, offline.html, reset.html, icons or logo assets. Both live manifest endpoints were successfully read on 28 October 2026 using HTTP GET. Both contain start_url `./`, scope `./`, display `standalone`, and display_override `[standalone, window-controls-overlay, minimal-ui]`. Their relative root URLs resolve independently on each origin; neither points to the other origin. Preserve these existing files during deployment. No manifest changes are included.

The frontend registers `./service-worker.js` without an explicit scope, yielding its script-directory scope (root for these deployments). The worker rejects cross-origin fetch handling. Its ONIT cache deletion and page cleanup are origin-bound. The worker has no retirement UI or retirement redirects. Older installed/cached releases outside the supplied archive cannot be fully audited here.

## Verification
- PASS: all 16 external JS files / non-empty inline script blocks parse.
- PASS: 24 automated Node policy/DOM harness scenarios: staging browser, standalone, iOS standalone, conflicting signals, unknown/throwing APIs, late mode changes, iframe, production, unrelated preview host, wrong protocol and port, repeated fresh launches, removal and no reentry on lifecycle events.
- Run: `node tests/staging-policy.cjs`.
- A Playwright end-to-end suite is included at tests/staging-retirement.cjs. NOT RUN: this environment has no browser executable, and the Chromium download returned an invalid archive. With Playwright and Chromium available, run `node tests/staging-retirement.cjs`.
- No actual installed Android/iOS/desktop PWA was exercised. No live deployment or authenticated application workflow was tested. The source explains the invisible text definitively; the intermittent browser misclassification itself was not reproduced on the user's device.

## Limits and release checks
Web content does not have a universal API that proves which manifest originally installed its current app window. This patch uses the platform's explicit standalone presentation signal at the exact staging origin, never an inferred installation heuristic. Ambiguous modes remain usable. Fullscreen, minimal-ui and window-controls-overlay alone do not activate retirement.

Deploy these files as an overlay onto the existing repo, retaining files absent from this ZIP. Do not delete the existing manifest, offline/reset pages, icons or assets. Then verify on actual Chrome desktop/Android and iOS:
1. Staging browser tab: initial load, repeated refresh, back/forward, full screen and a tab with an existing staging worker all show the complete sign-in/application UI.
2. Installed staging app: readable retirement message, working production link and working Continue staging testing.
3. Open staging in an ordinary tab while the old app is installed: no retirement notice.
4. Production tab and production installed app: no retirement notice; installation and worker updates remain functional.
5. Verify production and staging manifests resolve scope/start_url to their own origins; check the deployed worker scope in DevTools.
6. Test an old worker updating to this release and recovery from a cached historical shell. Code already served from a historical cache cannot be repaired by a patch until the updated HTML is fetched.

Chrome's “You can change how links open in App settings” is browser-owned UI, not a string or redirect found in this frontend. This patch does not alter OS/browser link-capture preferences.
