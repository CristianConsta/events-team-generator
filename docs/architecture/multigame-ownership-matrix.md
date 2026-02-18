# Multi-Game Ownership Matrix

Status: approved baseline for implementation  
Version: 1

## 1. Purpose

Define accountable ownership for each multi-game phase to prevent cross-area drift and unclear handoffs.

## 2. Owners

- Core/Domain owner:
  - `js/core/*`
  - domain rules (games, events, assignment policies, schema metadata)
- Service/Data owner:
  - `firebase-module.js`
  - `js/services/firebase-service.js`
  - Firestore model, migration, compatibility, feature-flag gating
- UI/Runtime owner:
  - `app.js`
  - `index.html`
  - `styles.css`
  - `js/ui/*`
  - `js/app-init.js`
- QA owner:
  - `tests/*`
  - `e2e/*`
  - migration fixture verification and release gates

## 3. Phase-to-owner mapping

| Phase | Summary | Primary Owner | Supporting Owners |
|---|---|---|---|
| A | Architecture contracts (data/service/migration) | Service/Data | Core/Domain, QA |
| B | Ownership + rollout governance | Service/Data | QA |
| C | Versioning strategy (schema + algorithms) | Core/Domain | Service/Data |
| D | Safety rails and feature flags | Service/Data | UI/Runtime, QA |
| E | Programmatic game catalog | Core/Domain | UI/Runtime |
| F | Runtime game context | UI/Runtime | Core/Domain |
| G | Read compatibility layer | Service/Data | QA |
| H | Dual-write migration | Service/Data | QA |
| I | Post-auth game selector | UI/Runtime | Service/Data, QA |
| J | Gameplay/settings game scoping | UI/Runtime | Service/Data, Core/Domain |
| K | Alliance/invite game scoping | Service/Data | UI/Runtime, QA |
| L | Per-event algorithm strategy | Core/Domain | UI/Runtime, QA |
| M | Per-game upload schema/template | Core/Domain | UI/Runtime, Service/Data, QA |
| N | Cutover and legacy retirement | Service/Data | QA, UI/Runtime |

## 4. Responsibility boundaries

- Core/Domain:
  - owns model semantics and deterministic behavior contracts.
  - does not directly implement persistence mechanics.
- Service/Data:
  - owns storage schema, migration execution, idempotency, fallback behavior.
  - owns rollout flags and rollback controls.
- UI/Runtime:
  - owns single active game UX and context transitions.
  - must never bypass service APIs for data access.
- QA:
  - owns acceptance gates and phase-level evidence.
  - blocks phase completion if fixture or isolation checks fail.

## 5. Sign-off protocol

Each phase requires:
1. Primary owner implementation sign-off.
2. QA owner gate sign-off.
3. Service/Data sign-off for any schema or migration-affecting phase.

