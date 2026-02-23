# Multigame Backend / Database Audit

Date: 2026-02-23
Auditor: backend-db specialist agent
Sources examined: `firestore.rules`, `firestore.indexes.json`, `firebase-module.js`, `js/services/firebase-service.js`, `js/shared/data/data-gateway-contract.js`, `scripts/`, `docs/archive/architecture/multigame-data-contract.md`, `docs/archive/architecture/multigame-service-contract.md`

---

## 1. Firestore Data Model

### 1.1 `games/{gameId}` top-level collection

**Status: IMPLEMENTED**

- `firestore.rules` line 117: `match /games/{gameId}` exists.
- Sub-collections `alliances/{allianceId}` and `invitations/{invitationId}` are present under it.
- `firebase-module.js` exposes `getGameDocRef(gameId)`, `getGameAllianceCollectionRef(gameId)`, `getGameAllianceDocRef(gameId, allianceDocId)`, `getGameInvitationCollectionRef(gameId)`, `getGameInvitationDocRef(gameId, invitationId)`.

### 1.2 `users/{uid}/games/{gameId}` sub-collection

**Status: IMPLEMENTED**

- `firestore.rules` lines 100–114: `match /users/{uid}/games/{gameId}` with nested `players/{playerId}`, `events/{eventId}`, `event_media/{eventId}`.
- `firebase-module.js` exposes `getUserGameDocRef(userId, gameId)`, `getUserGamePlayersCollectionRef(userId, gameId)`, `getUserGameEventsCollectionRef(userId, gameId)`, `getUserGameEventMediaCollectionRef(userId, gameId)`.
- `loadGameScopedPlayersFromSubcollection` and `loadGameScopedEventsFromSubcollection` implement game-scoped reads.

### 1.3 `app_config/{docId}` global collection

**Status: IMPLEMENTED**

- `firestore.rules` lines 165–168: readable by signed-in users; writable only by super-admin.
- Used for game metadata config overrides (`setGameMetadataConfigOverride` in `firebase-module.js`).

### 1.4 Legacy `alliances/{allianceId}` root collection

**Status: PRESENT (read-only, locked for writes)**

- `firestore.rules` line 188: `match /alliances/{allianceId}` — `allow read: if signedIn()`, `allow write: if false`.
- Sub-collections `event_history`, `player_stats`, `update_tokens`, `pending_updates` still readable via `isAllianceMember` helper.
- Comment confirms this is retained for compatibility during rollout.

### 1.5 Legacy `invitations/{invitationId}` root collection

**Status: PRESENT (read-only, locked for writes)**

- `firestore.rules` lines 239–242: `allow read: if signedIn()`, `allow write: if false`.

---

## 2. Security Rules Assessment

### Super-admin restrictions on game metadata

**Status: IMPLEMENTED**

- `games/{gameId}` (top-level): `allow create, update, delete: if isSuperAdmin()` (line 119).
- `app_config/{docId}`: `allow write: if isSuperAdmin()` (line 167).
- `isSuperAdmin()` is hard-coded to UID `2z2BdO8aVsUovqQWWL9WCRMdV933` (line 13).

### Game-scoped payload validation

**Status: IMPLEMENTED**

- `isGameScopedPayloadFor(gameId)` (lines 22–26): validates that written documents carry a `gameId` field matching the path parameter.
- Applied to alliance creates, alliance updates, and invitation creates.

### `invitationBelongsToGame` validation

**Status: IMPLEMENTED**

- Verified on invitation reads, updates, and deletes (lines 143–161).

### `isAllianceMember` helper — hard-coded game path

**Status: PARTIAL / KNOWN LIMITATION**

- `isAllianceMember(allianceId)` (lines 173–180) hard-codes `games/last_war/alliances/$(allianceId)`.
- Comment acknowledges this; it cannot use a dynamic `gameId` parameter in Firestore security rule helper functions.
- This means the helper only works for the `last_war` game context; adding a second game would require duplicating or restructuring this helper.

### Anonymous user rules

**Status: IMPLEMENTED**

- `isAnonymous()` helper (lines 182–185) gates token usage and pending-update submissions under both `users/{uid}` and legacy `alliances/{allianceId}` paths.

