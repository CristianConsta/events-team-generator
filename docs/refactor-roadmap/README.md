# Refactor Roadmap

Remaining work from the JS modernization refactor (phases 0-18).

Phases 0-15 are fully implemented and archived in `docs/archive/`.

## Active Documents

| Document | Description | Status |
|----------|-------------|--------|
| `refactor-modern-architecture-plan.md` | Master plan with success metrics | Phases 0-15 done; 16-18 partial/todo |
| `refactor-plan-validation-senior-software-developer.md` | Validation conditions | Playwright done; coverage + Phase 18 remain |
| `refactor-phase16-esm-and-tooling.md` | ESM entrypoint + build tooling | ESM done; Vite config is dead code (esbuild is actual bundler) |
| `refactor-phase17-quality-gates.md` | CI quality gates | Lint/typecheck/smoke done; coverage enforcement missing |
| `refactor-phase18-legacy-runtime-retirement.md` | Legacy runtime retirement | Not started — critical path |
| `refactor-audit-report.md` | Full audit with frontend/backend/QA validation | Reference |

## Priority Order

1. **Phase 18** — Migrate logic from app.js (8760 lines) into feature controllers (target: ≤1000 lines)
2. **Phase 17** — Add coverage enforcement to CI
3. **Phase 16** — Remove dead `vite.config.mjs`
