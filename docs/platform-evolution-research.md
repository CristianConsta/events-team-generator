# Platform Evolution Research — Multi-Game Event Planning

> Generated: 2026-02-21 | Research team: 2 researchers (Sonnet) + 1 architect (Opus) + 1 senior developer (Opus)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Market Research](#2-market-research)
3. [Technical Feasibility](#3-technical-feasibility)
4. [Architecture Proposal](#4-architecture-proposal)
5. [Senior Developer Review](#5-senior-developer-review)
6. [Event History & Player Reliability](#6-event-history--player-reliability)
7. [Player Self-Update via Magic Links](#7-player-self-update-via-magic-links)
8. [Unified Implementation Roadmap](#8-unified-implementation-roadmap)

---

## 1. Executive Summary

### Market Gap
No dedicated web tool exists for Last War (or similar mobile strategy games) event planning. Alliances use Discord + spreadsheets + screenshots. The events-team-generator already fills a genuine gap with its assignment algorithm.

### Team Consensus
- **Keep vanilla JS** — no framework migration, no TypeScript
- **No build tool required** for MVP (consider esbuild later for DX)
- **Extend existing patterns** — `GAME_CATALOG`, `ASSIGNMENT_REGISTRY`, gateway pattern, `DSAppStateStore`
- **Additive Firestore schema** — no breaking changes, no migrations
- **Incremental delivery** — every phase ships independently

### Recommended Tech Stack Changes

| Change | Verdict | Why |
|--------|---------|-----|
| esbuild bundler | Recommended (Phase 2+) | Eliminates script-tag fragility, enables ESM migration |
| Konva.js (vendored) | Recommended | Best fit for interactive maps + drag-and-drop, no build needed |
| Firebase RTDB | Defer | Firestore listeners sufficient for now (~1-2s latency) |
| React/Vue/Svelte | No | Working app, 3-6 month rewrite for zero features |
| TypeScript | No | JSDoc gives 80% benefit without build step tax |
| Custom SVG timeline | Recommended | No library needed for phase visualization |

---

## 2. Market Research

### How Top Mobile Strategy Games Handle Event Coordination

#### Last War: Survival (Desert Storm / Canyon Storm)
- 50v50 battles; alliances fight for buildings; scoring: +500 per capture, +300 per defense, +200 per elimination, -100 per death
- Canyon Storm: 2v1 alliance format (Rulebringers vs combined Dawnbreakers)
- Alliance guides recommend: command hierarchy, pre-event coordination via Discord, assignment of substitutes
- No dedicated in-game planning tool

#### Rise of Kingdoms (KvK)
- Third-party tools: ROKStats, ROKBoard, RoKHub, ROK Dashboard — all analytics, NOT planning tools
- RokTracker (open source): tracks top-X players by alliance/kingdom
- KvK divided into phases: pre-KvK, Eve of Crusade, active KvK with tides/chapters

#### Whiteout Survival
- Alliance Championship: structured tournament, 5x 11h preparation rounds before battles
- R4/R5 leaders assign players to lanes during preparation
- No dedicated web tool

#### Clash of Clans / Clash Royale
- Most mature ecosystem for third-party tools (public API)
- ClashKing Bot (open source, Discord): real-time war logs, CWL, roster management
- ClashPerk: CWL, War Log, missed attacks, roster management
- These Discord bots are the gold standard for gaming community coordination

### Key Gaps and Opportunities

1. **Multi-game support**: Expanding to Whiteout Survival, RoK, State of Survival would require event type definitions per game
2. **Timeline/phase system**: No tool shows "we are in Phase 2, here are the phase-specific assignments"
3. **Discord integration**: Dominant interface for gaming communities, but adds server component complexity
4. **Alliance-wide assignment sharing**: A shared "battle plan" view (read-only URL) is highly valuable
5. **Substitute management**: Sub-queue system is absent from all found tools
6. **Real-time assignment updates**: No tool supports live slot swaps during events

### Strategy Patterns from Top Alliances
- Pre-assign every player to a specific building before the event
- Create substitute lists with ordered candidates
- Use power + troop type as primary assignment criteria
- Have dedicated subs for "anchor" buildings (highest priority)
- Plan around capture order vs. defense priorities

---

## 3. Technical Feasibility

### Current Codebase Assessment

**Strengths:**
- `GAME_CATALOG` in `games.js` — strategy pattern for multi-game (currently `last_war` only)
- `ASSIGNMENT_REGISTRY` in `assignment-registry.js` — pluggable algorithm dispatch
- `DSAppStateStore` — pub/sub state store with selectors
- Feature folders (`js/features/`) and gateway pattern (`js/shared/data/`)
- Feature flags for multigame rollout (`MULTIGAME_ENABLED`, `MULTIGAME_DUAL_WRITE_ENABLED`)
- ESM entry point exists (`main.mjs`)

**Pain Points:**
- `app.js` at 8,600 lines — god file coupling everything
- `firebase-module.js` at 5,600 lines — another monolith
- 35+ `<script defer>` tags with implicit load ordering
- All state on `window.*` globals
- Duplicate logic (e.g., `comparePlayersForAssignment` in two files)

### Feature Feasibility Matrix

| Feature | Feasibility | Effort | Risk |
|---------|-------------|--------|------|
| Multi-game support (extend GAME_CATALOG) | HIGH | Low | Low |
| New assignment algorithms | HIGH | Medium | Low |
| Interactive map (Konva.js) | MEDIUM | High | Medium |
| Timeline/phase system | MEDIUM | High | Medium |
| Substitute management | HIGH | Low | Low |
| Shareable battle plans | LOW-MEDIUM | Very High | High |
| Discord integration | LOW | High | High |

### Library Evaluation

#### Interactive Maps

| Library | Rendering | Bundle Size | DnD Support | Verdict |
|---------|-----------|-------------|-------------|---------|
| **Konva.js** | Canvas 2D | ~500KB | Native | **Best fit** |
| Fabric.js | Canvas 2D | ~300KB | Built-in | Good for image editing |
| PixiJS | WebGL | ~1MB | Manual | Overkill |
| Native Canvas | Canvas 2D | 0KB | Manual | Too verbose |

**Winner: Konva.js** — vendorable, native drag-and-drop, declarative layer model, 689K weekly npm downloads.

#### Timeline

| Library | No-Build | Verdict |
|---------|----------|---------|
| Frappe Gantt | Yes | Good but heavy for phases |
| Custom SVG | Yes | **Recommended** — maximum control, minimal complexity |

#### Real-Time Collaboration

| Approach | Latency | Complexity | Verdict |
|----------|---------|------------|---------|
| Firestore listeners (current) | ~1500ms | Low | **Keep for persistence** |
| Firebase RTDB | ~600ms | Low | Add later for presence |
| WebSockets | <100ms | High | Overkill |

---

## 4. Architecture Proposal

### Plugin Shell Architecture

```
+----------------------------------------------------------+
|                    App Shell (ESM)                        |
|  +----------+ +----------+ +------------+ +---------+    |
|  |  Router   | |  State   | |  Auth/     | |  i18n   |   |
|  |  (views)  | |  Store   | |  Session   | |  Engine |   |
|  +----------+ +----------+ +------------+ +---------+    |
+----------------------------------------------------------+
|                  Feature Modules (ESM)                    |
|  +--------------+ +--------------+ +------------------+  |
|  |  Generator    | |  Players     | |  Events Manager  |  |
|  |  (existing)   | |  Management  | |  (existing)      |  |
|  +--------------+ +--------------+ +------------------+  |
|  +--------------+ +--------------+ +------------------+  |
|  |  Battle Plan  | |  Timeline/   | |  Interactive     |  |
|  |  (NEW)        | |  Phases(NEW) | |  Map (NEW)       |  |
|  +--------------+ +--------------+ +------------------+  |
|  +--------------+ +--------------+                       |
|  |  Alliance     | |  Strategy    |                      |
|  |  (existing)   | |  Engine(NEW) |                      |
|  +--------------+ +--------------+                       |
+----------------------------------------------------------+
|                  Game Plugin Layer                        |
|  +--------------+ +--------------+ +------------------+  |
|  |  last_war     | |  game_x      | |  game_y          |  |
|  |  plugin       | |  plugin      | |  plugin          |  |
|  +--------------+ +--------------+ +------------------+  |
+----------------------------------------------------------+
|              Data Layer (Gateway Pattern)                 |
|  +------------------------------------------------------+|
|  |  Firestore (persistence) + RTDB (ephemeral collab)   ||
|  +------------------------------------------------------+|
+----------------------------------------------------------+
```

### Game Plugin Contract

```js
// js/games/last-war/plugin.mjs
export default {
  id: 'last_war',
  name: 'Last War: Survival',
  troopModel: { ... },
  playerImportSchema: { ... },
  assignmentAlgorithms: ['balanced_round_robin', 'aggressive_fill'],
  eventTemplates: [desertStorm, canyonBattlefield],
  mapRenderer: LastWarMapRenderer,
  phaseDefinitions: [
    { id: 'preparation', duration: '24h', objectives: [...] },
    { id: 'battle', duration: '2h', objectives: [...] },
  ],
  buildingTypes: [...],
};
```

### Firestore Data Model Evolution (Additive)

```
# Existing (unchanged)
users/{uid}/
  players/{playerId}
  events/{eventId}
  app_config/settings

alliances/{allianceId}/
  members/{uid}
  invitations/{inviteId}

# NEW: Battle Plans (shareable)
alliances/{allianceId}/
  battle_plans/{planId}
    metadata: { eventId, gameId, name, status, shareToken }
    assignments: { teamA: [...], teamB: [...] }
    phases/{phaseId}: { name, order, duration, objectives, playerOverrides }
    substitutes/{substituteId}: { playerId, replacesPlayerId, priority }
    comments/{commentId}: { authorUid, text, phaseId? }

# NEW: Map Overlays
alliances/{allianceId}/
  battle_plans/{planId}/
    map_state/{layerId}: { annotations, playerPositions }

# NEW: Strategy Templates (personal)
users/{uid}/
  strategy_templates/{templateId}: { gameId, eventId, phaseAssignments }
```

### Key Design Decisions

- Battle plans are alliance-scoped (enables sharing naturally)
- Phases are subcollections (supports real-time listeners per phase)
- Share tokens enable read-only link sharing (no auth required for viewing)
- Map state is separate from assignments (avoids write conflicts)
- No migration needed — all additive

### Module Communication

```
Feature Module <--> AppStateStore <--> Firebase Gateway
      |                                      |
      +-- DOM manipulation                   +-- Firestore/RTDB
```

### Trade-offs Considered

| Decision | For | Against | Verdict |
|----------|-----|---------|---------|
| Keep Vanilla JS | Zero config, instant deploy, matches CLAUDE.md | No tree-shaking, no TS safety | Correct |
| Firestore over custom backend | Already integrated, no server, scales to zero | Vendor lock-in | Correct |
| Konva.js for maps | Canvas perf, built-in DnD, vendorable | 150KB, canvas a11y is poor | Correct |
| No framework migration | No rewrite, ship features | No component model | Correct |
| Defer Firebase RTDB | Less complexity | Higher latency for collab | Correct for v1 |

---

## 5. Senior Developer Review

### Implementation Feasibility

The sr-developer's golden rule: **"Bundler first, modularize second, features always. Do not let infrastructure work block feature delivery."**

### Top 5 Risks (Ranked)

1. **`app.js` at 8,600 lines** — god file coupling everything. Must be broken up before adding major features.
2. **Load-order fragility** — 35+ defer scripts, one bad merge from production break.
3. **No staging environment** — pushes to main auto-deploy. Need preview mechanism.
4. **Solo developer bus factor** — global coupling works because one person holds the mental model.
5. **Firestore schema evolution** — no automated migration system.

### Tech Stack Recommendation

**DO:**
- Add esbuild (single highest-ROI change: ~10ms builds, enables ESM migration)
- Vendor Konva.js for interactive maps
- Keep Firestore

**DO NOT:**
- Adopt a framework (React/Vue/Svelte) — 3-6 month rewrite, zero features
- Add TypeScript — JSDoc gives 80% benefit
- Add a design system — current CSS works

### Honest Opinion

> Keep vanilla JS. The real problem isn't vanilla JS — it's `app.js`. The 8,600-line god file and global coupling are the pain points. These are solved by modularization (ES modules + bundler), not by a framework.

### Recommended Developer Approach

1. Week 1: Add esbuild, replace script tags with a bundle, add source maps
2. Week 2-3: Extract 3 biggest chunks from `app.js` into ES modules
3. Week 4: Ship one user-visible feature
4. Continue extracting `app.js` whenever touching related code
5. Never do a "stop the world" refactor

---

## 6. Event History & Player Reliability

### Firestore Data Model

```
alliances/{allianceId}/event_history/{historyId}
  Fields: eventTypeId, eventName, scheduledAt, completedAt, status, teamAssignments, notes
  Subcollection: attendance/{playerName}
    Fields: team, role, building, status, confirmedAt, markedAt, markedBy
    Status values: confirmed | attended | no_show | late_sub | excused | cancelled_event

alliances/{allianceId}/player_stats/{playerName}
  Fields: totalEvents, attended, noShows, excused, reliabilityScore (0-100),
          currentStreak, longestNoShowStreak, lastEventDate, recentHistory (last 10)
```

### Reliability Score Algorithm

Uses exponential decay — recent events weighted more heavily:

```js
function calculateReliabilityScore(history) {
    var validHistory = history.filter(function(h) {
        return h.status !== 'cancelled_event';
    });
    if (validHistory.length === 0) return null;

    var DECAY_FACTOR = 0.85;
    var totalWeight = 0;
    var attendedWeight = 0;

    for (var i = 0; i < validHistory.length; i++) {
        var weight = Math.pow(DECAY_FACTOR, i);
        totalWeight += weight;

        if (validHistory[i].status === 'attended') {
            attendedWeight += weight;
        } else if (validHistory[i].status === 'late_sub') {
            attendedWeight += weight * 0.8;
        } else if (validHistory[i].status === 'excused') {
            totalWeight -= weight; // excluded
        }
    }

    return totalWeight === 0 ? null : Math.round((attendedWeight / totalWeight) * 100);
}
```

### Reliability Tiers

| Score | Tier | Label | Color |
|-------|------|-------|-------|
| 90-100 | Excellent | Rock solid | Green (#2e7d32) |
| 70-89 | Good | Reliable | Blue (#1565c0) |
| 50-69 | Fair | Inconsistent | Orange (#ef6c00) |
| 30-49 | Poor | Unreliable | Red (#c62828) |
| 0-29 | Critical | Chronic no-show | Dark red (#b71c1c) |
| null | New | No history | Grey (#757575) |

### Assignment Algorithm Integration

Two modes (configurable per alliance):

```js
var DEFAULT_RELIABILITY_CONSTRAINTS = {
    enabled: false,
    mode: 'warn',           // 'warn' | 'enforce'
    anchorMinScore: 70,     // min score for priority-1 buildings
    benchThreshold: 30,     // below this, auto-suggest as substitute
    noShowStreakLimit: 3,
};
```

- **Warn mode** (default): assignments run normally, validation pass flags risky placements
- **Enforce mode**: players below threshold auto-moved to bench, blocked from priority-1 buildings

Registered as `reliability_aware_balanced` algorithm — existing users keep `balanced_round_robin`.

### UI Components

- **Player list**: colored reliability dots with tooltip
- **Post-generation**: collapsible warnings panel with actionable swaps
- **Event History view**: chronological event list, attendance check-in flow
- **Player detail drawer**: last 10 events, streak info, reliability badge
- **Alliance health dashboard** (Phase 3): average score, at-risk players, trends

### Attendance Check-in Flow

After an event, leader opens the event history entry:
- All assigned players shown with radio buttons: Attended / No-show / Excused / Late Sub
- Default: "Attended" (minimize clicks for common case)
- "Finalize Attendance" locks the record, triggers score recalculation
- Reminder badge for unfinalized events ("2 events pending review")

### Edge Cases

- **New alliance member**: starts fresh with null score, 5-event grace period
- **Cancelled events**: bulk-set to `cancelled_event`, excluded from scoring
- **Leader forgets**: reminder badge, 7-day staleness warning, no auto-finalization
- **Gaming the system**: audit trail (`markedBy`, `markedAt`), social trust assumed

### New Files

```
js/core/reliability.js
js/features/event-history/event-history-core.js
js/features/event-history/event-history-controller.js
js/features/event-history/event-history-view.js
js/features/event-history/event-history-actions.js
js/shared/data/firebase-event-history-gateway.js
tests/reliability.core.test.js
tests/event-history.core.test.js
```

---

## 7. Player Self-Update via Magic Links

### Overview

Allow non-platform players to update their own data (Power, THP, Troop Type) via a shareable link, using Firebase Anonymous Auth + scoped tokens.

### Flow

1. Leader selects players, clicks "Request Updates" -> generates per-player tokens
2. Links shared via Discord/WhatsApp: `player-update.html?token=abc&aid=xyz&lang=en`
3. Player opens link -> Firebase Anonymous Auth -> sees pre-filled form -> submits
4. Update lands in pending queue -> leader reviews side-by-side (old vs new) -> approves/rejects
5. Optional auto-approve with delta thresholds

### Firestore Data Model

```
alliances/{allianceId}/update_tokens/{tokenId}
  Fields: token (32-char hex), allianceId, playerName, gameId,
          createdBy, createdAt, expiresAt (48h default),
          used (boolean), usedAt, usedByAnonUid,
          currentSnapshot: { power, thp, troops },
          linkedEventId (optional)

alliances/{allianceId}/pending_updates/{updateId}
  Fields: tokenId, playerName, gameId,
          submittedAt, submittedByAnonUid,
          previousValues: { power, thp, troops },
          proposedValues: { power, thp, troops },
          status: pending | approved | rejected,
          reviewedBy, reviewedAt, linkedEventId
```

### Security Rules

```javascript
match /alliances/{allianceId}/update_tokens/{tokenId} {
  allow create: if isAllianceMember(allianceId);
  allow read: if isAllianceMember(allianceId)
              || (request.auth != null
                  && request.auth.token.firebase.sign_in_provider == 'anonymous'
                  && resource.data.used == false
                  && resource.data.expiresAt > request.time);
}

match /alliances/{allianceId}/pending_updates/{updateId} {
  allow create: if request.auth != null
                && request.auth.token.firebase.sign_in_provider == 'anonymous'
                && isValidPendingUpdateCreate(allianceId);
  allow read, update: if isAllianceMember(allianceId);
}
```

Validation in rules enforces: Power 0-9999, THP 0-99999, Troop Type in [Tank, Aero, Missile].

### Standalone Page: player-update.html

- Loads only: Firebase SDK (app + auth + firestore), config, translations, one JS file
- Mobile-first centered card with dark theme
- States: Loading -> Form (pre-filled) -> Success / Error
- Error states: TOKEN_EXPIRED, TOKEN_USED, TOKEN_INVALID, NETWORK_ERROR
- All strings use `data-i18n` attributes

### Token Management

- 32-char hex via `crypto.getRandomValues` (128 bits)
- Bulk generation in Firestore batch write
- Single-use, time-limited (48h default), revocable
- Client-side cleanup of expired tokens (opportunistic)

### Leader-Side UI

- "Request Updates" button in Players Management with multi-select
- Modal: expiry selector, optional event link, generate + bulk copy
- Formatted clipboard output for Discord/WhatsApp
- Pending updates badge in nav
- Review panel: side-by-side comparison, delta warnings, approve/reject
- Auto-approve option with configurable thresholds

### Integration with Reliability

- **Data freshness indicator**: green/yellow/red dot based on `lastUpdated`
- **Pre-event flow**: "Request Updates for This Event" links tokens to upcoming events
- **Composite reliability score**: attendance rate + data freshness + response rate

### Edge Cases

- **Absurd values**: client validation + Firestore rules + leader review (3 layers)
- **Link shared with wrong person**: single-use, time-limited, leader reviews all updates
- **CSP**: Anonymous auth doesn't use popup/redirect, Konva.js doesn't need `unsafe-eval`
- **Rate limiting**: token-gated writes, Firebase anonymous auth quotas (100/min)
- **Anonymous user cleanup**: Firebase auto-deletes after 30 days inactivity
- **Multiple submissions**: review panel groups by tokenId, leader rejects duplicates

### New Files

```
player-update.html
player-update.css
js/player-update/player-update.js
js/features/player-updates/player-updates-core.js
js/features/player-updates/player-updates-actions.js
js/features/player-updates/player-updates-view.js
js/features/player-updates/player-updates-controller.js
js/shared/data/firebase-player-updates-gateway.js
```

---

## 8. Unified Implementation Roadmap

### Phase 0: Foundation (2 weeks)
- Consider adding esbuild bundler (optional, highest-ROI DX improvement)
- Begin extracting `app.js` chunks into ES modules
- Add `npm run build` and `npm run dev` to CI

### Phase 1: Event History + Self-Update MVPs (3 weeks)

**Can be developed in parallel — no code dependencies.**

**Event History MVP:**
- Firestore model: event_history + attendance subcollection + player_stats
- Attendance check-in flow (create record from assignments, mark attendance, finalize)
- Reliability score calculation
- Player list reliability dots
- New files: reliability.js, event-history-*.js, firebase-event-history-gateway.js
- Tests: reliability.core.test.js, event-history.core.test.js

**Player Self-Update MVP:**
- Firestore model: update_tokens + pending_updates
- Security rules for anonymous auth + token validation
- player-update.html standalone page
- Token generation UI in Players Management
- Pending updates review panel (approve/reject)
- New files: player-update.html, player-update.css, player-update.js, player-updates-*.js

**Modified files (both features):**
- index.html (script tags, modal templates, badges)
- translations.js (~60-80 new i18n keys)
- styles.css (reliability dots, review panel, badges, modals)
- app.js (wiring, listeners)
- data-gateway-contract.js (new domains)

### Phase 2: Integration & Multi-Game (4-5 weeks)
- Reliability-weighted assignment algorithm (`reliability_aware_balanced`)
- Warnings panel in generator view
- Data freshness dots (from self-update `lastUpdated`)
- Auto-approve option for self-updates
- Event-linked update requests
- Extend `GAME_CATALOG` with plugin contract
- Add second game to prove the pattern
- Token management panel (revoke, regenerate)

### Phase 3: Battle Plans & Interactive Maps (4-6 weeks)
- Battle plan model + view (alliance-scoped)
- Substitute management (bench slots, auto-promote)
- Share links (read-only via share token)
- Vendor Konva.js for interactive map canvas
- Drag-and-drop player placement
- Map annotations

### Phase 4: Timeline/Phase System (4-6 weeks)
- Phase model per battle plan
- SVG timeline component
- Per-phase assignment overrides
- Phase-aware strategy engine

### Phase 5: Dashboard & Analytics (3-4 weeks)
- Alliance health dashboard (avg score, at-risk players, trends)
- Composite reliability score (attendance + freshness + response rate)
- Player profile cards with history timeline
- Sparkline charts

### Phase 6: Collaboration (6-8 weeks, if demand exists)
- Real-time plan co-editing via Firestore listeners
- Firebase RTDB for presence (only if latency is an issue)
- Live event coordination

---

## Sources

- [Last War Handbook — Desert Storm Guide](https://lastwarhandbook.com/guides/desert-storm-battlefield-guide)
- [Last War Tutorial — Desert Storm](https://www.lastwartutorial.com/desert-storm/)
- [ROKBoard](https://rokboard.com/)
- [RoKHub](https://rokhub.xyz/)
- [ClashKing Bot (GitHub)](https://github.com/ClashKingInc/ClashKingBot)
- [Clash Royale Manager (GitHub)](https://github.com/chradajan/ClashRoyaleManager)
- [Whiteout Survival Wiki — Alliance Championship](https://www.whiteoutsurvival.wiki/events/alliance-championship/)
- [Konva.js vs Fabric.js](https://medium.com/@www.blog4j.com/konva-js-vs-fabric-js-in-depth-technical-comparison-and-use-case-analysis-9c247968dd0f)
- [npm trends: fabric vs konva vs pixi](https://npmtrends.com/fabric-vs-konva-vs-pixi.js-vs-react-konva)
- [Firebase Firestore vs RTDB](https://firebase.google.com/docs/database/rtdb-vs-firestore)
- [Frappe Gantt](https://frappe.io/gantt)
- [Konva.js Drag and Drop](https://konvajs.org/docs/drag_and_drop/Drag_and_Drop.html)
