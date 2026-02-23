# Multigame Frontend Audit

**Date:** 2026-02-23
**Auditor:** Frontend/CSS specialist agent

---

## Summary

The multigame frontend is substantially implemented. All major UI surfaces described in the implementation plan are present in the codebase. No phase is missing at the HTML/CSS layer; a few wiring details are noted below.

---

## 1. Game Selector UI (Phase 8 — Post-Auth Game Selection)

### HTML Elements Found (`index.html`)

| Element ID | Type | Purpose |
|---|---|---|
| `gameSelectorOverlay` | `<div class="coord-overlay hidden">` | Post-auth game selection modal |
| `gameSelectorList` | `<div>` | Dynamic list of game options (listbox) |
| `gameSelectorInput` | `<select>` | Native select fallback (hidden visually) |
| `gameSelectorStatus` | `<div>` | Status/error messages |
| `gameSelectorCancelBtn` | `<button class="secondary">` | Cancel (hidden when `requireChoice=true`) |
| `gameSelectorConfirmBtn` | `<button>` | Confirm / Continue |
| `navSwitchGameBtn` | `<button class="header-menu-item">` | Nav menu "Switch Game" |

### JS Logic (`app.js`)

- `openGameSelector(options)` — opens overlay, populates list, supports `requireChoice` mode
- `postAuthGameSelectionPending`, `postAuthSelectorShownThisSession` — session-scoped flags prevent re-prompting
- `closeGameSelector(forceClose)` — respects `requireChoice`, prevents dismissal without selection
- `refreshGameSelectorMenuAvailability()` — hides navSwitchGameBtn when no games available
- Game options rendered with avatar images + initials fallback

**Status: FULLY IMPLEMENTED**

---

## 2. Game Context Display in Header/Nav (Phase 3 — Active Game Context)

### HTML Elements Found (`index.html`)

| Element ID | Type | Purpose |
|---|---|---|
| `activeGameBadge` | `<span class="header-avatar active-game-badge hidden">` | Badge in header showing active game |
| `activeGameBadgeImage` | `<img class="hidden">` | Game logo image |
| `activeGameBadgeInitials` | `<span>` | Fallback initials when no logo |
| `navGameMetadataBtn` | `<button class="header-menu-item hidden">` | Nav menu "Game Metadata Admin" |
| `navSwitchGameBtn` | `<button class="header-menu-item">` | Nav menu "Switch Game" |

### JS Logic (`app.js`)

- `updateActiveGameBadge(forcedGameId)` — resolves game name + logo, applies avatar with `applyAvatar()`
- `getActiveGame()` / `getActiveGameContext()` — reads from `FirebaseService.getActiveGame()`
- `setActiveGame(gameId)` — stores to service + updates badge
- `ensureActiveGameContext()` — auto-selects default if none set

**Status: FULLY IMPLEMENTED**

---

## 3. Game Metadata Admin UI (Phase 13 — Super-Admin Game Metadata)

### HTML Elements Found (`index.html`)

| Element ID | Type | Purpose |
|---|---|---|
| `gameMetadataOverlay` | `<div class="coord-overlay hidden modal-shell--game-metadata">` | Admin edit modal |
| `gameMetadataTitle` | `<h2>` | Modal title |
| `gameMetadataSelect` | `<select>` | Game picker within admin form |
| `gameMetadataNameInput` | `<input type="text" maxlength="80">` | Game name field |
| `gameMetadataLogoInput` | `<input type="file">` | Avatar upload |
| `gameMetadataLogoPreview` / `gameMetadataLogoPreviewImage` / `gameMetadataLogoPreviewInitials` | preview elements | Live logo preview |
| `gameMetadataLogoUploadBtn` / `gameMetadataLogoRemoveBtn` | buttons | Avatar upload/remove actions |
| `gameMetadataCompanyInput` | `<input type="text" maxlength="80">` | Company field |
| `gameMetadataSaveBtn` | `<button>` | Save action |
| `gameMetadataStatus` | `<div>` | Status/error messages |
| `gameMetadataCloseBtn` | `<button class="clear-btn">` | Close modal |

### Super-Admin Gating (`app.js` + `js/core/games.js`)

