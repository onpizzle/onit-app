# ONIT v0.36.8.2

Functional stability hotfix on top of production v0.36.8.1.

- Memory search no longer rebuilds the input on every keystroke.
- Memory async source refresh updates results/counts without stealing focus.
- Notification items are explicitly clickable and keyboard-accessible buttons.
- Clicking a notification marks only that notification read and routes to its brief/module.
- Opening the notification panel no longer marks everything read.
- Search/sort controls no longer poison unsaved-form protection.
- Removed duplicate weaker parseJsonArray definition.
- No backend/schema/workflow changes. Backend v0.31.10 remains compatible.
