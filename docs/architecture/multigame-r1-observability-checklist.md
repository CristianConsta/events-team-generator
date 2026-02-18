# Multi-Game R1 Observability Checklist

Date: 2026-02-18
Source policy: `docs/architecture/migration-policy.md`

## Required counters

Track and review at minimum:

1. `dualWriteMismatchCount`
2. `invitationContextMismatchCount`
3. `fallbackReadHitCount`

Runtime access points:

- `FirebaseManager.getObservabilityCounters()`
- `FirebaseService.getObservabilityCounters()`

## R1 rollout gate (must pass)

1. Unit and E2E smoke green:
- `npm test`
- `npm run test:e2e:smoke`

2. Counter health checks:
- `dualWriteMismatchCount == 0`
- `invitationContextMismatchCount == 0`
- `fallbackReadHitCount` trending downward during migration waves

3. Migration utility readiness:
- dry-run completed with expected totals
- apply run completed with no critical failures

## Threshold references for later cutovers

- Dual-write retirement (R2 prerequisite):
  - 14-day window
  - `dualWriteMismatchCount == 0`
  - `invitationContextMismatchCount == 0`

- Legacy read fallback retirement (R3 prerequisite):
  - fallback-read hit rate < 2.0% for 14 consecutive days
