# Codebase Concerns

**Analysis Date:** 2026-02-25

## Tech Debt

**Firestore security rules overly permissive:**
- Issue: Game-level events collection allows any signed-in user to read/write (`allow write: if signedIn();` on `/games/{gameId}/events/{eventId}`)
- Files: `firestore.rules:303`, `firestore.rules:316`
- Impact: Any authenticated user can create/modify events for any game. Should be restricted to alliance members or game administrators.
- Fix approach: Tighten rules to check `isAllianceMember()` or introduce game-level admin role. This is documented as Phase 2.x work (see `firestore.rules:303` TODO comment).

**Large monolithic files:**
- Issue: `firebase-module.js` is 6,253 lines; `app.js` is 4,613 lines
- Files: `firebase-module.js`, `app.js`
- Impact: Single points of failure; difficult to test in isolation; long load times; high bundle pressure
- Fix approach: Extract coherent modules (already partially done with feature controllers). Consider moving Firebase operations to gateway layer and state queries to computed selectors.
- Budget pressure: Both files have line-count budgets (firebase-module: 7000, app: 6000) limiting growth but indicating known concern.

**Global state pollution:**
- Issue: Heavy reliance on `window` globals (`allPlayers`, `currentEvent`, `teamSelections`, `activeDownloadTeam`, `__ACTIVE_GAME_ID`, etc.)
- Files: `app.js` (entire file), `firebase-module.js` (exports to window)
- Impact: State not centralized; multiple sources of truth; difficult to reason about mutations; test pollution between suites
- Fix approach: Migrate to `DSAppStateStore` (already exists in `js/shared/state/app-state-store.js`). Gradually move critical state into store and use selectors instead of globals.

**i18n key coverage parity:**
- Issue: All 6 language translations (EN, FR, DE, IT, KO, RO) must be present for every key, but there's no pre-commit validation. Manual compliance only.
- Files: `translations.js` (contains all 6 languages)
- Impact: Partially translated keys cause silent fallbacks to original language. Test `tests/i18n-keys.core.test.js` catches errors but only at test time, not at edit time.
- Fix approach: Add pre-commit hook to validate parity. Or auto-generate missing keys from template during test setup.

**Theme token declaration duplication:**
- Issue: All `--ds-*` tokens must be declared in 4 different CSS blocks: `:root` in both `styles.css` and `theme-variables.css`, plus 2 theme variant blocks
- Files: `styles.css`, `theme-variables.css`
- Impact: Easy to forget a declaration in one block. Silent CSS fallback causes theme-specific bugs hard to diagnose. CLAUDE.md warns about this but it's manual discipline.
- Fix approach: Use CSS custom property fallbacks or generate theme files from SCSS/POSTCSS. Document required token set in CLAUDE.md more prominently.

**Migration scripts not version-controlled:**
- Issue: Complex migrations exist as one-off scripts in `scripts/` but don't track whether they've been run or rollback capability
- Files: `scripts/migrate-to-game-scoped-paths.js`, `scripts/migrate_multigame_first_class.js`, `scripts/sync_event_building_defaults.js` (etc.)
- Impact: No idempotency guarantees; no automatic retry on failure; no audit trail in Firestore of what ran and when
- Fix approach: Add timestamp + status docs to Firestore for each migration. Wrap scripts with pre-flight checks. Store migration history in `migration_log/` collection.

**No explicit memory/listener cleanup in some listeners:**
- Issue: Some event listeners (e.g., `setInterval` in app.js:3218, `addEventListener` on window/document) lack corresponding cleanup on app unload
- Files: `app.js:3218` (notificationPollInterval cleared via `stopNotificationPolling` but depends on auth callback), `app.js:2227-2229` (pagehide/beforeunload/visibilitychange listeners in firebase-module.js)
- Impact: Long-lived apps may accumulate listeners if cleanup doesn't fire. Re-mounts/tests may leak timers.
- Fix approach: Create lifecycle manager that registers all listeners and provides cleanup hook called on sign-out. Audit all addEventListener calls for cleanup pairs.

