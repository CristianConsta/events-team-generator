# UI Redesign Spec and Implementation Plan

## Objective
Redesign the platform for a friendly, low-friction experience on web and mobile while aligning with modern UX standards (WCAG 2.2, adaptive layouts, touch-first interactions).

## Product UX Principles
1. Clarity first: one primary action per screen section.
2. Progressive disclosure: advanced controls hidden until needed.
3. Consistency: shared spacing, typography, color, elevation, and states.
4. Mobile-first ergonomics: thumb-reachable core actions and bottom navigation.
5. Accessibility by default: focus visible, labels, keyboard support, contrast.

## Current Gaps (from audit)
1. High inline style usage in `index.html` (95 inline `style=` usages), causing inconsistency and maintainability issues.
2. Mixed interaction models (header menu + floating buttons + fixed panel patterns).
3. Form accessibility gaps on login (placeholder-only fields).
4. Responsive complexity relies on many mobile overrides and `!important` rules.
5. Dense visual hierarchy in data-heavy sections (selection, events editor, overlays).

## Target UX Architecture
1. Primary destinations:
   - Generator
   - Players
   - Events
   - Alliance
   - Support/Settings (secondary)
2. Mobile navigation:
   - Bottom tab bar for top 4 destinations.
   - Secondary actions inside screen-level action sheets.
3. Generator flow:
   - Step 1 Event
   - Step 2 Select players
   - Step 3 Generate team
   - Step 4 Download
4. Overlay model:
   - Desktop: modal or side panel.
   - Mobile: bottom sheet for notifications/settings-like quick actions.

## Design System Specification
### Tokens
1. Typography:
   - `--font-sans`: primary app font.
   - `--text-xs/sm/md/lg/xl`.
   - `--weight-regular/medium/semibold/bold`.
2. Spacing:
   - `--space-1..8` (4px scale).
3. Radius:
   - `--radius-sm/md/lg/xl`.
4. Elevation:
   - `--elev-1/2/3`.
5. Semantic colors:
   - `--surface`, `--surface-2`, `--text`, `--text-muted`.
   - `--brand`, `--brand-contrast`.
   - `--success`, `--warning`, `--danger`.
6. Interaction states:
   - `--focus-ring`, `--hover-overlay`, `--pressed-overlay`, `--disabled-opacity`.

### Component Rules
1. Buttons:
   - Primary, secondary, tertiary, danger variants.
   - Minimum hit target 44x44 CSS px.
   - Visible focus ring on keyboard focus.
2. Inputs:
   - Always have `<label>`.
   - Helper text and error text slots.
3. Cards:
   - Unified padding and border spec.
4. Tables/cards:
   - Desktop table, mobile card transformation with consistent data-label behavior.
5. Overlays:
   - Shared shell class for modal and sheet.
   - Focus trap and escape close behavior.

## Accessibility Requirements
1. WCAG 2.2 focus appearance for all controls.
2. Labels on login and all required forms.
3. Ensure meaningful heading order and landmarks (`header`, `main`, `nav`).
4. Keyboard support:
   - Menu, panels, modals, and dropdowns navigable by keyboard.
5. Motion:
   - Respect `prefers-reduced-motion`.
6. Contrast:
   - Validate text and icon contrast against panel backgrounds.

## Performance and UX Quality Targets
1. Interaction latency target:
   - Filter/sort/selection updates: under 100ms perceived delay on common datasets.
2. Visual stability:
   - No large layout shifts during section expansion and panel open.
3. Loading states:
   - Skeleton or progress states for map/image and data-heavy loads.

## Implementation Plan
## Phase 1: Foundations and Quick Wins
### Scope
1. Replace inline styles in high-traffic areas.
2. Fix form/accessibility basics.
3. Standardize interaction states.

### File-by-file tasks
1. `index.html`
   - Add semantic landmarks around app shell (`header`, `main`, `nav`).
   - Replace login inline styles with classes.
   - Add explicit labels for login email/password.
   - Extract modal/card inline styles into class names.
2. `styles.css`
   - Add design token section for type/spacing/radius/elevation/interaction.
   - Add shared component classes:
     - `.btn`, `.btn--primary`, `.btn--secondary`, `.btn--danger`
     - `.input`, `.input-label`, `.form-field`, `.modal-shell`
   - Create global focus-visible style for buttons, inputs, selects, interactive rows.
   - Add `@media (prefers-reduced-motion: reduce)` guard for animated elements.