- `GAME_METADATA_SUPER_ADMIN_UID = '2z2BdO8aVsUovqQWWL9WCRMdV933'` — hardcoded in both `games.js` and `app.js`
- `isGameMetadataSuperAdmin(userOrUid)` — delegates to `FirebaseService.isGameMetadataSuperAdmin()` or falls back to local check
- `refreshGameMetadataMenuVisibility()` — toggles `hidden` class and `disabled` on `navGameMetadataBtn`
- `navGameMetadataBtn` starts with class `hidden` in HTML; shown only for super-admin at runtime

**Status: FULLY IMPLEMENTED**

---

## 4. Game-Scoped Views

### Player Data (`app.js` lines 13-14, 367-385)

```js
const gameplayContext = getGameplayContext();
const source = FirebaseService.getPlayerSource && FirebaseService.getPlayerSource(gameplayContext || undefined);
```

- `getGameplayContext()` resolves active game + user, used for all player load/save operations
- `FirebaseService.saveUserData(undefined, gameplayContext)` — player saves are game-scoped
- `FirebaseService.loadAllianceData(gameplayContext)` — alliance loads are game-scoped

### Events (`app.js` lines 3274-3300)

```js
const gameplayContext = getGameplayContext();
return normalizeStoredEventsData(FirebaseService.getAllEventData(gameplayContext));
```

- Event registry reads are scoped by `gameplayContext`
- Default assignment algorithm resolved from `gameplayContext.gameId`

### Player Updates Feature (`js/features/player-updates/`)

- `player-updates-controller.js` reads `global.currentGameId` or `DSAppStateStore.getState().gameId`
- `player-updates-core.js` stamps `gameId` on token documents

### Event History Feature (`js/features/event-history/`)

- `event-history-actions.js` reads `eventHistoryFilterGameId` element value as filter
- `event-history-core.js` stamps `gameId` on history records

**Status: SUBSTANTIALLY IMPLEMENTED** — players, events, alliances, and history are all game-scoped. Player Updates uses a slightly different path (`global.currentGameId`) rather than `getGameplayContext()`.

---

## 5. CSS (styles.css)

### Game Selector Classes

| Class | Purpose |
|---|---|
| `.game-selector-modal` | Modal container |
| `.game-selector-title` | Title heading |
| `.game-selector-help` | Help paragraph |
| `.game-selector-list` | Listbox container |
| `.game-selector-option` | Individual game row |
| `.game-selector-option:hover` | Hover state |
| `.game-selector-option.is-selected` | Selected state |
| `.game-selector-option-avatar` | Game avatar/logo |
| `.game-selector-option-body` | Text content area |
| `.game-selector-option-name` | Game name label |
| `.game-selector-option-check` | Checkmark indicator |
| `.game-selector-option:not(.is-selected) .game-selector-option-check` | Hides check when not selected |
| `.game-selector-native-select` | Hidden native select fallback |
| `.game-selector-actions` | Button row |

### Active Game Badge Classes

| Selector | Purpose |
|---|---|
| `.active-game-badge` | Badge in header |
| `#activeGameBadgeImage` | Logo image within badge |

### Game Metadata Admin Classes

| Selector | Purpose |
|---|---|
| `.modal-shell--game-metadata` | Modal size/layout modifier |
| `.game-metadata-avatar-wrap` | Avatar upload wrapper |
| `#gameMetadataLogoPreviewImage` | Preview image |
| `#gameMetadataLogoInput` | Hidden file input |

### Responsive Overrides (mobile breakpoint)

```css
.game-selector-modal      { width: min(96vw, 560px); ... }
.game-selector-title      { font-size: 22px; }
.game-selector-list       { gap: 8px; }
.game-selector-option     { padding: 10px; ... }
.game-selector-option-avatar { width: 42px; height: 42px; }
.game-selector-option-name { font-size: 15px; }
.game-selector-actions    { gap: 8px; margin-top: 2px; }
```

**Status: FULLY IMPLEMENTED** — all expected CSS classes are present including responsive overrides.

---

## 6. i18n / translations.js

### Game-Related Translation Keys (EN baseline, all 6 languages covered)