## Known Bugs

**player-update.html E2E failures with Firebase anonymous auth:**
- Symptoms: `@smoke @invite player-update page initializes Firebase without errors` test may fail due to Firebase init timing issues
- Files: `e2e/11-invite-flow.e2e.js:396+`, `js/player-update/player-update.js`
- Trigger: Loading player-update.html with `?token=X` when real Firebase is not mocked; anonymous auth can hang or race with DOM ready
- Workaround: Tests use `injectPlayerUpdateFirebaseMock()` to replace `window.FirebaseManager`. Standalone page loads bare firebase; ensure firebase-config.js is available.
- Note: CLAUDE.md documents these as "pre-existing failures" but they may indicate timing fragility in bootstrap sequence.

**Bundle defer timing issue in dynamic scripts:**
- Symptoms: Rare race condition where bundle executes before dependent IIFE modules finish initializing
- Files: `index.html` (inline script), `js/app-shell-bootstrap.js` (readyState guard), `app.js` (readyState guard in initializeApplicationUiRuntime)
- Trigger: Fast browser, cached resources, or when DOMContentLoaded fires before async defer completes
- Mitigation: Added `readyState` checks and `setTimeout(cb, 0)` defers (CLAUDE.md Section "Bundle Boot Sequence"). But edge case remains if module load order changes.
- Fix approach: Switch to ESM imports and explicit dependency declaration. Test bootstrap sequence with slow 3G + `?nocache=1`.

**Event history finalization staleness logic unclear:**
- Symptoms: `checkFinalizationStaleness` uses 7-day threshold but criteria for "stale" vs "needs action" is not well documented
- Files: `tests/event-history.core.test.js` (test vectors show 8 days = stale, 3 days = not stale)
- Impact: Unclear what happens to events in between. No UI indicator for "review soon" vs "overdue".
- Fix approach: Add state enum (`pending`, `due_soon`, `overdue`) and update UI warnings accordingly.

## Security Considerations

**Hardcoded super-admin UID in firestore.rules:**
- Risk: UID `2z2BdO8aVsUovqQWWL9WCRMdV933` is hardcoded in rules and appears in MEMORY.md
- Files: `firestore.rules:13`, `.claude/teams/color-theming/MEMORY.md`
- Current mitigation: UID is only used for admin operations (game metadata), not player data. But if UID is compromised, attacker has full access.
- Recommendations:
  1. Move UID to `app_config/{docId}` Firestore document read at deploy time
  2. Implement custom claims on super-admin user instead of hardcoded check
  3. Add audit logging to super-admin operations
  4. Rotate UID periodically or use service account only for migrations

**Anonymous auth allows player-update token consumption:**
- Risk: `/users/{uid}/update_tokens/{tokenId}` and `/alliances/{id}/update_tokens/{tokenId}` allow anonymous users to mark tokens as `used: true`
- Files: `firestore.rules:74-84`, `firestore.rules:174-186` (anonymous users can read/update unused tokens)
- Current mitigation: Token validity checked on read (`used == false && expiresAt > now`). Anonymous user can only set `used=true`, not read player data.
- Recommendations:
  1. Add rate limiting on token usage (currently none)
  2. Log anonymous user identifier (`usedByAnonUid`) to detect abuse patterns
  3. Set token expiry to 24-48 hours; renew via admin link
  4. Consider requiring email or phone verification before token use

**Firebase config in GitHub Actions secret:**
- Risk: `FIREBASE_CONFIG_JS` secret is base64-encoded in GitHub and injected at deploy time
- Files: `.github/workflows/pages.yml:130-137`
- Current mitigation: Secret is stored in GitHub's encrypted vault; only accessible in Actions environment
- Recommendations:
  1. Regularly rotate API keys on Firebase console
  2. Use web-only API keys (restrict to web origins)
  3. Add IP allowlist on Firebase project if possible
  4. Consider storing config in GCP Secret Manager and fetching at deploy time instead

