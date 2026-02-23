# Multi-Game Phase 10: Game-Scoped Alliances and Invitations

Date: 2026-02-18  
Plan reference: `docs/architecture/multigame-implementation-plan.md` (Phase 10)

## Objective

Scope alliance membership and invitation workflows by explicit `gameId` so users can belong to different alliances in different games without cross-game leakage.

## Implemented

1. Added game-scoped alliance and invitation storage helpers in `firebase-module.js`:
- `games/{gameId}/alliances/{allianceId}`
- `games/{gameId}/invitations/{invitationId}`

2. Added runtime alliance context management in `firebase-module.js`:
- `activeAllianceGameId`
- `setActiveAllianceGameContext(gameId)`
- `persistUserGameAssociationState(gameId, overrides)`
- `resolveUserGameAssociationState(gameId)`

3. Updated alliance operations to enforce game context:
- `createAlliance(..., context)`
- `loadAllianceData(context)`
- `leaveAlliance(context)`
- realtime alliance listener now game-scoped

4. Updated invitation operations to enforce game context:
- `sendInvitation(..., context)`
- `checkInvitations(context)`
- `acceptInvitation(..., context)`
- `rejectInvitation(..., context)`
- `revokeInvitation(..., context)`
- `resendInvitation(..., context)`

5. Added typed context mismatch behavior in `firebase-module.js`:
- `invalid-invitation-context`
- `invalid-alliance-context`
- invitation payloads include `gameId`

6. Updated service and app callsites to pass gameplay context:
- `js/services/firebase-service.js` alliance/invitation getters now accept context.
- `app.js` alliance panel, invitation actions, notification reads, and source controls now pass `getGameplayContext(...)`.

7. Added regression coverage in `tests/firebase-service.extended.test.js`:
- explicit `gameId` propagation checks for alliance/invitation methods and getters.

## Validation

1. Unit/integration:
- `npm test`
- Result: `269 passed`, `0 failed`.

2. E2E smoke:
- `npm run test:e2e:smoke`
- Result: `10 passed`, `0 failed`, `2 skipped`.

## Exit Criteria

- Alliance and invitation operations now resolve explicit game context: complete.
- Cross-game invitation context mismatches are rejected with typed errors: complete.
- Service/UI callsites pass gameplay context for alliance/invitation operations: complete.
