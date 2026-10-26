# ONIT v0.32.2 — QA

Passed checks:
- JavaScript syntax: index inline application script + all shipped JS modules.
- Version contract: app `0.32.2`, UI revision `3202`, Dashboard UI revision `32201` match across index, service worker and `version.json`.
- Universal dashboard renderer marks every rendered Home with the same dashboard revision and current role mode.
- Role routing remains: Owner → OWNER; CD/DCD → LEADERSHIP; Traffic → TRAFFIC; Account → ACCOUNT; Team Lead → TEAM_LEAD; everyone else → STAFF.
- Dashboard-only hotfix detection works when app version is unchanged.
- UI-only hotfix detection works when app version is unchanged.
- Newer app release detection works.
- Stale/older CDN metadata cannot downgrade a newer app.
- Service worker broadcasts both app UI and dashboard UI revisions to browser/mobile/desktop clients.
- AutoCare System Health separately reports Frontend and Dashboard UI.
- Settings/About exposes the running Dashboard UI revision.
- Mutation actions remain excluded from automatic retry.
