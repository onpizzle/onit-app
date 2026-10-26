ONIT v0.21.2 — Mobile Navigation Refinement

WHAT CHANGED
- Mobile bottom navigation reduced to five primary destinations: Home, Work, Team, Pulse, More.
- Mobile icons enlarged to 25px with larger 62px tap targets and clear labels.
- Archive, Data, Cases and Settings moved into a mobile More bottom sheet.
- More sheet respects existing Data/Cases permissions.
- Desktop navigation remains unchanged.
- Existing Digital Pulse v0.21.1 permissions and verified Apps Script backend URL are preserved.
- PWA cache bumped to onit-v0.21.2-mobile-nav so installed phones receive the new navigation after deployment/update check.

FILES TO UPLOAD TO THE TEST BRANCH
- index.html
- service-worker.js
- version.json

The Pulse JS/CSS files are included unchanged for a complete frontend package.

SUGGESTED COMMIT MESSAGE
ONIT v0.21.2 — refine mobile navigation
