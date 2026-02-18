# Multi-Game Service Contract

Status: approved baseline for implementation  
Version: 1

## 1. Purpose

Define strict service-layer contracts for game-scoped behavior across:
- players
- events
- settings
- alliances
- invitations
- assignment algorithms
- upload schemas

This contract applies to `firebase-module.js` and `js/services/firebase-service.js`.

## 2. Context rule

Exactly one active game context is allowed at runtime.

Required behavior:
- Methods that mutate or query gameplay data must either:
  - receive explicit `gameId`, or
  - resolve from active context (`getActiveGameId()`).
- If no `gameId` can be resolved, return a typed failure:
  - `{ success: false, error: 'missing-active-game' }`

## 3. Context API

- `setActiveGame(gameId): Promise<{ success: boolean, error?: string }>`
- `getActiveGame(): { gameId: string | null }`
- `listAvailableGames(): Array<{ id, name, logo, company? }>`

## 4. Authentication API (not game-scoped)

- `signInWithGoogle()`
- `signInWithEmail(email, password)`
- `signUpWithEmail(email, password)`
- `signOut()`

Post-auth requirement:
- active game must be established before gameplay API calls.

## 5. Players API (game-scoped)

- `getPlayerDatabase(gameId?)`
- `getAlliancePlayerDatabase(gameId?)`
- `getActivePlayerDatabase(gameId?)`
- `upsertPlayerEntry(gameId?, source, originalName, nextPlayer)`
- `removePlayerEntry(gameId?, source, playerName)`
- `uploadPlayerDatabase(gameId?, file)`
- `uploadAlliancePlayerDatabase(gameId?, file)`
- `setPlayerSource(gameId?, source)`
- `getPlayerSource(gameId?)`

## 6. Settings API (game-scoped)

- `getUserProfile(gameId?)`
- `setUserProfile(gameId?, profile)`
- `saveUserData(gameId?, options?)`

Notes:
- profile fields are game-level preferences in this model.

## 7. Events and building config API (game-scoped)

- `getAllEventData(gameId?)`
- `getEventIds(gameId?)`
- `getEventMeta(gameId?, eventId)`
- `upsertEvent(gameId?, eventId, payload)`
- `removeEvent(gameId?, eventId)`
- `setEventMetadata(gameId?, eventId, metadata)`
- `getBuildingConfig(gameId?, eventId)`
- `setBuildingConfig(gameId?, eventId, config)`
- `getBuildingConfigVersion(gameId?, eventId)`
- `setBuildingConfigVersion(gameId?, eventId, version)`
- `getBuildingPositions(gameId?, eventId)`
- `setBuildingPositions(gameId?, eventId, positions)`
- `getBuildingPositionsVersion(gameId?, eventId)`
- `setBuildingPositionsVersion(gameId?, eventId, version)`

## 8. Alliance and invitation API (game-scoped)

- `getAllianceId(gameId?)`
- `getAllianceName(gameId?)`
- `getAllianceData(gameId?)`
- `getAllianceMembers(gameId?)`
- `createAlliance(gameId?, name)`
- `leaveAlliance(gameId?)`
- `loadAllianceData(gameId?)`
- `sendInvitation(gameId?, email)`
- `checkInvitations(gameId?)`
- `acceptInvitation(gameId?, invitationId)`
- `rejectInvitation(gameId?, invitationId)`
- `revokeInvitation(gameId?, invitationId)`
- `resendInvitation(gameId?, invitationId)`
- `getPendingInvitations(gameId?)`
- `getSentInvitations(gameId?)`
- `getInvitationNotifications(gameId?)`

Hard rule:
- invitation `gameId` must match active/explicit `gameId`; reject otherwise.

## 9. Assignment algorithm API

- `getEventAssignmentAlgorithm(gameId?, eventId): string`
- `setEventAssignmentAlgorithm(gameId?, eventId, algorithmId)`
- `listGameAlgorithms(gameId?): Array<{ id, name, deterministic }>`
- `resolveAssignmentAlgorithm(gameId?, eventId): Function`

Behavior:
- if event has no algorithm id, default to legacy current algorithm id.
- if algorithm id unknown, return typed failure or configured fallback.

## 10. Upload schema API

- `getImportSchema(gameId?): { schemaId, version, columns, validations }`
- `downloadPlayerTemplate(gameId?)`
- `validateUploadAgainstSchema(gameId?, parsedRows)`

Behavior:
- wrong-game template must fail validation with localized user-facing error.

## 11. Error contract

Standard async result shape:

```json
{
  "success": false,
  "error": "machine-readable-code",
  "message": "optional localized-friendly detail"
}
```

Minimum error codes:
- `missing-active-game`
- `invalid-game-id`
- `invalid-event-id`
- `invalid-alliance-context`
- `invalid-invitation-context`
- `unknown-assignment-algorithm`
- `invalid-import-schema`
- `firebase-not-loaded`

## 12. Non-breaking evolution rules

- New parameters are optional only during migration period.
- Deprecated signatures must be supported until `legacy-read-fallback` removal phase.
- No UI module should directly query Firestore; all access goes through service adapter.

## 13. Legacy API deprecation timeline

Release markers:
- `R0`: first release with game-scoped APIs available.
- `R1`: dual-write active by default.
- `R2`: legacy writes disabled by default (fallback reads still enabled).
- `R3`: legacy read fallback removed.

Signature policy:

1. `R0`:
- Introduce game-aware signatures from this contract.
- Legacy signatures remain supported.

2. `R1`:
- Emit warning logs when legacy signatures are called.
- CI must include at least one test suite run with game-aware signatures only.

3. `R2`:
- Legacy signatures still callable but routed through compatibility shim only.
- New code must not add new legacy-signature call sites.

4. `R3`:
- Remove compatibility shim and legacy signatures.
- Remove tests that assert legacy-signature behavior.

Deprecation guardrail:
- A release cannot progress from `R2` to `R3` unless migration policy thresholds are met.
