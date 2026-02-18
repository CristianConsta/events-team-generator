# Multi-Game Phase 8: Post-Auth Game Selector UX

Date: 2026-02-18  
Plan reference: `docs/architecture/multigame-implementation-plan.md` (Phase 8)

## Objective

Expose game selection and game switching UX after authentication.

## Implemented

1. Added selector UX entrypoints in `index.html`:
- navigation action: `#navSwitchGameBtn`
- selector overlay: `#gameSelectorOverlay`

2. Added selector runtime wiring in `app.js`:
- game list resolution and selector option rendering
- open/close/confirm handlers for selector overlay
- switch flow applies `setActiveGame(...)` and refreshes scoped runtime data
- switch flow resets transient generator planning state (selected players, generated assignments, search/filter state)
- post-auth selector hook exported on `window.showPostAuthGameSelector()`
- post-auth selector session reset hook exported on `window.resetPostAuthGameSelectorState()`

3. Integrated post-auth trigger in `js/app-init.js`:
- on sign-in: invoke `showPostAuthGameSelector()` when available
- on sign-out: invoke `resetPostAuthGameSelectorState()` when available

4. Added translation keys for selector UX in `translations.js`:
- `game_switch_button`
- `game_selector_help`
- `game_selector_label`
- `game_selector_confirm`
- `game_selector_no_games`
- `game_selector_invalid`

5. Added test coverage:
- `tests/app-init.extended.test.js`:
  - verifies post-auth selector hook is called on sign-in
  - verifies selector reset hook is called on sign-out
- `e2e/05-game-selector.e2e.js`:
  - login -> post-auth selector -> active badge update
  - manual game switch clears transient generator state

## Validation

1. Unit/integration:
- `npm test`

2. E2E smoke:
- `npm run test:e2e:smoke`

## Exit Criteria

- Post-auth selector flow is implemented and wired: complete.
- Manual switch action refreshes scoped context and resets transient generator state: complete.
- Phase 8 smoke gates pass: complete.