**Invitation email validation relies on token check:**
- Risk: `isInviteePayload()` checks if `data.invitedEmail` matches `request.auth.token.email`, but Firebase auth email can be spoofed if account is not verified
- Files: `firestore.rules:42-46`
- Current mitigation: Firebase requires email verification for password reset; Google/anonymous auth don't require verification
- Recommendations:
  1. Mark invitations as "pending_email_verification" until user verifies their email
  2. Send verification link alongside invitation
  3. Require verified email before accepting invitation

## Performance Bottlenecks

**Notification polling every 60 seconds:**
- Problem: `startNotificationPolling()` uses `setInterval(60000)` which fires even when app is backgrounded
- Files: `app.js:3218-3223` (includes visibility check but interval still runs)
- Cause: `setInterval` doesn't pause on tab hidden; visibility check happens inside callback, so 60s passes regardless
- Improvement path:
  1. Use `visibilitychange` listener to pause/resume interval (instead of just checking state inside)
  2. Reduce poll interval to 30s or use Firebase real-time listeners instead
  3. Add exponential backoff if no new notifications

**Player table re-renders on every data callback:**
- Problem: `renderPlayersTable()` is called on every Firestore snapshot, which rebuilds entire DOM
- Files: `app.js` (data callback → loadPlayerData → renderPlayersTable)
- Cause: No diffing or incremental updates; table structure recreated even for small changes
- Improvement path:
  1. Implement virtual scrolling for large player lists (>100 players)
  2. Add diff detection to skip re-render if data unchanged
  3. Use event delegation instead of recreating row listeners

**Image processing in events-image-processor uses blocking canvas:**
- Problem: `processLogoFile()` and `processMapFile()` resize images on main thread
- Files: `js/features/events-manager/events-image-processor.js`
- Cause: No Web Worker; canvas resize blocks UI during file selection
- Improvement path:
  1. Move image processing to Web Worker
  2. Implement max-file-size check before processing
  3. Show progress indicator during resize

**Firestore read amplification in security rules:**
- Problem: `isAllianceMember()` function does a `get()` call for every rule evaluation
- Files: `firestore.rules:329-336` (legacy helper for old schema; unused in new game-scoped rules)
- Cause: Root collections schema requires lookup; game-scoped schema avoids this
- Status: Already fixed in new paths; legacy rules still present for backwards compatibility
- Cleanup: Remove legacy `isAllianceMember()` function once fully migrated

## Fragile Areas

**Events registry normalization is case-sensitive in parts:**
- Files: `js/features/events-manager/events-registry-controller.js:normalizeEventId`
- Why fragile: Event IDs are lowercased and stripped of special chars, but database may contain mixed-case IDs from before normalization. Lookups can fail silently.
- Safe modification: Always validate event ID after loading from DB. Test with uppercase variants.
- Test coverage: `tests/events-registry-controller.feature.test.js` covers basic cases but missing edge cases (numbers, dashes).

**Coordinate picker state stored in element.dataset:**
- Files: `app.js:94-101` (clearPanelMotionTimer), `js/features/buildings/coordinate-picker-controller.js`
- Why fragile: Timer IDs stored in `element.dataset.motionTimerId` as strings. If DOM is replaced or element is cloned, state is lost.
- Safe modification: Wrap in WeakMap or explicit state manager. Don't rely on DOM attributes for timers.
- Test coverage: Manual browser test only; no unit test for concurrent opens/closes.

**Assignment algorithm resolution depends on event existing:**
- Files: `js/core/assignment-registry.js`, `js/features/generator/generator-actions.js`
- Why fragile: If event is deleted after user selects it but before generating teams, algorithm selection returns null. UI may crash.
- Safe modification: Add null check before calling algorithm. Show error modal with "event no longer exists" message.
- Test coverage: No test for event-deleted-mid-session scenario.

