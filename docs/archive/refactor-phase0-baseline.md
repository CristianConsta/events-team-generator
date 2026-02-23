# JS Refactor Phase 0 Baseline

Date: 2026-02-16

## Objective
Create a safety net before modularizing monolithic JavaScript files:
- Capture baseline footprint and critical workflows.
- Add guardrail tests that must remain green throughout refactor phases.
- Use this checklist for manual regression verification before and after each major refactor PR.

## Monolith Footprint Snapshot

| File | Lines | Bytes |
| --- | ---: | ---: |
| `app.js` | 6413 | 242654 |
| `firebase-module.js` | 3462 | 572085 |
| `translations.js` | 2124 | 146570 |
| `styles.css` | 3173 | 82711 |
| `index.html` | 904 | 73119 |

## Automated Guardrails

Run on every refactor increment:

```bash
npm test
```

Phase 0 adds guardrails for:
- Critical Firebase manager/service API surface used by main flows.
- Translation completeness for core UX strings (including generator algorithm selector) across all supported languages.

## Manual No-Regression Checklist

### Auth and Session
- Login screen renders and supports email/password and Google login.
- Successful login shows main app and user profile identity in header.
- Sign out returns to login screen cleanly.

### Generator
- Event selector renders and switching events updates generator state.
- Player filtering/sorting works.
- Team A/Team B selection works and counters update.
- Algorithm radio selector works:
  - `Balanced (Recommended)` is default.
  - `Aggressive` can be selected and affects assignment behavior.
- Generate and download modal opens for Team A/Team B.
- Map and Excel download buttons are functional.

### Players Management
- Upload player data flow works.
- Add player works and row appears once.
- Edit player works (including renaming) without duplicate stale rows.
- Delete player removes row immediately and does not reappear after refresh.
- Personal/alliance source switching updates data view correctly.

### Events Manager
- Create/edit/delete event works (except protected default events).
- Building rows can be added/edited/removed and saved.
- Building type toggle (Building/Team) persists correctly.
- Coordinates picker opens and saves positions.

### Alliance and Notifications
- Alliance page loads and membership state renders.
- Invite send/accept/reject/revoke flows still work.
- Notification badge/panel state updates and links users to alliance actions.

### Navigation and Accessibility
- Navigation menu and mobile bottom nav route correctly.
- Modal open/close behavior remains consistent (Escape and focus behavior).
- Core controls remain keyboard reachable.

## Phase 0 Exit Criteria

- `npm test` is green.
- Phase 0 guardrail tests are in place.
- Manual checklist completed at least once against current `main`.
