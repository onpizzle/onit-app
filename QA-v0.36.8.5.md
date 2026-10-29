# ONIT v0.36.8.5 — QA

PASS — frontend inline JavaScript syntax
PASS — all standalone frontend JavaScript syntax
PASS — service worker syntax
PASS — frontend version 0.36.8.5 / UI revision 36815 aligned
PASS — background Firebase handler displays native notifications
PASS — urgent notifications use persistent/renotify behaviour where supported
PASS — notification click carries notification/brief/buzzer route data
PASS — foreground FCM handler prevents silent foreground delivery and displays a system notification
PASS — registered device can request a server-side push test
PASS — deep-link handling supports notification ID, brief code and Buzzer ID
PASS — existing Memory typing and notification routing fixes retained

Platform rule: closed-app sound is the operating-system/browser notification sound. Custom WebAudio tones can only be played while ONIT has a running page context.
