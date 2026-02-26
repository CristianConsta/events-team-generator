# Approved Data Model — Database Migration

## Final Structure (Updated 2026-02-24 — reflects implementation)

```
users/{uid}
  └── (auth markers only — migrationVersion, lastActiveGameId)

games/{gameId}
  ├── id, name, logo, company, metadata              # game catalog (super-admin)
  │
  ├── user_state/{uid}                               # per-user per-game state
  │     ├── userProfile: { displayName, nickname, avatarDataUrl }
  │     ├── playerSource: 'personal' | 'alliance'
  │     ├── allianceId: string | null
  │     ├── allianceName: string | null
  │     ├── lastActiveTimestamp, profileName, ...
  │
  ├── soloplayers/{uid}/                              # personal player DB + tokens
  │     ├── players/{playerDocId}
  │     │     ├── name, power, troops, thp, lastUpdated
  │     │
  │     ├── update_tokens/{tokenId}
  │     │     ├── contextType, ownerUid, playerName, gameId,
  │     │     ├── expiresAt, used, usedAt, createdBy, createdAt
  │     │
  │     └── pending_updates/{updateId}
  │           ├── tokenId, playerName, gameId, status,
  │           ├── proposedValues, reviewedBy, reviewedAt, appliedTo
  │
  ├── events/{eventId}                                # game-level events + media
  │     ├── name, buildingConfig, buildingPositions, ...
  │     ├── logoDataUrl, mapDataUrl                   # media merged onto event doc
  │
  ├── event_history/{historyId}                        # shared collection (solo + alliance)
  │     ├── eventName, eventTypeId, team, players[],
  │     │   gameId, createdByUid, createdAt,
  │     │   active, finalized, finalizedAt
  │     │   # 10-entry limit per eventTypeId (oldest soft-deleted via active=false)
  │     │   # Alliance members share records; solo players write here directly
  │     │
  │     └── player_stats/{playerDocId}
  │           ├── playerName, team, status (attended|no_show|excused),
  │           │   markedBy, markedAt
  │
  └── alliances/{allianceId}/
        ├── gameId, name, createdBy, members, metadata
        │
        ├── alliance_players/{playerDocId}
        │     ├── name, power, troops, thp, lastUpdated
        │
        ├── update_tokens/{tokenId}
        │     ├── contextType, allianceId, playerName, gameId,
        │     ├── expiresAt, used, usedAt, createdBy, createdAt
        │
        ├── pending_updates/{updateId}
        │     ├── tokenId, playerName, gameId, status,
        │     ├── proposedValues, reviewedBy, reviewedAt, appliedTo
        │
        └── invitations/{invitationId}
              ├── gameId, allianceId, allianceName,
              ├── invitedEmail, invitedBy, inviterEmail, inviterName,
              ├── status, createdAt, lastSentAt, respondedAt, revokedAt
```

## Legacy Paths (read-only after migration, eventually removed)

```
alliances/{allianceId}/                               # Root alliance docs (migrated to game-scoped)
  ├── event_history/{historyId}                       # → games/{gameId}/event_history/
  ├── player_stats/{docId}                            # → games/{gameId}/event_history/{id}/player_stats/
  ├── update_tokens/{tokenId}                         # → games/{gameId}/alliances/{id}/update_tokens/
  └── pending_updates/{updateId}                      # → games/{gameId}/alliances/{id}/pending_updates/

invitations/{invitationId}                            # → games/{gameId}/alliances/{allianceId}/invitations/

users/{uid}/
  ├── games/{gameId}/
  │     ├── players/{playerId}                        # → games/{gameId}/soloplayers/{uid}/players/
  │     ├── events/{eventId}                          # → games/{gameId}/events/
  │     └── event_media/{eventId}                     # → merged into games/{gameId}/events/{eventId}
  ├── update_tokens/{tokenId}                         # → games/{gameId}/soloplayers/{uid}/update_tokens/
  └── pending_updates/{updateId}                      # → games/{gameId}/soloplayers/{uid}/pending_updates/
```

## Migration Mapping (Old → New)