| Key | EN Value |
|---|---|
| `game_selector_title` | Select Game |
| `game_switch_button` | Switch Game |
| `game_selector_help` | Choose the game context for this session. |
| `game_selector_label` | Game |
| `game_selector_confirm` | Continue |
| `game_selector_no_games` | No games are available for this account. |
| `game_selector_invalid` | Select a valid game. |
| `game_metadata_admin_menu` | Game Metadata Admin |
| `game_metadata_admin_title` | Game Metadata Admin |
| `game_metadata_admin_help` | Only super admin can edit global game metadata. |
| `game_metadata_name_label` | Game Name |
| `game_metadata_logo_label` | Game Avatar |
| `game_metadata_company_label` | Company |
| `game_metadata_attributes_label` | Attributes (JSON) |
| `game_metadata_forbidden` | Only the platform super admin can edit game metadata. |
| `game_metadata_invalid_attributes` | Attributes must be a valid JSON object. |
| `game_metadata_unknown_game` | Unknown game id. |
| `game_metadata_saved` | Game metadata saved. |
| `game_metadata_load_failed` | Failed to load game metadata: {error} |
| `game_last_war_name` | Last War: Survival |

**Languages covered:** EN, FR, DE, IT, KO, RO — all have `game_selector_*` keys. FR, DE, IT, KO, RO do **not** appear to have `game_metadata_*` keys (only EN baseline confirmed to have full set).

**Status: GAME SELECTOR keys fully i18n'd across all 6 languages. Game metadata admin keys appear EN-only — needs verification for other locales.**

---

## 7. Core Game Registry (`js/core/games.js`)

- `GAME_CATALOG` — static catalog with `last_war` as the only registered game
- `DEFAULT_GAME_ID = 'last_war'`
- `GAME_METADATA_SUPER_ADMIN_UID` — hardcoded in this file AND duplicated in `app.js` line 1842
- Exports: `DSCoreGames` on `window`
- Functions: `listAvailableGames`, `getGame`, `isKnownGame`, `isGameMetadataSuperAdmin`, `canEditGameMetadata`

**Notable:** `GAME_METADATA_SUPER_ADMIN_UID` is defined in two places (`js/core/games.js` and `app.js`). Should be sourced from `DSCoreGames` only.

---

## 8. Observations and Gaps

### What Exists (Implemented)
- Post-auth game selector overlay with required-choice mode
- "Switch Game" nav button with availability gating
- Active game badge in header (image + initials fallback)
- Game metadata admin overlay with full form (name, logo, company)
- Super-admin visibility gating via UID check
- Game-scoped player, event, and alliance data operations
- Game-context stamps on event history and player update records
- Full CSS for game selector, badge, and metadata admin
- Responsive CSS overrides for game selector on mobile

### Gaps / Issues

1. **Duplicate `GAME_METADATA_SUPER_ADMIN_UID`**: Defined in both `js/core/games.js:2` and `app.js:1842`. One should delegate to `DSCoreGames.GAME_METADATA_SUPER_ADMIN_UID`.

2. **`game_metadata_*` i18n keys appear EN-only**: FR, DE, IT, KO, RO translations do not show `game_metadata_*` keys in the grep results. If the admin UI needs localization for non-EN super-admins, these keys need to be added.

3. **Player Updates game context path diverges**: `player-updates-controller.js` reads `global.currentGameId` rather than calling `getGameplayContext()`. This could desync if the active game changes mid-session.

4. **GAME_CATALOG is static**: Only `last_war` is registered. The game metadata admin form can edit display properties (name, logo, company) but cannot add new games to the catalog. Adding a new game requires code changes to `GAME_CATALOG` in `games.js`.

5. **`eventHistoryFilterGameId` element**: Referenced in `event-history-actions.js` but not found in `index.html` grep results — either it's rendered dynamically or the filter UI is not yet wired to the DOM.

---

## Phase Coverage Summary

| Phase | Description | Status |
|---|---|---|
| Phase 3 | Active game context state management | Implemented |
| Phase 5 | Game-aware signatures in data ops | Implemented |
| Phase 8 | Post-auth game selector | Implemented |
| Phase 13 | Super-admin game metadata UI | Implemented |