**Bundle startup timing with async firebase-config.js:**
- Files: `index.html` (inline script), `firebase-module.js:29-39`
- Why fragile: If `firebase-config.js` is not available at deploy time, FirebaseManager initializes with `firebaseConfig = null`, causing subtle failures downstream
- Safe modification: Check for FirebaseManager errors in all feature controllers. Add explicit "no firebase" error screen.
- Test coverage: `tests/app-init.extended.test.js` tests FirebaseService unavailability but not FirebaseManager init failure.

**Player data validation is minimal:**
- Files: `js/features/players-management/players-management-core.js`, `firebase-module.js` (upload/upsert functions)
- Why fragile: No schema validation on player data; only basic type checks. Missing fields or wrong types accepted, causing downstream rendering bugs.
- Safe modification: Add Zod or simple schema validator before Firestore write. Test with malformed XLSX files.
- Test coverage: `tests/player-updates.core.test.js` has basic tests; missing edge cases (negative power, wrong troop types).

**Theme color fallback is string comparison, not computed:**
- Files: `js/core/theme-colors.js` (DSThemeColors.get() returns CSS value as string)
- Why fragile: If CSS token is declared but evaluates to empty string or invalid color, fallback in JS is string fallback not CSS cascade
- Safe modification: Validate token exists before returning. Use `getComputedStyle()` for safety.
- Test coverage: No test for missing tokens or malformed CSS values.

## Scaling Limits

**Player database max size is 100 per user:**
- Current capacity: 100 players in `MAX_PLAYER_DATABASE_SIZE` constant
- Limit: Multi-game users can have max 100 players in personal DB + 100 in each alliance
- Impact: Alliances with 100+ active players must segment into multiple sub-groups
- Scaling path:
  1. Increase limit to 500 (Firestore can handle it; UI performance is bottleneck)
  2. Implement pagination in player table
  3. Add filtering/search to avoid rendering full list

**Firestore document size for events:**
- Current capacity: Event config (buildings array, positions map) is embedded in event doc
- Limit: Event doc can exceed 1MB if team assignments are stored (currently stored separately in history)
- Impact: Adding large logo/map to event can push doc over limit
- Scaling path:
  1. Extract large fields (logoDataUrl, mapDataUrl, buildingPositions) to subcollections
  2. Use references instead of embedding

**Notification polling scales with user count:**
- Current capacity: Each user polls Firebase every 60s
- Limit: 1000 active users = 1000 read ops / min (60 ops/sec for notifications)
- Impact: Notification check not optimized; can spike costs if many users are online simultaneously
- Scaling path:
  1. Switch to Firebase real-time listeners (cheaper; not polled)
  2. Implement server-side push via Cloud Functions

**Bundle size growth (esbuild only):**
- Current capacity: `dist/bundle.js` grows with every feature; no code splitting
- Limit: Bundle will become >1MB uncompressed if many new features added without splitting
- Impact: Slower load time; bloats on mobile networks
- Scaling path:
  1. Switch to ESM and enable code splitting
  2. Lazy-load features (event history, player updates, etc.) on demand
  3. Set bundle budget alert in CI

## Dependencies at Risk

**Firebase compat SDKs (deprecated):**
- Risk: Using `firebase-app-compat`, `firebase-auth-compat`, `firebase-firestore-compat` which are deprecated by Google
- Files: `vendor/` (local copies)
- Impact: Will not receive updates; security fixes deprecated after Firebase SDK v9
- Migration plan:
  1. Switch to modular Firebase SDK v9+ (import individual modules)
  2. Remove compat layer
  3. Test thoroughly with new SDK's async patterns
  4. Update firestore.rules if needed for new SDK

**SheetJS (XLSX):**
- Risk: Vendored as `vendor/xlsx.full.min.js`; difficult to update; license compliance unclear
- Files: `vendor/xlsx.full.min.js`, `js/features/players-management/player-data-upload.js`, `js/features/generator/download-controller.js`
- Impact: Cannot update for bug fixes without manual re-minification; security issues in XLSX parser can't be patched
- Migration plan:
  1. Consider lightweight CSV instead of XLSX for upload
  2. If XLSX needed, use NPM package and bundle with esbuild
  3. Add license check to CI

