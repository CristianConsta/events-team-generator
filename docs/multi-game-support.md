feature: use the planner agent to define a strategy and a plan to make the platform to support multiple game titles, meaning the generator, players management, event management, alliance is defined at a game level. 
What is defined right now in the platform is defined for the game called Last War: Survival game. 
Users can't define new games for now, can be done only programmatically, but I want to know what the plan looks. 

here is the plan.

1. Goal
Make the platform multi-game so these domains are scoped by gameId:

Generator
Players Management
Events Management
Alliance
settings
Keep Last War as the default game and keep adding new games programmatically only (no user-defined games yet).

2. Assumptions

Current game-specific coupling exists in:
events.js (line 6)
firebase-module.js (line 61)
app.js (line 1038)
Existing users must not lose data.
No build tool/framework migration requested.
3. Scope
In scope:

Data model namespacing by game
Runtime game context/state
UI game switcher
Per-game event/player/alliance behavior
Migration + backward compatibility
Out of scope:

User-created games
Full backend rewrite
Framework rewrite
4. Plan

Introduce game model (M)
Add games.js with hardcoded game catalog (last_war first).
Define per-game config: label, troop taxonomy, default events, import template metadata.
Keep IIFE export pattern.
Add game context in app state (M)
Add currentGameId in app.js and wire page rendering to active game.
Refactor event selection from global currentEvent to {gameId, eventId} context.
Touchpoints include app.js (line 1038), app.js (line 1241), app.js (line 1450), app.js (line 3533).
Namespace storage by game with compatibility layer (L)
In firebase-module.js, add per-game storage shape.
Keep read fallback for legacy Last War fields (playerDatabase, events, allianceId, etc.).
On save, write new schema; optionally dual-write Last War for one release.
Existing hardcoded legacy IDs/defaults (firebase-module.js (line 61), firebase-module.js (line 195)) move behind game-aware helpers.
Scope alliance by game (L)
Move alliance membership/source to game-specific fields.
Ensure invitation and membership flows include gameId.
Update getters/setters in firebase-service.js to accept game context.
UI: add game switcher (M)
Add selector in header/settings (index.html, app.js) and persist selected game.
On switch: reload scoped players/events/alliance and reset active event for that game.
Keep all user-visible strings in translations.js.
Testing and migration hardening (L)
Add core tests for game scoping in *.test.js.
Add E2E workflows for game switching + per-game isolation in *.e2e.js.
Add migration tests for legacy Last War users.
5. Validation

Unit/integration: npm test
E2E smoke: npm run test:e2e:smoke
E2E regression: npm run test:e2e:regression
Manual checks:
Switch game and confirm players/events/alliance are isolated.
Generate teams in game A does not affect game B.
Legacy user logs in and sees Last War data intact.
6. Risks and mitigations

Risk: Legacy data regression.
Mitigation: adapter fallback + migration tests + phased dual-write.
Risk: Game context leaks between modules.
Mitigation: enforce gameId in service/core APIs.
Risk: Alliance invite incompatibility.
Mitigation: add gameId to invite documents and validation guards.
Risk: i18n/UI breakage from new selector.
Mitigation: translation key completeness + existing QA checks.

Locked product decisions

Alliances are per game.
A user can belong to different alliances in different games.
Troop model is per game and defined when a game is created.
Firestore uses subcollection per game.
Settings are per game (not global).
Updated target model (Firestore)

users/{uid}: only global identity/meta (email, auth basics, maybe lastSelectedGameId).
users/{uid}/games/{gameId}: game-scoped root doc:
gameMeta: name, logo, company
settings
playerSource
allianceId, allianceName
users/{uid}/games/{gameId}/players/{playerId}
users/{uid}/games/{gameId}/events/{eventId}
alliances/{gameId}_{allianceId} or games/{gameId}/alliances/{allianceId} (recommended)
invitations must include gameId.
Revised implementation plan

