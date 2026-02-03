# Desert Storm Team Assignment Generator

Web app for assigning players to teams and generating map overlays for Desert Storm. Player data is stored per user in Firebase so team organizers can reuse rosters across sessions.

**Status**: Browser-only UI with Firebase Auth + Firestore backend.

**Highlights**
- Upload a player database from Excel and store it per user
- Select Team A and Team B (20 each) with filters and sorting
- Generate map images and Excel exports
- Google or email/password sign-in
- Local vendor libraries (no CDN required)

**Requirements**
- A Firebase project with Auth + Firestore enabled
- Modern browser (Chrome, Edge, Firefox, Safari)

**Quick Start (Local)**
1. Copy irebase-config.example.js to irebase-config.js and fill in your Firebase config values.
2. Open index.html in a browser.
3. Sign in and upload your player database.
4. Select teams and generate downloads.

**Firebase Configuration**
- irebase-config.js is ignored by Git. Keep real credentials local.
- For hosted use (e.g., GitHub Pages), set API key restrictions and allowed domains.
- Password accounts must verify email before use.

**Project Layout**
- index.html Main UI
- irebase-module.js Firebase Auth + Firestore logic
- irebase-config.js Local, untracked Firebase config
- irebase-config.example.js Safe template
- endor/ Local copies of SheetJS + Firebase SDKs
- desert-storm-map.png Map image
- 	est-firebase-config.html Quick config sanity check

**Data Storage (Firestore)**
- Collection: users
- Document ID: Firebase Auth uid
- Fields: playerDatabase (map keyed by player name), metadata (counts and timestamps)

**Usage Flow**
1. Download the template from the UI and fill in player details.
2. Upload the Excel file to store the database in Firestore.
3. Filter and select players for Team A and Team B.
4. Generate map images and team Excel files.

**File Size Limits**
- Excel uploads are capped at 5MB per file.

**One-Time Migration (Email Doc IDs -> UID Doc IDs)**
1. Install Node.js LTS.
2. Install dependencies: 
pm install
3. Dry run: 
ode scripts/migrate_users_email_to_uid.js --service-account PATH_TO_SERVICE_ACCOUNT.json --project-id YOUR_PROJECT_ID
4. Apply changes: 
ode scripts/migrate_users_email_to_uid.js --service-account PATH_TO_SERVICE_ACCOUNT.json --project-id YOUR_PROJECT_ID --apply
5. Optional cleanup: add --delete-old to remove old email-based docs after migration.

**Hosting (GitHub Pages)**
1. Commit the repo (excluding irebase-config.js).
2. Enable GitHub Pages on the repository.
3. Use the hosted URL in your Firebase API key restrictions.

**Troubleshooting**
- "Firebase config not found": Ensure irebase-config.js exists and is filled in.
- "Permission denied": Check Firestore rules and that the user is signed in.
- "Email not verified": Verify the email address and sign in again.
- "File too large": Reduce Excel file size below 5MB.

**Security Notes**
- Do not commit irebase-config.js.
- Use restricted API keys and secure Firestore rules.
- Data is stored in Firestore; this is not an offline-only tool.