| Data | Old Path | New Path |
|------|----------|----------|
| User auth markers | `users/{uid}` | `users/{uid}` (stays, cleaned up) |
| User state/profile | `users/{uid}/games/{gameId}` (fields) | `games/{gameId}/user_state/{uid}` |
| Player source | `users/{uid}/games/{gameId}.playerSource` | `games/{gameId}/user_state/{uid}.playerSource` |
| Alliance association | `users/{uid}/games/{gameId}.allianceId` | `games/{gameId}/user_state/{uid}.allianceId` |
| Personal players | `users/{uid}/games/{gameId}/players/{docId}` | `games/{gameId}/soloplayers/{uid}/players/{docId}` |
| Personal events | `users/{uid}/games/{gameId}/events/{eventId}` | `games/{gameId}/events/{eventId}` |
| Event media | `users/{uid}/games/{gameId}/event_media/{id}` | `games/{gameId}/events/{eventId}.logoDataUrl/mapDataUrl` (merged onto event doc) |
| Personal update tokens | `users/{uid}/update_tokens/{tokenId}` | `games/{gameId}/soloplayers/{uid}/update_tokens/{tokenId}` |
| Personal pending updates | `users/{uid}/pending_updates/{updateId}` | `games/{gameId}/soloplayers/{uid}/pending_updates/{updateId}` |
| Root alliance doc | `alliances/{allianceId}` (root) | `games/{gameId}/alliances/{allianceId}` (game-scoped) |
| Alliance player DB | `games/{gameId}/alliances/{id}.playerDatabase` (map) | `games/{gameId}/alliances/{id}/alliance_players/{docId}` (subcollection) |
| Alliance update tokens | `alliances/{id}/update_tokens/{tokenId}` | `games/{gameId}/alliances/{id}/update_tokens/{tokenId}` |
| Alliance pending updates | `alliances/{id}/pending_updates/{updateId}` | `games/{gameId}/alliances/{id}/pending_updates/{updateId}` |
| Invitations | `invitations/{invitationId}` (root) + `games/{gameId}/invitations/{id}` | `games/{gameId}/alliances/{allianceId}/invitations/{id}` |
| Event history | `alliances/{id}/event_history/{historyId}` | `games/{gameId}/event_history/{historyId}` |
| Attendance | `alliances/{id}/event_history/{id}/attendance/{id}` | `games/{gameId}/event_history/{id}/player_stats/{id}` (renamed) |
| Player stats | `alliances/{id}/player_stats/{docId}` | `games/{gameId}/event_history/{id}/player_stats/{docId}` |
| Building positions | `app_config/default_event_positions` | embedded in `games/{gameId}/events/{eventId}.buildingPositions` |
| Building config | `app_config/default_event_building_config` | embedded in `games/{gameId}/events/{eventId}.buildingConfig` |
| Game metadata overrides | `app_config/game_metadata_overrides` | eliminated (redundant with `games/{gameId}` doc) |

## Migration Script Steps

| Step | Description | Scope |
|------|-------------|-------|
| A | User game state → `games/{gameId}/user_state/{uid}` | Per-user |
| B | Personal players → `games/{gameId}/soloplayers/{uid}/players/` | Per-user |
| C | Personal events → `games/{gameId}/events/` | Per-user |
| C2 | Event media → merged onto `games/{gameId}/events/{eventId}` | Per-user |
| D | Alliance `playerDatabase` map → `alliance_players/` subcollection | Global |
| E | Alliance event history → `games/{gameId}/event_history/` | Global |
| F | Alliance tokens/pending → game-scoped alliance subcollections | Global |
| G | Personal tokens/pending → game-scoped soloplayer subcollections | Per-user |
| H | Write migration marker (`migrationVersion=2`) | Per-user |
| I | Root `alliances/{id}` docs → `games/{gameId}/alliances/{id}` (if not already populated) | Global |
| J | Root `invitations/{id}` → `games/{gameId}/alliances/{allianceId}/invitations/{id}` | Global |

## Key Implementation Decisions

1. **`user_state/{uid}`** subcollection used instead of `{uid}/` directly under gameId — clearer semantics, avoids collision with other subcollections
2. **Event media** merged as fields (`logoDataUrl`, `mapDataUrl`) onto `events/{eventId}` docs — no separate subcollection needed
3. **`attendance/`** renamed to **`player_stats/`** under `event_history/{historyId}/`
4. **Alliance players** migrated from embedded `playerDatabase` map to `alliance_players/{docId}` subcollection
5. **Dual-read/write** during migration: new path tried first, fallback to old path; writes go to both
6. **Event history** is a single shared collection under `games/{gameId}/event_history/` for both solo and alliance users. Alliance path (`alliances/{id}/event_history/`) is legacy dual-write only. 10-entry limit per `eventTypeId` enforced via soft-delete (`active: false`). Attendance uses 3 statuses: `attended`, `no_show`, `excused`.
6. **`default_event_positions/` and `default_event_building_config/`** subcollections removed — data embedded in event doc fields
7. **Invitations** moved under `games/{gameId}/alliances/{allianceId}/invitations/` — queried via `collectionGroup('invitations')` for cross-alliance lookups
8. **Root `alliances/` collection** eliminated — all alliance data lives under `games/{gameId}/alliances/{allianceId}/`

## Scope Priority
1. Generator page + Players management page (first)
2. Then remaining features
