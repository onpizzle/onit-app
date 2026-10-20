ONIT FRONTEND v0.18.3 — BROADCAST POPUP EXPERIENCE

WHAT CHANGED
- Owner Broadcast already existed in ONIT. This patch refines the recipient experience.
- Broadcast images now appear as the main hero visual in a centre-screen popup.
- The announcement message sits below the image.
- A clear X close button sits at the top-right. Closing marks the announcement as read.
- ONIT notification sound plays when the popup appears, subject to browser audio permission and the user Notification Sound preference.
- Unread broadcasts remain queued and appear one after another.
- If a staff member was offline, the unread broadcast appears the next time ONIT loads.
- Popup is responsive on desktop and mobile.
- Includes the prior v0.18.2 frontend logo reliability improvements.

NO BACKEND UPDATE IS REQUIRED FOR THIS BROADCAST UX PATCH.
The current v0.15.1 backend already supports Owner Broadcast, image storage, recipients and read acknowledgement.

DEPLOY
1. Upload/replace the files inside this frontend folder in the GitHub repo.
2. Commit message: ONIT v0.18.3 — broadcast popup experience
3. Render should auto-deploy.
4. Refresh ONIT. If installed as a PWA, allow the automatic update/reload.

TEST BEFORE TEAM-WIDE SEND
- System Owner > Settings/More > Staff Broadcast.
- Send the announcement to ONE test staff member first.
- Attach the 1080x1080 visual.
- Confirm popup, image, message, sound and X-close behaviour.
- Then send to all active staff.