3. `js/core/i18n.js`
   - Ensure label text keys exist and are applied for new explicit login labels.
4. `translations.js`
   - Add translation keys for any new labels or helper text.

### Acceptance criteria
1. Zero inline styles in login section.
2. Login form has visible labels and accessible focus behavior.
3. Buttons and inputs share unified state behavior.

## Phase 2: Navigation and Mobile Ergonomics
### Scope
1. Normalize navigation model across device sizes.
2. Reduce cognitive load for first-time users.

### File-by-file tasks
1. `index.html`
   - Add mobile bottom navigation container.
   - Keep existing header menu as desktop/overflow navigation.
2. `styles.css`
   - Add bottom nav styles and active states.
   - Convert notifications panel to bottom-sheet behavior on mobile.
   - Reduce density in section headers and utility rows on narrow screens.
3. `app.js`
   - Add route/view sync for bottom nav state.
   - Ensure panel open/close state persists correctly per view.
   - Add first-run “guided flow” hints tied to current view.

### Acceptance criteria
1. On mobile, core destinations are reachable via bottom nav.
2. Notifications and utility panels do not obstruct key action areas.
3. Generator flow is discoverable within 2 taps from app landing state.

## Phase 3: Core Screens Redesign
### Scope
1. Refactor high-complexity screens into consistent layout patterns.

### File-by-file tasks
1. `index.html`
   - Standardize section shell for:
     - Generator
     - Players Management
     - Events Manager
2. `styles.css`
   - Introduce shared “screen scaffold” classes:
     - `.screen-header`, `.screen-body`, `.screen-actions`.
   - Normalize table-to-card mobile transformations with shared utilities.
3. `js/ui/player-table-ui.js`
   - Improve action button grouping and row-level hierarchy.
   - Keep destructive actions secondary and explicit.
4. `js/ui/event-buildings-editor-ui.js`
   - Improve row density and clearer map/team toggle affordance.
5. `js/ui/alliance-panel-ui.js`
   - Convert invitation actions into explicit card actions with status chips.

### Acceptance criteria
1. Visual hierarchy is consistent across all screens.
2. Action placement patterns are consistent and predictable.
3. Mobile and desktop views share the same component language.

## Phase 4: Visual Polish and QA
### Scope
1. Final polish pass for iconography, spacing rhythm, motion, and copy.
2. Accessibility and regression validation.

### File-by-file tasks
1. `styles.css`
   - Tune color ramps and elevation to reduce visual noise.
   - Apply final spacing rhythm adjustments.
2. `app.js`
   - Add micro-interaction timing consistency (open/close/fade).
3. `tests/`
   - Add UI behavior tests where available for critical flows.

### Acceptance criteria
1. No severe accessibility issues in manual keyboard and screen-size checks.
2. Core workflows complete cleanly on 360px wide mobile and standard desktop.
3. No regression in map generation and selection workflows.

## Recommended Implementation Order (commit-level)
1. Commit 1:
   - Token and component base in `styles.css`.
   - Login section class migration in `index.html`.
2. Commit 2:
   - Global focus and labels accessibility updates.
   - Translation additions.
3. Commit 3:
   - Mobile bottom nav + route sync in `index.html` and `app.js`.
4. Commit 4:
   - Notification panel mobile bottom-sheet conversion.
5. Commit 5:
   - Generator/Players/Events structural screen scaffold normalization.
6. Commit 6:
   - Visual polish and cleanup.

## QA Checklist
1. Keyboard-only navigation works for:
   - Menu
   - Login
   - Players actions
   - Event editor controls
   - Modals and overlays
2. Mobile checks (360x800 and 390x844):
   - Bottom nav reachable
   - Floating actions do not overlap key controls
   - Sheets/modals not clipped by safe area
3. Desktop checks (1280+):
   - Header/menu/panels alignment
   - Table readability and sorting/filter behavior
4. Generator checks:
   - Team select, generate, map export, excel export all unchanged functionally

## Success Metrics
1. Reduced UI inconsistency:
   - Inline styles reduced from 95 to under 10.
2. Accessibility:
   - 100% interactive controls with visible focus state.
   - 100% required form controls have labels.
3. Usability:
   - First-time user can finish “generate and download” in under 3 minutes.
