# JS Refactor Phase 16: ESM Entrypoint and Build Tooling

Date: 2026-02-16

## Objective
Introduce an ES module entrypoint and lightweight build tooling while preserving existing runtime compatibility.

## Implemented

1. Added ESM bootstrap entry:
   - `js/main.mjs`
   - `js/shell/bootstrap/app-shell-bootstrap.esm.mjs`
   - ESM boot calls `initializeApplicationUiRuntime()` when available.

2. Updated HTML runtime wiring:
   - Added `<script type="module" src="js/main.mjs"></script>` to `index.html`.
   - Kept legacy deferred script path for compatibility during migration.

3. Added Vite tooling config:
   - `vite.config.mjs`
   - Added npm scripts:
     - `npm run dev`
     - `npm run build`
     - `npm run preview`
   - Added `vite` dev dependency.

4. Added ESM bootstrap tests:
   - `tests/esm-bootstrap.test.js`
   - Covers successful and missing-initializer boot behavior.

## Audit Status (2026-02-23)

| Item | Status |
|------|--------|
| ESM entrypoint (`js/main.mjs`, `app-shell-bootstrap.esm.mjs`) | [DONE] |
| ESM bootstrap tests | [DONE] |
| Build tooling | [DONE] — but esbuild (`scripts/build.js` → `dist/bundle.js`) replaced Vite as the approved bundler per CLAUDE.md |
| `vite.config.mjs` | [TODO] Remove — dead config; esbuild is the only approved bundler |
| Vite npm scripts | [TODO] Verify `npm run dev` and `npm run build` use esbuild, not Vite |

## Remaining Work
1. Remove or repurpose `vite.config.mjs` (dead code)
2. Update doc references from Vite to esbuild
