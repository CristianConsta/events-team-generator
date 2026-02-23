# Multi-Game Phase 13: Super-Admin Game Metadata Management

Date: 2026-02-18  
Plan reference: `docs/architecture/multigame-implementation-plan.md` (Phase 13)

## Objective

Provide a platform-level game metadata admin capability restricted to the super-admin user (`2z2BdO8aVsUovqQWWL9WCRMdV933`) so only that user can edit global game metadata (name, logo, company, attributes JSON).

## Implemented

1. Added super-admin-only menu entry and modal in `index.html`:
- `#navGameMetadataBtn` in the header menu (hidden by default)
- `#gameMetadataOverlay` modal with fields for:
  - game selection
  - name
  - logo
  - company
  - attributes JSON

2. Added game metadata admin data APIs in `firebase-module.js`:
- `isGameMetadataSuperAdmin(userOrUid)`
- `listGameMetadata()`
- `getGameMetadata(gameId)`
- `setGameMetadata(gameId, payload)`
- server-side guard in `setGameMetadata` blocks non-super-admin updates.

3. Exposed metadata admin APIs through `js/services/firebase-service.js`:
- added delegation/fallback support for metadata methods
- added `isGameMetadataSuperAdmin(userOrUid)` wrapper for consistent permission checks in UI.

4. Wired metadata admin UX flow in `app.js`:
- super-admin visibility gating for `#navGameMetadataBtn`
- modal open/close/overlay click handling
- metadata list loading and per-game form loading
- JSON object validation for attributes payload
- save action with translated status handling and post-save UI refresh.

5. Added/updated localization keys in `translations.js`:
- metadata admin labels, validation, forbidden-access, save/load status.

6. Added service coverage in `tests/firebase-service.extended.test.js`:
- fallback behavior for `isGameMetadataSuperAdmin`
- fallback behavior for `listGameMetadata`
- delegation assertions for `list/get/set` metadata and `isGameMetadataSuperAdmin`.

## Validation

1. Unit/integration:
- `npm test`

2. E2E smoke:
- `npm run test:e2e:smoke`

## Exit Criteria

- Only super-admin can edit game-level metadata: complete.
- Dedicated metadata admin menu/overlay exists and is wired: complete.
- Metadata service surface is test-covered: complete.
