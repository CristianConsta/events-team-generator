# External Integrations

**Analysis Date:** 2026-02-25

## APIs & External Services

**Google Authentication:**
- Google Sign-In via Firebase Auth - `DSFirebaseAuth.signInWithGoogle()` in `firebase-auth-module.js`
- SDK: vendored Firebase Auth SDK (`vendor/firebase-auth-compat.js`)
- Auth: OAuth 2.0 popup/redirect flow
- CSP: `https://apis.google.com`, `https://www.gstatic.com`, `https://accounts.google.com`

**Google Workspace (Workspace APIs):**
- Used indirectly through Firebase sign-in
- CSP frame-src includes `https://accounts.google.com` and `https://*.google.com` for OAuth popups

## Data Storage

**Databases:**
- Cloud Firestore (Google Firebase) - Primary database
  - Provider: Google Cloud
  - Connection: Firebase SDK via `vendor/firebase-firestore-compat.js`
  - Client: Firestore compatibility API (compat mode)
  - Connection endpoints (CSP):
    - `https://firestore.googleapis.com` - Firestore queries and writes
    - `https://*.googleapis.com` - General Google API access
  - Collections structure in `firebase-infra.js`:
    - `users/{uid}/games/{gid}/players` - User player database
    - `users/{uid}/games/{gid}/events` - Event configurations
    - `users/{uid}/games/{gid}/user_state` - User settings and preferences
    - `games/{gid}/alliances/{allianceId}` - Shared alliance data
    - `games/{gid}/alliances/{allianceId}/invitations` - Invite tracking
    - `games/{gid}/alliances/{allianceId}/pending_updates` - Player update queue
    - `games/{gid}/alliances/{allianceId}/event_history` - Event results and attendance
    - `games/{gid}/soloplayers/{uid}` - Non-alliance player data
  - Real-time listeners via `setDataLoadCallback()` and `setAllianceDataCallback()` (websocket subscriptions)
  - Firestore Rules: `firestore.rules` (deployed via `firebase deploy --only firestore:rules`)

**File Storage:**
- Local filesystem via browser
  - Logo upload: Image data URLs stored as base64 in Firestore (max 400KB per avatar, managed in `firebase-module.js:66`)
  - Map images: Data URLs stored in events (base64 encoded)
  - Excel export: Client-side file download via XLSX library (no server storage)
- No cloud storage bucket - all data persisted to Firestore or as data URLs

**Caching:**
- Browser localStorage:
  - `ds_language` - User language preference
  - `ds_active_game_id` - Active game selection
  - `ds_onboarding_done` - Onboarding tour completion flag
  - `ds_events_v2` - Local event registry cache
  - `ds_theme` - Theme preference (also synced to Firebase)
- Firestore write-through cache via SDK (managed by Firebase)
- No Redis or external cache service

## Authentication & Identity

**Auth Provider:**
- Firebase Authentication (Google managed)
  - Custom setup: Email/password auth (`DSFirebaseAuth.signInWithEmail()`)
  - Google Sign-In (`DSFirebaseAuth.signInWithGoogle()`)
  - Email verification required for password auth
  - Password reset via `sendPasswordResetEmail()`
  - Account deletion via `firebase.auth().currentUser.delete()`

**Implementation:**
- Entry point: `firebase-auth-module.js` - Extracted auth lifecycle
- Integration: `firebase-module.js` - Firebase manager facade
- Adapter: `js/services/firebase-service.js` - Testable wrapper
- Gateways: `js/shared/data/firebase-auth-gateway.js` - Data layer abstraction
- Session: `currentAuthUser` global in `app.js` (Firebase User object)
- Callback pattern: `setAuthCallback()` deferred until `firebase-module.js` initializes

**User Profile:**
- Custom user profile stored in Firestore at `users/{uid}/games/{gid}/user_state/{uid}`
- Fields: `displayName`, `nickname`, `theme`, `avatarDataUrl`, `allianceId`, `playerSource`, `migrationVersion`
- Saved via `FirebaseService.saveUserProfile()`
- Synced from Firebase on sign-in via `updateUserHeaderIdentity()`

## Monitoring & Observability

**Error Tracking:**
- Browser console logging (console.log, console.error, console.warn)
- No external error tracking service (Sentry, Rollbar, etc.)
- Custom error handling in feature modules
- Firestore operation retries via `DSCoreReliability` (`js/core/reliability.js`)

**Logs:**
- Client-side: console output only
- Server: Firebase Cloud Logging (implicit from SDK usage)
- E2E: Playwright HTML reports and video artifacts (`playwright-report/`)

**Observability:**
- Firestore quota monitoring (implicit via quotas dashboard)
- Real-time listener health tracked via `setDataLoadCallback()` callbacks
- Stats recalculation with `DSCoreReliability.recalculatePlayerStats()` (performance tracking in Firestore)

