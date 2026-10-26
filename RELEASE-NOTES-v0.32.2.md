# ONIT v0.32.2 — Universal Dashboard UI Guard

- Adds an independent Dashboard UI revision contract.
- Every role now mounts the same current dashboard shell revision; role-specific data/content remains intentional.
- AutoCare detects a stale dashboard even when the rest of the app version is current.
- Dashboard-only hotfixes can auto-propagate without changing the visible app version.
- Browser, installed mobile PWA and installed desktop PWA all receive dashboard revision signals through Global UI Sync.
- System Health now shows `Dashboard UI` separately.
- Settings/About now shows the running dashboard revision.
- Unsaved forms and active mutations remain protected before automatic UI activation.
