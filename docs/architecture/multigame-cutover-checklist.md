# Multigame Cutover Checklist

## Pre-prod
1. Deploy Firestore rules from `firestore.rules`.
2. Run `npm run test:unit`.
3. Run `npm run test:rules`.
4. Run `npm run test:e2e`.
5. Run `npm run test:e2e:real` with real Firebase credentials.
6. Execute migration dry-run and review report JSON.
7. Execute migration apply on pre-prod.
8. Enable `MULTIGAME_STRICT_MODE=true` in pre-prod.
9. Validate:
   - login -> game selection -> player/event/alliance/invitation data load
   - player source switching persists without warnings
   - no legacy root reads in logs

## Production
1. Backup Firestore.
2. Deploy Firestore rules.
3. Run migration dry-run and review report.
4. Run migration apply.
5. Enable strict mode runtime flag.
6. Run `npm run test:e2e:real` against production credentials in a dedicated QA account.
7. Verify super admin metadata edit flow for UID `2z2BdO8aVsUovqQWWL9WCRMdV933`.
8. Monitor logs for:
   - `strict_mode_*` errors
   - permission denied on `users/{uid}/games/{gameId}`
   - invitation/alliance context mismatch counters

## Exit Criteria
- No fallback-read logs in strict mode.
- No `(not synced)` UI messaging.
- Alliance roster and invitation workflows stable per selected game.
- All automated test suites green.