## CI/CD & Deployment

**Hosting:**
- GitHub Pages (static hosting) - deployed via `actions/deploy-pages@v4`
- Custom domain: `last-war-game-desert-storm.firebaseapp.com` (Firebase domain)
- Deployment path: `_site/` (GitHub Pages artifact root)

**CI Pipeline:**
- Workflow: `.github/workflows/pages.yml`
- Jobs:
  1. **lint-and-unit** (required): ESLint, size budgets, unit+coverage tests, esbuild
  2. **e2e-smoke** (optional, manual trigger): Playwright smoke tests
  3. **package-and-deploy** (conditional): Package and deploy to Pages

**Deployment Process:**
- Trigger: Push to `main` branch (or manual `workflow_dispatch`)
- Build: `npm run build` → esbuild bundles to `dist/bundle.js`
- Test: `npm run test:coverage` → c8 coverage gate (80% on core + shared/data)
- Deploy: Firebase config injected via `FIREBASE_CONFIG_JS` secret, files staged to `_site/`
- Artifact passing: `dist/bundle.js` passed between jobs via `actions/upload-artifact`

**Firestore Rules Deployment:**
- Manual: `firebase deploy --only firestore:rules --project last-war-game-desert-storm`
- Test locally: `npm run test:rules` (emulator required)
- Rules file: `firestore.rules`
- Testing framework: `@firebase/rules-unit-testing` in `tests/firestore-rules/*.rules.test.js`

**Firestore Emulator:**
- Local testing: `firebase emulators:exec --only firestore "node --test ..."`
- Port: 8080 (configured in `firebase.json`)
- Disabled UI (`ui.enabled: false`)

## Environment Configuration

**Required Env Vars:**
- `FIREBASE_CONFIG_JS` (GitHub Actions secret) - Firebase configuration object (passed via action secrets)
- `CI` - Set to `"true"` in GitHub Actions (Playwright retries/forbidOnly behavior)
- `HOME` - Set to `/root` in Playwright container (Docker environment)
- `PLAYWRIGHT_CHANNEL` - Optional browser channel override (default: 'msedge' for Edge, 'chrome' for Chrome)

**Secrets Location:**
- `.env` - gitignored, contains local `FIREBASE_CONFIG_JS` for development
- `firebase-config.js` - Generated from secret at deploy time, never committed
- `scripts/PATH_TO_SERVICE_ACCOUNT.json` - gitignored service account key for migrations
- GitHub Actions Secrets: `FIREBASE_CONFIG_JS` (Firebase web SDK config)

**Local Development:**
- Copy `firebase-config.example.js` → `firebase-config.js` with real Firebase credentials
- Load from either global `FIREBASE_CONFIG` or `window.FIREBASE_CONFIG`
- Service account key location: `/Users/constantinescucristian/repos/private keys/last-war-game-desert-storm-firebase-adminsdk-fbsvc-70353b661f.json`

## Webhooks & Callbacks

**Incoming:**
- Player-facing update endpoints: `player-update.html?token={tokenId}` - Secure link for player to update own profile
  - Token validation via `update_tokens/{tokenId}` Firestore document
  - Prevents unauthorized updates via one-time tokens (created by alliance managers)
- No traditional webhook endpoints (SPA architecture)

**Outgoing:**
- Firestore real-time listeners → browser callbacks:
  - `setDataLoadCallback()` - Triggers on player/event/alliance data changes
  - `setAllianceDataCallback()` - Alliance-specific listener
  - `subscribePendingFinalizationCount()` - Event history finalization count badge
  - `subscribePendingUpdatesCount()` - Player updates pending count badge
- Google Sign-In popup callback → `firebase.auth().onAuthStateChanged()`
- No outbound HTTP webhooks to third parties

**Data Flow:**
- User actions → Feature controllers → FirebaseService adapter → Firebase SDK → Firestore/Auth APIs
- Firestore changes → Real-time listeners → State updates → UI re-renders via feature views

## Third-Party Services Integration Matrix

| Service | Purpose | Integration Type | Required | Fallback |
|---------|---------|------------------|----------|----------|
| Google Cloud Firestore | Database + Realtime | SDK (vendored) | Yes | None (offline read from localStorage cache) |
| Firebase Authentication | User auth + session | SDK (vendored) | Yes | None (must sign in) |
| Google Sign-In | OAuth provider | Popup/Redirect flow | Optional | Email/password auth alternative |
| GitHub Pages | Web hosting | Static file deployment | Yes | Manual S3/CDN deployment |
| Firestore Emulator | Local dev/testing | CLI (firebase-tools) | Optional (testing only) | Use live Firebase in dev |
| Playwright | E2E testing | npm + container image | Testing only | Manual browser testing |
| Google Workspace | OAuth domain | Identity provider | Optional (if using Google Sign-In) | Email/password only |

---

*Integration audit: 2026-02-25*