---

## 3. Firebase Operations in `firebase-module.js`

### 3.1 Game context management

**Status: IMPLEMENTED**

- `activeGameplayGameId` runtime variable (line 395) tracks the current game.
- `resolveGameplayContext(context)` resolves explicit or active game context.
- `isActiveGameplayGameId(gameId)` guards read operations.

### 3.2 Game-scoped CRUD

**Status: IMPLEMENTED**

- Players: `loadGameScopedPlayersFromSubcollection`, `persistGameScopedPlayersSubcollection`.
- Events: `loadGameScopedEventsFromSubcollection`, `persistGameScopedEventsSubcollection`.
- Alliances: game-scoped via `getGameAllianceCollectionRef` / `getGameAllianceDocRef`.
- Invitations: game-scoped via `getGameInvitationCollectionRef` / `getGameInvitationDocRef`.
- All public-facing read methods (`getPlayerDatabase`, `getAllEventData`, `getBuildingConfig`, etc.) call `getResolvedGameId` first and guard with `isActiveGameplayGameId`.

### 3.3 Dual-write pattern

**Status: MISSING FROM RUNTIME (flag controlled, default OFF)**

- `MULTIGAME_DUAL_WRITE_ENABLED` flag exists in both `firebase-module.js` and `firebase-service.js` but defaults to `false`.
- `observabilityCounters.dualWriteMismatchCount` field exists, suggesting the dual-write instrumentation is scaffolded.
- No active dual-write logic was found executing conditional writes to both old and new paths in the current codebase.
- The flag infrastructure is present but dual-write is not active by default; it is gated behind the flag.

### 3.4 Legacy read fallback

**Status: IMPLEMENTED (flag controlled)**

- `MULTIGAME_READ_FALLBACK_ENABLED` flag gates fallback reads.
- `extractLegacyGameScopedData` and `extractLegacyPlayerDatabaseFallback` provide legacy compatibility for `last_war` game.
- `loadUserData` falls back to legacy user root fields when game-scoped doc is absent (line 3031).

### 3.5 Game metadata

**Status: IMPLEMENTED**

- `getGameMetadata(gameId)` and `setGameMetadata(gameId, payload)` in `firebase-module.js` (lines 1669–1729).
- `setGameMetadata` enforces super-admin check and includes a strict-mode guard.
- `firebase-service.js` exposes `getGameMetadata`, `setGameMetadata`, `listGameMetadata`, and `listAvailableGames` as public API.

### 3.6 `listAvailableGames` / game catalog

**Status: IMPLEMENTED (programmatic, not Firestore-backed)**

- `listAvailableGames` delegates to `window.DSCoreGames.listAvailableGames()` (programmatic catalog in `js/core/games.js`).
- No `games/{gameId}` catalog reads from Firestore were found; game catalog is programmatic per the data contract (section 4).

---

## 4. Service Contract Compliance (`multigame-service-contract.md`)

| Contract API                        | Status in `firebase-service.js`                  |
|-------------------------------------|--------------------------------------------------|
| `setActiveGame(gameId)`             | IMPLEMENTED — line 753                           |
| `getActiveGame()`                   | IMPLEMENTED — line 750                           |
| `listAvailableGames()`              | IMPLEMENTED — line 692                           |
| Players API (all methods)           | IMPLEMENTED — delegated to FirebaseManager       |
| Settings API                        | IMPLEMENTED — `getUserProfile`, `setUserProfile`, `saveUserData` |
| Events API (all building config)    | IMPLEMENTED — full set present                   |
| Alliance API                        | IMPLEMENTED — full set present                   |
| Invitations API                     | IMPLEMENTED — full set present                   |
| `getEventAssignmentAlgorithm`       | PARTIAL — present in FirebaseManager, not surfaced in service contract table explicitly |
| `listGameAlgorithms`                | NOT FOUND in `firebase-service.js` public API    |
| `getImportSchema`                   | NOT FOUND as `getImportSchema` in service.js; `getPlayerImportSchema` exists in firebase-module.js |
| `downloadPlayerTemplate`            | NOT FOUND in `firebase-service.js`               |
| `validateUploadAgainstSchema`       | NOT FOUND in `firebase-service.js`               |
| Error contract (`missing-active-game`, etc.) | PARTIAL — `missing-active-game` not consistently returned; `isActiveGameplayGameId` check returns undefined, not typed failure |