Add game catalog/domain (games.js) with attributes: logo/avatar, name, company who created it.
Add currentGameId as mandatory runtime context after auth.
Build post-login game selector flow (no pre-login selection).
Refactor service layer (firebase-module.js, firebase-service.js) so every gameplay/settings/alliance operation is game-scoped.
Migrate legacy Last War data into users/{uid}/games/last_war/* on first load.
Refactor app state in app.js:
one active game at a time,
switching game resets transient state and reloads scoped data.
Scope alliances and invitations strictly by gameId.
Extend UI for game switcher + current game identity badge/logo.
Update tests:
unit/integration for scoping rules,
E2E for select/switch game, isolation, per-game alliance, per-game settings.

Updated Plan With QA Strategy (QA-Agent Aligned)

QA Goal
Prevent regressions while introducing multi-game scoping for generator, players, events, alliances, and settings.

Baseline Gate (before first refactor)
Run and store baseline results:

cmd /c npm test
cmd /c npm run test:e2e:smoke
cmd /c npm run test:e2e:regression
Treat this baseline as release parity target.
Phase Gates (must pass at each implementation phase)

Phase A (game model + context): unit tests for currentGameId behavior and fallback to last_war.
Phase B (Firestore game subcollections): integration tests for read/write paths and legacy fallback migration.
Phase C (UI game selector post-auth): E2E smoke for login/signup -> game select -> generator visible.
Phase D (alliance per game): E2E regression for “different alliance in different game” isolation.
Phase E (settings per game): regression test proving settings A do not leak into game B.
QA-Agent Existing Checks to Keep Green
Keep all current QA-agent checks unchanged:

translations integrity across 6 languages
required index.html IDs and page structure
Edge/mobile safety checks
CSS safety checks
accessibility checks
buildings editor display-toggle behavior
New Multi-Game QA Coverage
Add tests for:

game switch resets active in-memory planning context
players/events/buildings scoped strictly by gameId
alliances/invitations include and enforce gameId
settings are game-scoped only
troop schema differences per game do not break generator or import paths
legacy Last War user migrates safely to games/last_war/* with no data loss
Data Migration QA Strategy

Test with fixtures: legacy-only user, mixed user, new multi-game user.
Verify migration idempotency (running migration twice is safe).
Validate rollback path (legacy read fallback still works if migration incomplete).
Block release if migrated counts mismatch expected records.
CI and Release Quality Gates

PR required checks: npm test + test:e2e:smoke.
Daily/merge-to-main: test:e2e:regression.
Multi-game feature flag rollout: enable internal first, then wider rollout after zero critical regressions for agreed window.
Exit Criteria (Go/No-Go)
Go only if:

baseline parity is maintained
new multi-game tests pass in Edge desktop and mobile emulation
migration tests pass with no data corruption
QA report status is PASS with no unresolved high-severity issues.

Model update

Each event config should include an assignmentAlgorithmId.
Algorithms are registered per game (or globally with game overrides), e.g.:
games/{gameId}/algorithms/{algorithmId} metadata
event points to algorithm id
Runtime dispatcher:
assignTeamToBuildings(players, eventConfig, gameId) -> resolves algorithm -> executes.
Architecture change

Keep current default algorithm as balanced_round_robin (today’s logic).
Add algorithm registry module (e.g. assignment-registry.js).
Keep algorithm implementations isolated (strategy pattern), not hardcoded in UI flow.
UI/Event editor: algorithm selector per event (programmatic list initially).
QA strategy update
Add mandatory tests for algorithm variability:

Event A and Event B in same game can use different algorithms.
Same event concept across different games can use different algorithms.
Unknown algorithm id falls back safely (or hard-fails with clear message, choose one and enforce).
Determinism checks where required (same input => same output for deterministic algorithms).
Capacity/constraint invariants for every algorithm:
no duplicate player assignment
no slot overflow
priority and slot constraints respected
Regression suite matrix:
at least 1 smoke path per supported algorithm id
E2E generate flow validates selected event uses selected algorithm.
Migration tests:
legacy events without assignmentAlgorithmId default to current algorithm id.


2z2BdO8aVsUovqQWWL9WCRMdV933