**esbuild (only bundler):**
- Risk: No webpack/rollup fallback; entire build depends on esbuild
- Files: `scripts/build.js`, `package.json:build`
- Impact: If esbuild breaks, no build path without major refactor
- Migration plan:
  1. Low priority (esbuild is stable and actively maintained)
  2. Monitor for build issues; keep esbuild updated
  3. Have rollup knowledge in team for emergency fallback

## Missing Critical Features

**No offline mode:**
- Problem: App requires Firebase connection to function. Cached data only loads if previously synced.
- Blocks: Teams cannot generate without internet; player data can't be viewed offline.
- Solution: Use service worker + IndexedDB to cache players and team state locally. Generate teams from cache, sync on reconnect.

**No audit logging:**
- Problem: No record of who deleted/modified player data, who created which alliance, etc.
- Blocks: Can't debug data loss; no compliance audit trail.
- Solution: Add Firestore collection `audit_logs/{timestamp}` with user, action, before/after state. Retain for 90 days.

**No data export/import for alliance migration:**
- Problem: If alliance switches tools, player data is stuck in Firestore.
- Blocks: Teams considering other platforms must re-enter all player data.
- Solution: Add CSV export of players + teams. Add import from CSV/XLSX with validation.

**No two-factor authentication:**
- Problem: Single password compromise grants full access to team data.
- Blocks: Sensitive environments (competitive leagues) need higher security.
- Solution: Implement Firebase phone-based MFA or TOTP via Google Authenticator.

**No role-based access control (RBAC):**
- Problem: All alliance members have equal permissions (create events, modify players, accept invites).
- Blocks: Can't assign "read-only" managers, team captains, or admins.
- Solution: Add user roles in alliance members: `admin`, `captain`, `viewer`. Gate operations by role in Firestore rules.

## Test Coverage Gaps

**Untested area: canvas coordinate picker user interaction:**
- What's not tested: Multi-touch interactions, tap-and-hold, rapid clicking, edge coordinates (0,0 and max bounds)
- Files: `js/features/buildings/coordinate-picker-controller.js`, `tests/` (no dedicated test)
- Risk: Coordinates may be saved incorrectly on mobile or with unusual input patterns
- Priority: Medium (affects building placement on maps)

**Untested area: theme persistence across page reloads:**
- What's not tested: User sets theme → page reloads → theme persists (both localStorage and Firebase profile sync)
- Files: `js/shell/theme-controller.js`, `app.js:updateUserHeaderIdentity()`
- Risk: Theme can flip after reload if Firebase profile sync is slow or profile theme field is missing
- Priority: Medium (impacts visual consistency)

**Untested area: concurrent team generation and event editing:**
- What's not tested: User starts generating teams → modifies building config mid-generation → race condition
- Files: `js/features/generator/generator-actions.js`, `js/features/buildings/buildings-config-manager.js`
- Risk: Assignment algorithm may use stale building config or new buildings not in assignment
- Priority: Medium (affects team validity)

**Untested area: alliance leave/rejoin scenarios:**
- What's not tested: User leaves alliance → rejoins same alliance → data sync issues
- Files: `js/features/alliance/alliance-controller.js`, `firebase-module.js` (alliance methods)
- Risk: Cached alliance data may not refresh; invitations may not clear
- Priority: Low (rare operation)

**Untested area: Firebase offline mode (if added):**
- What's not tested: Offline operation, conflict resolution on reconnect
- Files: (future service worker code)
- Risk: Data loss or duplication if offline writes conflict with server
- Priority: N/A (feature not yet implemented)

**Untested area: Firestore security rules edge cases:**
- What's not tested: Token expiry boundary (exactly at expiry time), multi-user concurrent updates to same invitation
- Files: `firestore.rules`, `tests/firestore-rules/player-updates.rules.test.js` (incomplete coverage)
- Risk: Security rule logic might allow unintended access
- Priority: High (security-critical)

---

*Concerns audit: 2026-02-25*
