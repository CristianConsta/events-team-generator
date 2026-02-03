# Desert Storm Team Assignment Generator

Web app for assigning players to teams and generating map overlays for Desert Storm. Player data is stored per user in Firebase so team organizers can reuse rosters across sessions.

## Highlights
- Upload a player database from Excel and store it per user
- Select Team A and Team B (20 each) with filters and sorting
- Generate map images and Excel exports
- Google or email/password sign-in
- Local vendor libraries (no CDN required)

## Requirements
- A Firebase project with Auth + Firestore enabled
- Modern browser (Chrome, Edge, Firefox, Safari)

## Quick Start (Local)
1. Copy `firebase-config.example.js` to `firebase-config.js` and fill in your Firebase config values.
2. Open `index.html` in a browser.
3. Sign in and upload your player database.
4. Select teams and generate downloads.

## GitHub Pages (Secrets-Based Config)
This repo deploys to GitHub Pages using a workflow that injects `firebase-config.js` at deploy time. The file is not stored in Git.

1. In your GitHub repo, go to Settings > Secrets and variables > Actions.
2. Add a new secret named `FIREBASE_CONFIG_JS`.
3. Paste the full contents of `firebase-config.js` into the secret (including the comments if you want).
4. In Settings > Pages, set Source to GitHub Actions.
5. Push to `main` to trigger a deploy.

## Firebase Configuration
- `firebase-config.js` is ignored by Git. Keep real credentials local.
- For hosted use, set API key restrictions and allowed domains.
- Password accounts must verify email before use.

## Project Layout
- `index.html` Main UI
- `firebase-module.js` Firebase Auth + Firestore logic
- `firebase-config.js` Local, untracked Firebase config
- `firebase-config.example.js` Safe template
- `vendor/` Local copies of SheetJS + Firebase SDKs
- `desert-storm-map.png` Map image
- `test-firebase-config.html` Quick config sanity check

## Data Storage (Firestore)
- Collection: `users`
- Document ID: Firebase Auth `uid`
- Fields: `playerDatabase` (map keyed by player name), `metadata` (counts and timestamps)

## Usage Flow
1. Download the template from the UI and fill in player details.
2. Upload the Excel file to store the database in Firestore.
3. Filter and select players for Team A and Team B.
4. Generate map images and team Excel files.

## File Size Limits
- Excel uploads are capped at 5MB per file.

## One-Time Migration (Email Doc IDs -> UID Doc IDs)
1. Install Node.js LTS.
2. Install dependencies: `npm install`
3. Dry run:
   - `node scripts/migrate_users_email_to_uid.js --service-account PATH_TO_SERVICE_ACCOUNT.json --project-id YOUR_PROJECT_ID`
4. Apply changes:
   - `node scripts/migrate_users_email_to_uid.js --service-account PATH_TO_SERVICE_ACCOUNT.json --project-id YOUR_PROJECT_ID --apply`
5. Optional cleanup:
   - Add `--delete-old` to remove old email-based docs after migration.

## Troubleshooting
- "Firebase config not found": Ensure `firebase-config.js` exists and is filled in (or the secret is set for Pages).
- "Permission denied": Check Firestore rules and that the user is signed in.
- "Email not verified": Verify the email address and sign in again.
- "File too large": Reduce Excel file size below 5MB.

## Security Notes
- Do not commit `firebase-config.js`.
- Use restricted API keys and secure Firestore rules.
- Data is stored in Firestore; this is not an offline-only tool.
