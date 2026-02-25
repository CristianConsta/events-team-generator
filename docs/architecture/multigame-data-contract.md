# Multi-Game Data Contract

Status: approved baseline for implementation  
Version: 1

## 1. Product constraints

- A game has:
  - `name` (required)
  - `logo` (required)
  - `company` (optional)
- Game is selected only after login or signup.
- A user has exactly one active game context at a time.
- Alliances are defined per game.
- A user can belong to different alliances in different games.
- Settings are defined at game level.
- Troop attributes are defined per game.
- Assignment algorithm can differ by event within the same game.
- Upload template/schema can differ by game.

## 2. Canonical IDs

- `gameId`: normalized lowercase snake_case string.
- `eventId`: normalized lowercase snake_case string.
- `algorithmId`: normalized lowercase snake_case string.
- `schemaId`: normalized lowercase snake_case string.
- `uid`: Firebase Auth UID.

## 3. Firestore canonical model

## 3.1 User root

Path: `users/{uid}`

```json
{
  "selectedGameId": "last_war",
  "migrationVersion": 1,
  "migratedToGameSubcollectionsAt": "serverTimestamp",
  "profile": {
    "displayName": "string",
    "emailLower": "string"
  },
  "meta": {
    "lastSignInAt": "serverTimestamp"
  }
}
```

Notes:
- Root doc does not store gameplay state beyond active-game pointer and migration metadata.

## 3.2 Game-scoped user doc

Path: `users/{uid}/games/{gameId}`

```json
{
  "gameMeta": {
    "id": "last_war",
    "name": "Last War: Survival",
    "logo": "data:image/... or https://...",
    "company": "optional string"
  },
  "settings": {
    "language": "en",
    "nickname": "string",
    "avatarDataUrl": "string",
    "uiPreferences": {}
  },
  "playerSource": "personal",
  "allianceId": null,
  "allianceName": null,
  "importSchemaVersion": 1,
  "assignmentPolicyVersion": 1,
  "updatedAt": "serverTimestamp"
}
```

## 3.3 Game-scoped players

Path: `users/{uid}/games/{gameId}/players/{playerId}`

```json
{
  "name": "string",
  "power": 1234567,
  "troopType": "Tank",
  "troopAttributes": {},
  "lastUpdated": "serverTimestamp"
}
```

## 3.4 Game-scoped events

Path: `users/{uid}/games/{gameId}/events/{eventId}`

```json
{
  "id": "desert_storm",
  "name": "Desert Storm",
  "logoDataUrl": "string",
  "mapDataUrl": "string",
  "assignmentAlgorithmId": "balanced_round_robin",
  "buildingConfig": [],
  "buildingConfigVersion": 1,
  "buildingPositions": {},
  "buildingPositionsVersion": 1,
  "eventSchemaVersion": 1,
  "updatedAt": "serverTimestamp"
}
```

## 3.5 Game-scoped alliances

Path: `games/{gameId}/alliances/{allianceId}`

```json
{
  "id": "string",
  "name": "string",
  "ownerUid": "string",
  "members": {
    "uid_1": { "role": "owner", "displayName": "string" },
    "uid_2": { "role": "member", "displayName": "string" }
  },
  "updatedAt": "serverTimestamp"
}
```

## 3.6 Game-scoped invitations

Path: `games/{gameId}/invitations/{invitationId}`

```json
{
  "id": "string",
  "gameId": "last_war",
  "allianceId": "string",
  "allianceName": "string",
  "senderUid": "string",
  "recipientEmailLower": "string",
  "status": "pending",
  "resendCount": 0,
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

## 4. Programmatic game configuration (non-user writable)

Source of truth is programmatic for now (`js/core/games.js`):

```json
{
  "id": "last_war",
  "name": "Last War: Survival",
  "logo": "string",
  "company": "optional",
  "troopModel": {
    "types": [],
    "attributes": {}
  },
  "importSchema": {
    "schemaId": "string",
    "version": 1,
    "columns": []
  },
  "algorithms": ["balanced_round_robin"]
}
```

## 5. Legacy compatibility mapping (Last War)

Legacy fields in `users/{uid}` map to `users/{uid}/games/last_war/*`:

- `playerDatabase` -> `/games/last_war/players/*`
- `events` -> `/games/last_war/events/*`
- `userProfile` -> `/games/last_war.settings` (game-level settings)
- `allianceId`, `allianceName`, `playerSource` -> `/games/last_war`
- legacy top-level building fields -> event docs under `last_war`

Rules:
- Reads prefer new game-scoped model.
- If missing and `gameId == last_war`, fallback to legacy fields.
- Writes dual-write during migration window only.

## 6. Data invariants

- Every gameplay read/write must resolve a valid `gameId`.
- Event docs must include `assignmentAlgorithmId`; missing value defaults to current legacy algorithm.
- Invitation `gameId` must match alliance `gameId`.
- `selectedGameId` must reference an allowed game from programmatic catalog.