### Data gateway contract (`data-gateway-contract.js`)

**Status: PARTIAL**

- The contract lists standard gameplay methods (players, events, alliance, notifications, eventHistory, playerUpdates).
- Game context methods (`setActiveGame`, `getActiveGame`, `listAvailableGames`) are **not** in the `DATA_GATEWAY_METHODS` contract shape.
- This means gateway validation does not enforce the game context API presence.

---

## 5. Phase-by-Phase Backend Status

| Phase | Description                               | Status      | Notes |
|-------|-------------------------------------------|-------------|-------|
| 2     | Games catalog (`games/{gameId}` docs)     | PARTIAL     | Firestore path and rules exist; catalog is programmatic, not Firestore-read |
| 4     | Game-scoped reads with gameId             | IMPLEMENTED | `loadGameScopedPlayersFromSubcollection`, `loadGameScopedEventsFromSubcollection` |
| 6     | Dual-write + migration utilities          | PARTIAL     | Flag infrastructure exists, dual-write defaulted OFF; migration scripts present |
| 9     | Game-scoped operations (full CRUD)        | IMPLEMENTED | All player/event write operations resolve gameId |
| 10    | Game-scoped alliances + invitations       | IMPLEMENTED | Security rules and Firestore refs fully game-scoped |
| 12    | Game-scoped import schema                 | PARTIAL     | `getPlayerImportSchema(gameId)` exists in firebase-module.js; not surfaced as `getImportSchema` in service contract |
| 13    | Super-admin game metadata                 | IMPLEMENTED | `setGameMetadata` + `isSuperAdmin()` rule in place |

---

## 6. Migration Scripts Found

| Script                                              | Purpose |
|-----------------------------------------------------|---------|
| `migrate_legacy_last_war_to_game_subcollections.js` | Copy legacy root fields to `users/{uid}/games/last_war/` sub-collections |
| `migrate_multigame_first_class.js`                  | Full migration to game-scoped model; supports dry-run, batching, report output |
| `migrate_legacy_building_fields_to_events.js`       | Move legacy building fields into event docs |
| `migrate_users_email_to_uid.js`                     | Email-to-UID migration for invitations |
| `sync_event_building_defaults.js`                   | Sync default building configurations |
| `inspect_user_buildings.js`                         | Inspection/reporting utility |

Migration reports are stored under `docs/architecture/migration-report-*.json`.

---

## 7. Firestore Indexes

**Status: NO GAME-SPECIFIC INDEXES**

`firestore.indexes.json` contains three composite indexes, all on the `event_history` collection group:
- `(gameId ASC, scheduledAt DESC)`
- `(status ASC, scheduledAt DESC)`
- `(finalized ASC)`

The `gameId` field appears in the first index, which is appropriate for game-scoped event history queries. No indexes exist for `games/{gameId}/alliances` or other game-scoped collections — these rely on Firestore single-field defaults, which is acceptable if queries do not require multi-field ordering.

---

## 8. Summary of Gaps

1. **Dual-write is scaffolded but not active** — `MULTIGAME_DUAL_WRITE_ENABLED` defaults to `false`; the migration runbook should verify this flag is enabled during cutover.
2. **`isAllianceMember` security rule helper is hard-coded to `last_war`** — extending to additional games requires a rule refactor.
3. **Upload schema API incomplete in service layer** — `getImportSchema`, `downloadPlayerTemplate`, and `validateUploadAgainstSchema` from the service contract are not exposed in `firebase-service.js`.
4. **`listGameAlgorithms` not in `firebase-service.js` public API** — the assignment algorithm contract is partially missing from the service adapter.
5. **Error contract not fully typed** — `missing-active-game` typed failure shape is defined in the contract doc but not consistently returned by all gated operations.
6. **Game context API absent from `data-gateway-contract.js`** — gateway shape validation does not cover `setActiveGame` / `getActiveGame`.
