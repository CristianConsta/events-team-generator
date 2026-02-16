# Features Folder

This folder holds vertical feature modules extracted from `app.js`.

Planned feature modules:
- `generator/`
- `players-management/`
- `events-manager/`
- `alliance/`
- `notifications/`

Each feature should own:
- UI wiring for its section
- feature-local state handlers
- feature-specific selectors/helpers

Do not place shared cross-feature utilities here; use `js/shared/*`.
