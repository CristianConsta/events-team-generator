# Multigame Migration Runbook

## Scope
- Migrate legacy root user payload into first-class game scope:
  - `users/{uid}/games/{gameId}`
  - `users/{uid}/games/{gameId}/players/*`
  - `users/{uid}/games/{gameId}/events/*`
  - `users/{uid}/games/{gameId}/event_media/*`
- Migrate legacy shared alliance data:
  - `alliances/*` -> `games/{gameId}/alliances/*`
  - `invitations/*` -> `games/{gameId}/invitations/*`

## Script
- File: `scripts/migrate_multigame_first_class.js`
- Default mode: dry-run
- Writes only when `--apply` is provided

## Prerequisites
- Service account JSON with Firestore admin access.
- Updated Firestore rules deployed from `firestore.rules`.
- Backup/snapshot of current production Firestore.
- Java runtime installed locally when running `npm run test:rules` with Firebase emulators.

## Dry-run
```powershell
node scripts/migrate_multigame_first_class.js `
  --service-account C:\path\service-account.json `
  --project-id your-project-id `
  --default-game-id last_war `
  --report docs/architecture/migration-report-preprod.json
```

## Apply
```powershell
node scripts/migrate_multigame_first_class.js `
  --service-account C:\path\service-account.json `
  --project-id your-project-id `
  --default-game-id last_war `
  --apply `
  --report docs/architecture/migration-report-prod.json
```

## Idempotency
- Script uses merge writes; re-running is safe.
- No destructive deletes are executed.
- Migration markers are updated in both:
  - game doc metadata (`migrationVersion: 2`)
  - user root doc (`multigameMigration.version: 2`)

## Validation
- Confirm user/game root docs exist under `users/{uid}/games/{gameId}`.
- Confirm players/events/event_media subcollections are populated.
- Confirm alliances/invitations exist under `games/{gameId}/...`.
- Enable strict mode in pre-prod and verify no fallback reads are needed.

## Rollback Notes
- Keep migration data in place (non-destructive).
- Disable strict mode (`MULTIGAME_STRICT_MODE=false`) if read paths fail.
- Re-deploy previous `firestore.rules` only if emergency access restoration is required.
