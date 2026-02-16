# JS Refactor Phase 1: Module Boundaries and Contracts

Date: 2026-02-16

## Objective
Define stable module boundaries before moving runtime code out of `app.js` and `firebase-module.js`.

Phase 1 intentionally does not change runtime behavior. It creates:
- A target module map.
- Shared contracts for data/state/events.
- Naming and folder conventions for subsequent extraction phases.

## Target Module Boundaries

| Domain | Current Location | Target Module |
| --- | --- | --- |
| App bootstrap/orchestration | `app.js`, `js/app-init.js` | `js/shell/bootstrap/*` |
| Navigation + page routing + global overlays | `app.js` | `js/shell/navigation/*`, `js/shell/overlays/*` |
| Generator flow | `app.js`, `js/ui/player-table-ui.js`, `js/core/assignment.js` | `js/features/generator/*` |
| Players management CRUD + filters | `app.js` | `js/features/players-management/*` |
| Events manager + building editor + coordinates | `app.js`, `js/ui/event-buildings-editor-ui.js`, `js/ui/event-list-ui.js` | `js/features/events-manager/*` |
| Alliance panel + invites | `app.js`, `js/ui/alliance-panel-ui.js` | `js/features/alliance/*` |
| Notifications panel + actions | `app.js` | `js/features/notifications/*` |
| Firebase adapter | `js/services/firebase-service.js` | `js/shared/data/firebase-gateway.js` (backward-compatible facade) |
| Shared UI helpers | scattered in `app.js` | `js/shared/ui/*` |
| Shared app state/selectors | globals in `app.js` | `js/shared/state/*` |

## Shared Contracts

## 1) Data Access Contract (`DataGateway`)
Contract used by feature modules. Existing `FirebaseService` remains source of truth until full migration.

Required shape:
- Auth/session:
  - `isAvailable()`
  - `isSignedIn()`
  - `getCurrentUser()`
  - `setAuthCallback(cb)`
- Player data:
  - `getPlayerSource()`
  - `setPlayerSource(source)`
  - `getActivePlayerDatabase()`
  - `upsertPlayerEntry(source, originalName, payload)`
  - `removePlayerEntry(source, playerName)`
- Events/buildings:
  - `getAllEventData()`
  - `upsertEvent(eventId, payload)`
  - `removeEvent(eventId)`
  - `getBuildingConfig(eventId)`
  - `setBuildingConfig(eventId, config)`
  - `getBuildingPositions(eventId)`
  - `setBuildingPositions(eventId, positions)`
- Alliance/notifications:
  - `loadAllianceData()`
  - `createAlliance(name)`
  - `leaveAlliance()`
  - `sendInvitation(email)`
  - `checkInvitations()`
  - `acceptInvitation(invitationId)`
  - `rejectInvitation(invitationId)`
  - `getInvitationNotifications()`

## 2) App State Contract (`AppState`)
Single source of UI state, split into slices:
- `session`: user identity, auth status, theme, language.
- `navigation`: current view, open panels/modals.
- `generator`: selected event, selected algorithm, team selections, filters, assignments, substitutes.
- `playersManagement`: source, filters, editing row, add-panel state.
- `eventsManager`: draft metadata, edit mode, building config/positions runtime.
- `alliance`: members, invites, pending actions.
- `notifications`: list, unread count, panel open state.

Rule:
- Feature modules may mutate only their owned slice through explicit update functions.

## 3) UI Event Contract
Cross-module events use namespaced string keys and typed payload objects.

Naming:
- `feature.action` pattern.
- Examples:
  - `navigation.view.changed`
  - `generator.algorithm.changed`
  - `players.entry.deleted`
  - `events.definition.saved`
  - `alliance.invite.accepted`

Payload rule:
- Always plain object.
- Include stable identifiers (`eventId`, `playerName`, `team`, etc.).

## Folder and Naming Conventions

## Folder skeleton

```text
js/
  shell/
    bootstrap/
    navigation/
    overlays/
  features/
    generator/
    players-management/
    events-manager/
    alliance/
    notifications/
  shared/
    data/
    state/
    ui/
```

## File naming
- Kebab case for file names.
- Suffix by role where relevant:
  - `*-controller.js`
  - `*-state.js`
  - `*-view.js`
  - `*-service.js`
  - `*-selectors.js`

## Module export style
- Keep current IIFE/global compatibility during migration.
- New modules should expose one global namespace per domain until ES module migration is planned.

## Migration Sequencing (Phase 2+ Reference)
1. Extract shell bootstrap/navigation first.
2. Extract generator and players-management next (highest churn areas).
3. Extract events-manager and alliance/notifications.
4. Move shared state/gateway abstractions last in each wave to avoid circular coupling.

## Phase 1 Exit Criteria
- Boundaries are documented and accepted.
- Folder skeleton exists in repo.
- No runtime behavior changes introduced.
- Existing test suite remains green.
