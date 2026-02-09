# LW- Events Players Selection

Web app for building event teams, assigning players to buildings, and exporting map + Excel outputs for Last War events.

## Features

- Menu-based navigation with two main pages:
  - `Configuration`
  - `Generator`
- Event support:
  - `Desert Storm`
  - `Canyon Battlefield`
- Per-event configuration:
  - building names
  - `#Players` (slots)
  - priorities
  - map label coordinates
- Player database import from Excel (stored per user in Firestore).
- Team selection with starters and substitutes.
- Export outputs:
  - team map image (PNG)
  - team roster (Excel)
- Settings:
  - display name
  - nickname (shown instead of name when set)
  - avatar upload
  - language selection
  - account deletion with explicit typed confirmation
- Alliance support (shared data flow where enabled).
- Onboarding tooltip tour for first-time users.

## First-Time User Flow

1. Sign in.
2. Open `Menu` from the header.
3. Go to `Configuration`.
4. Download the Excel template.
5. Upload your player database.
6. Review per-event `Buildings & Priorities` (`#Players` + priority).
7. Set per-event map coordinates for player name labels.
8. Open `Menu` and switch to `Generator`.
9. Select players and generate exports.

## Requirements

- Firebase project with:
  - Authentication enabled
  - Firestore enabled
- Modern browser (Chrome, Edge, Firefox, Safari).

## Quick Start (Local)

1. Copy `firebase-config.example.js` to `firebase-config.js`.
2. Fill in your Firebase project config values.
3. Open `index.html` in a browser.
4. Sign in and use the Configuration -> Generator flow.

## GitHub Pages Deployment

`.github/workflows/pages.yml` injects `firebase-config.js` at build time from a repo secret, so the config file is not committed.

1. In GitHub, go to `Settings -> Secrets and variables -> Actions`.
2. Add a secret named `FIREBASE_CONFIG_JS` with the full content of `firebase-config.js`.
3. In `Settings -> Pages`, set source to `GitHub Actions`.
4. Push to `main`.

## Project Layout

```text
index.html                     Main UI structure
styles.css                     Styling and responsive behavior
app.js                         Main app behavior (UI + generation + onboarding)
translations.js                i18n dictionaries
firebase-module.js             Firebase Auth/Firestore module (IIFE)
js/app-init.js                 Startup and callback wiring
js/services/firebase-service.js Service adapter used by app.js
js/core/events.js              Event registry, maps, default buildings/positions
js/core/buildings.js           Building normalization and version helpers
js/core/assignment.js          Team assignment logic
js/core/i18n.js                Translation engine
vendor/                        Vendored Firebase + SheetJS libraries
scripts/migrate_users_email_to_uid.js One-time Firestore migration utility
tests/                         Node test suite
```

## Firestore Data Model

### Collection: `users`
Document id is Firebase Auth `uid`.

Main fields:

- `playerDatabase` (map)
  - keyed by player name
  - value contains `power`, `troops`, `lastUpdated`
- `events` (map)
  - `events.desert_storm`
  - `events.canyon_battlefield`
  - each event entry stores:
    - `buildingConfig` (array)
    - `buildingConfigVersion` (number)
    - `buildingPositions` (map of `buildingName -> [x, y]`)
    - `buildingPositionsVersion` (number)
- `userProfile` (map)
  - `displayName`, `nickname`, `avatarDataUrl`
- `metadata` (map)
  - `email`, `emailLower`, `totalPlayers`, `lastUpload`, `lastModified`
- optional alliance fields:
  - `allianceId`, `allianceName`, `playerSource`

### Collection: `app_config`

Shared default documents used for bootstrapping user defaults:

- `default_event_positions`
  - `events.{eventId}.{buildingName} = [x, y]`
  - `version`, `sourceEmail`, `updatedAt`
- `default_event_building_config`
  - `events.{eventId} = [{ name, label?, slots, priority }]`
  - `version`, `sourceEmail`, `updatedAt`

### Other collections

- `alliances`
- `invitations`

Used by alliance membership, shared uploads, and invitation workflows.

## Upload Format

Expected Excel sheet: `Players`
Headers must be on row `10`:

- `Player Name` (required)
- `E1 Total Power(M)`
- `E1 Troops`

## Account Deletion

From `Settings`, users can delete their account by typing the confirmation word.

Current behavior:

- user data is removed from Firestore
- related alliance/invitation records are cleaned up where applicable
- user is signed out after confirmation
- Firebase Auth account deletion may require recent login (`auth/requires-recent-login`)

## Migration Script (Email doc IDs -> UID doc IDs)

If older data exists with email-based document ids:

1. Install deps:

```bash
npm install
```

2. Dry run:

```bash
node scripts/migrate_users_email_to_uid.js --service-account PATH_TO_SERVICE_ACCOUNT.json --project-id YOUR_PROJECT_ID
```

3. Apply:

```bash
node scripts/migrate_users_email_to_uid.js --service-account PATH_TO_SERVICE_ACCOUNT.json --project-id YOUR_PROJECT_ID --apply
```

4. Optional cleanup of old docs:

```bash
node scripts/migrate_users_email_to_uid.js --service-account PATH_TO_SERVICE_ACCOUNT.json --project-id YOUR_PROJECT_ID --apply --delete-old
```

## Tests

```bash
npm test
```

## Troubleshooting

- `Firebase config not found`
  - `firebase-config.js` is missing locally, or `FIREBASE_CONFIG_JS` secret is not set for Pages.
- `Permission denied`
  - verify Firestore rules and signed-in user permissions.
- `Email not verified`
  - verify email, then sign in again.
- Upload rejected
  - player Excel upload limit is 5 MB.

## Security Notes

- `firebase-config.js` is gitignored and should never be committed.
- Restrict Firebase API keys to approved domains.
- Firestore rules should scope access to the authenticated user (and alliance rules where needed).
- Avatar uploads are restricted to common image formats and validated client-side.
