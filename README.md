# Desert Storm Team Assignment Generator

Web app for assembling two 20-player teams, assigning them to buildings with a power-first troop-mix algorithm, and exporting battle-ready map images and Excel rosters. Player data and building configuration are stored per user in Firebase so team organizers can reuse everything across sessions.

## Features

- **Player database** — upload from Excel, stored in Firestore per user account; filter by name or troop type, sort by power or name.
- **Team selection** — pick 20 players per team (A and B) with live counters and one-click clear.
- **Building & priority editor** — configure slots and priority for each building; slots and priority are validated and saved to Firestore.
- **Power-first troop-mix pairing** — within each priority group buildings round-robin the strongest available players first, then each anchor is paired with the best different-troop-type player from the next three by power (falls back to next-by-power if no mix exists).
- **Map coordinate picker** — click to place player-name labels on the map canvas for each building; positions persist in Firestore.
- **Exports** — team map image (PNG) and team roster (Excel), triggered from a modal that opens immediately after generation.
- **Multilingual UI** — English, Français, Deutsch, Italiano, 한국어, Română. Language preference saved to `localStorage`.
- **Auth** — Google OAuth or email/password (email verification required). All vendor libraries vendored locally; no CDN dependency.
- **Mobile-responsive** — tablet (≤ 768 px) and phone (≤ 480 px) breakpoints; tables convert to card layouts, touch targets enlarged.

## Requirements

- A Firebase project with **Authentication** and **Firestore** enabled.
- Modern browser (Chrome, Edge, Firefox, Safari).

## Quick Start (Local)

1. Copy `firebase-config.example.js` to `firebase-config.js` and fill in your Firebase project values.
2. Open `index.html` in a browser (no build step).
3. Sign in, upload a player Excel file, select teams, and generate exports.

## GitHub Pages Deployment

The workflow in `.github/workflows/pages.yml` injects `firebase-config.js` at build time from a repository secret — the file is never committed.

1. Go to **Settings > Secrets and variables > Actions** in your GitHub repo.
2. Create a secret named `FIREBASE_CONFIG_JS` and paste the full contents of your local `firebase-config.js`.
3. Go to **Settings > Pages** and set Source to **GitHub Actions**.
4. Push to `main`; the workflow builds and deploys automatically.

## Project Layout

```
index.html                  Main application (UI, styles, all client-side JS)
firebase-module.js          Firebase Auth + Firestore wrapper (IIFE, public API)
firebase-config.js          Local Firebase config (gitignored)
firebase-config.example.js  Template with placeholder values
desert-storm-map.png        Base map image drawn on the export canvas
vendor/                     SheetJS (xlsx) + Firebase compat SDKs
scripts/                    One-time Firestore migration utility
package.json                Node deps for the migration script only
.github/workflows/pages.yml GitHub Actions deploy workflow
```

## Firestore Data Model

- **Collection:** `users`
- **Document ID:** Firebase Auth `uid`
- **Fields:**

| Field | Type | Description |
|---|---|---|
| `playerDatabase` | map | Keyed by player name; each value holds `power`, `troops`, `lastUpdated` |
| `buildingConfig` | array | Per-building `name`, `slots`, `priority` |
| `buildingPositions` | map | Keyed by building name; `x` / `y` canvas coordinates |
| `metadata` | map | `email`, `totalPlayers`, `lastUpload`, `lastModified` (server timestamp) |

## Upload Format

The app expects an Excel file with a sheet named **Players**. Headers must be on **row 10**:

| Column | Required | Notes |
|---|---|---|
| Player Name | yes | Used as the primary key; duplicates silently overwrite |
| E1 Total Power(M) | no | Numeric; defaults to 0 if missing |
| E1 Troops | no | Tank / Aero / Missile; defaults to "Unknown" if missing |

A pre-filled template can be downloaded from the UI.

## One-Time Migration (Email Doc IDs → UID Doc IDs)

If your Firestore still has documents keyed by email instead of `uid`:

1. Install Node.js LTS and run `npm install`.
2. Dry run (prints changes without writing):
   ```
   node scripts/migrate_users_email_to_uid.js --service-account PATH_TO_SERVICE_ACCOUNT.json --project-id YOUR_PROJECT_ID
   ```
3. Apply:
   ```
   node scripts/migrate_users_email_to_uid.js --service-account PATH_TO_SERVICE_ACCOUNT.json --project-id YOUR_PROJECT_ID --apply
   ```
4. Optionally add `--delete-old` to remove the old email-keyed documents.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Firebase config not found" | `firebase-config.js` is missing or empty locally; or the `FIREBASE_CONFIG_JS` secret is not set for Pages. |
| "Permission denied" | Check Firestore security rules and confirm the user is signed in. |
| "Email not verified" | Verify the email address in the inbox, then sign in again. |
| "File too large" | Excel uploads are capped at 5 MB. |
| Pages deploy not triggering | Ensure the workflow file has LF line endings (`.gitattributes` enforces this) and no BOM. |

## Security Notes

- `firebase-config.js` is in `.gitignore` — never commit it.
- Restrict Firebase API keys to your deployed domain in the Firebase console.
- Firestore security rules should scope reads/writes to the authenticated user's own document.
- Player names are HTML-escaped before insertion into the DOM; team-selection buttons use `addEventListener` rather than inline handlers.
