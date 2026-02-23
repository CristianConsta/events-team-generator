# Global UX Implementation Plan

Generated from [global-ux-recommendations.md](./global-ux-recommendations.md) with codebase analysis.

---

## Summary Table

| Phase | Title | Rec IDs | Priority | Complexity | Dependencies |
|-------|-------|---------|----------|------------|--------------|
| 1 | Focus-Visible Styles | 1.4 | P1 | Low | None |
| 2 | Button Sizing Scale | 1.5 | P1 | Medium | None |
| 3 | Inline Styles to CSS | 1.2 | P1 | Low | None |
| 4 | Mobile Nav Grouping | 1.3 | P1 | Low | None |
| 5 | CSS File Organization | 1.1 | P1 | Low | None |
| 6 | Color Contrast Audit | 2.1 | P2 | Medium | None |
| 7 | Loading & Empty States | 2.2 | P2 | Medium | None |
| 8 | Emoji to SVG Icons | 2.3 | P2 | Medium | Phase 7 |
| 9 | Modal Standardization | 2.6 | P2 | High | Phase 3 |
| 10 | Responsive Table Utility | 2.5 | P2 | Medium | Phase 5 |
| 11 | Typography Scale | 3.1 | P3 | Medium | Phase 5 |
| 12 | Motion & Animation | 3.2 | P3 | Low | Phase 5 |
| 13 | Safe Area Audit | 3.3 | P3 | Low | None |
| 14 | Surface Elevation System | 3.5 | P3 | Medium | Phase 5 |
| 15 | Sticky Filter Bar | Mobile | P2 | Low | None |
| 16 | dvh Units | Mobile | P3 | Low | None |
| 17 | Accent Color Optimization | Dark | P3 | Low | None |
| 18 | Elevation via Lightness | Dark | P3 | Low | Phase 14 |

---

## Phase 1: Focus-Visible Styles

Priority: P1
Estimated complexity: Low
Dependencies: None

### Rationale

Addresses recommendation 1.4. The dark theme backgrounds make browser default focus rings nearly invisible. Currently only `button:focus-visible` has a style (line 441 of `styles.css`), but no other interactive elements (links, inputs, selects, `.filter-option`, `.header-menu-item`) have focus-visible styles. WCAG 2.4.7 requires visible focus indicators on all interactive elements.

### Technical Steps

#### Step 1.1: Add global `:focus-visible` rule for all interactive elements

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/styles.css`
- **Current code** (lines 441-444):
```css
button:focus-visible {
    outline: 2px solid rgba(var(--gold-rgb), 0.8);
    outline-offset: 2px;
}
```
- **New code**: Replace the existing `button:focus-visible` rule and add a comprehensive rule immediately after line 444:
```css
/* ── Focus-visible — global accessible focus ring ── */
:focus-visible {
    outline: 2px solid rgba(var(--gold-rgb), 0.8);
    outline-offset: 2px;
}
/* Light-background context (login screen) */
#loginScreen :focus-visible {
    outline-color: #4D86FF;
}
```
- **Why**: A single universal `:focus-visible` rule covers buttons, inputs, selects, links, and any future interactive elements. The login screen uses a white background so gold outlines would look odd; blue matches the existing `.login-input:focus` style. The existing `button:focus-visible` can be removed since the universal rule handles it.

#### Step 1.2: Remove the now-redundant `button:focus-visible` rule

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/styles.css`
- **Current code** (lines 441-444):
```css
button:focus-visible {
    outline: 2px solid rgba(var(--gold-rgb), 0.8);
    outline-offset: 2px;
}
```
- **New code**: Remove these lines entirely (the universal rule from Step 1.1 covers them).
- **Why**: Avoids duplicate rules with identical effect.

#### Step 1.3: Ensure `.login-input:focus` does not suppress outline

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/styles.css`
- **Current code** (lines 179-183):
```css
.login-input:focus {
    border-color: #4D86FF;
    box-shadow: 0 0 0 3px rgba(77, 134, 255, 0.2);
    outline: none;
}
```
- **New code**:
```css
.login-input:focus {
    border-color: #4D86FF;
    box-shadow: 0 0 0 3px rgba(77, 134, 255, 0.2);
}
.login-input:focus:not(:focus-visible) {
    outline: none;
}
```
- **Why**: Keeps the clean mouse-click appearance (no outline) while preserving the keyboard focus indicator for `:focus-visible`. This follows the recommended pattern from WCAG guidance: suppress outline only for mouse clicks, never for keyboard.

#### Step 1.4: Ensure `.filters input:focus` does not suppress outline

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/styles.css`
- **Current code** (lines 728-732):
```css
.filters input:focus {
    outline: none;
    border-color: rgba(var(--gold-rgb), 0.7);
    box-shadow: 0 0 0 2px rgba(var(--gold-rgb), 0.2);
}
```
- **New code**:
```css
.filters input:focus {
    border-color: rgba(var(--gold-rgb), 0.7);
    box-shadow: 0 0 0 2px rgba(var(--gold-rgb), 0.2);
}
.filters input:focus:not(:focus-visible) {
    outline: none;
}
```
- **Why**: Same pattern — preserves keyboard focus ring.

### Testing & Verification

- Tab through every interactive element on all pages (login, generator, players management, events manager, alliance, settings modal, coord picker, game selector). Every focusable element must show a gold (or blue on login) outline.
- Verify mouse clicks do NOT show the outline on inputs (`:focus:not(:focus-visible)` hides it).
- Run axe-core browser extension; zero "focus-visible" related violations expected.
- Existing E2E tests should pass unchanged since focus styles are purely visual.

### Risks & Mitigations

- **Risk**: Some elements with `border-radius` may clip the outline. **Mitigation**: `outline-offset: 2px` prevents clipping.
- **Risk**: Elements with `overflow: hidden` parents may clip focus rings. **Mitigation**: The coord picker overlay already has `overflow: visible` on the selection section for mobile (line 3357). Spot-check other containers.

---

## Phase 2: Button Sizing Scale

Priority: P1
Estimated complexity: Medium
Dependencies: None

### Rationale

Addresses recommendation 1.5. Button dimensions vary significantly: `.team-btn` (min-height 44px, padding 10px 14px), `.players-mgmt-actions button` (min-height 34px, padding 6px 10px), `.clear-btn` (min-height 40px, padding 10px 12px), `.role-btn` (min-height 44px, padding 10px 12px). A token-based sizing scale ensures consistency and makes future changes easier.

### Technical Steps

#### Step 2.1: Define button sizing custom properties

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/styles.css`
- **Current code** (lines 2-41, inside `:root`):
```css
    --motion-slow: 240ms;
}
```
- **New code** — add before the closing `}` of `:root`:
```css
    /* Button sizing scale */
    --btn-height-sm: 34px;
    --btn-height-md: 40px;
    --btn-height-lg: 44px;
    --btn-height-xl: 52px;
    --btn-padding-sm: 6px 10px;
    --btn-padding-md: 10px 14px;
    --btn-padding-lg: 13px 22px;
    --btn-font-sm: 13px;
    --btn-font-md: 14px;
    --btn-font-lg: 15px;
```
- **Why**: Establishes a single source of truth for button dimensions. All touch targets >= 44px on mobile (WCAG 2.5.8 Target Size). The `sm` size (34px) is only for secondary actions inside dense contexts like table rows.

#### Step 2.2: Apply tokens to base `button` rule

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/styles.css`
- **Current code** (lines 412-426):
```css
button {
    background: linear-gradient(135deg, var(--button-primary-start), var(--button-primary-end));
    color: var(--button-primary-text);
    border: 1px solid rgba(var(--gold-rgb), 0.55);
    padding: 13px 22px;
    border-radius: var(--radius-md);
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.2px;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s, filter 0.2s, border-color 0.2s;
    margin: 10px 5px;
    min-height: 44px;
    box-shadow: var(--shadow-soft);
}
```
- **New code**:
```css
button {
    background: linear-gradient(135deg, var(--button-primary-start), var(--button-primary-end));
    color: var(--button-primary-text);
    border: 1px solid rgba(var(--gold-rgb), 0.55);
    padding: var(--btn-padding-lg);
    border-radius: var(--radius-md);
    font-size: var(--btn-font-lg);
    font-weight: 700;
    letter-spacing: 0.2px;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s, filter 0.2s, border-color 0.2s;
    margin: 10px 5px;
    min-height: var(--btn-height-lg);
    box-shadow: var(--shadow-soft);
}
```
- **Why**: The base button now uses the token instead of magic numbers. No visual change since the token values match the current values.

#### Step 2.3: Apply tokens to `.clear-btn`

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/styles.css`
- **Current code** (lines 1255-1265):
```css
.clear-btn {
    padding: 10px 12px;
    ...
    font-size: 13px;
    ...
    min-height: 40px;
}
```
- **New code**:
```css
.clear-btn {
    padding: var(--btn-padding-md);
    ...
    font-size: var(--btn-font-sm);
    ...
    min-height: var(--btn-height-md);
}
```
- **Why**: Maps to the `md` sizing tier. Touch targets stay adequate.

#### Step 2.4: Apply tokens to `.team-btn`

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/styles.css`
- **Current code** (lines 1225-1236):
```css
.team-btn {
    padding: 10px 14px;
    min-height: 44px;
    ...
    font-size: 14px;
    ...
}
```
- **New code**:
```css
.team-btn {
    padding: var(--btn-padding-md);
    min-height: var(--btn-height-lg);
    ...
    font-size: var(--btn-font-md);
    ...
}
```
- **Why**: Team buttons are primary action buttons and use the `lg` height tier.

#### Step 2.5: Apply tokens to `.players-mgmt-actions button`

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/styles.css`
- **Current code** (lines 1010-1014):
```css
.players-table .players-mgmt-actions button {
    margin: 0;
    min-height: 34px;
    padding: 6px 10px;
}
```
- **New code**:
```css
.players-table .players-mgmt-actions button {
    margin: 0;
    min-height: var(--btn-height-sm);
    padding: var(--btn-padding-sm);
}
```
- **Why**: Table action buttons use the `sm` tier for compact display. On mobile (max-width: 768px) the existing rule at line 1058 already bumps to `min-width: 44px; min-height: 44px` for touch targets.

#### Step 2.6: Apply tokens to `.role-btn`

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/styles.css`
- **Current code** (lines 1283-1294):
```css
.role-btn {
    padding: 10px 12px;
    ...
    font-size: 13px;
    ...
    min-height: 44px;
    ...
}
```
- **New code**:
```css
.role-btn {
    padding: var(--btn-padding-md);
    ...
    font-size: var(--btn-font-sm);
    ...
    min-height: var(--btn-height-lg);
    ...
}
```
- **Why**: Role buttons are toggle controls that need full touch target size.

### Testing & Verification

- Visual regression: every button on every page should look identical before and after since token values match current values.
- Verify on mobile (375px viewport) that all tappable buttons meet 44px minimum height.
- Run `npm test` — no test changes expected.

### Risks & Mitigations

- **Risk**: Some buttons use hardcoded padding that doesn't exactly match the tokens. **Mitigation**: Phase implements only the buttons listed above; remaining buttons can be migrated incrementally.

---

## Phase 3: Inline Styles to CSS

Priority: P1
Estimated complexity: Low
Dependencies: None

### Rationale

Addresses recommendation 1.2. Ten inline `style` attributes in `index.html` bypass the stylesheet, preventing theme overrides and media query adjustments.

### Technical Steps

#### Step 3.1: Move `#coordPickerOverlay > div` inline styles to CSS

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/index.html` (line 410), `/Users/constantinescucristian/repos/events-team-generator/styles.css`
- **Current code** (`index.html` line 410):
```html
<div style="width: min(1000px, 95vw); max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; background: rgba(26, 26, 46, 0.98); border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); padding: 20px;">
```
- **New code** (`index.html` line 410):
```html
<div class="modal-shell modal-shell--coord-picker">
```
- Note: The `.modal-shell--coord-picker` class already exists at line 2348 of `styles.css` with matching properties. However it references `var(--panel-bg-strong)` instead of `rgba(26, 26, 46, 0.98)`. Update the CSS to ensure visual parity:
- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/styles.css` (lines 2348-2355)
- **Current code**:
```css
.modal-shell--coord-picker {
    width: min(1000px, 95vw);
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding: 20px;
}
```
- **New code**:
```css
.modal-shell--coord-picker {
    width: min(1000px, 95vw);
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding: 20px;
    background: rgba(26, 26, 46, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
}
```
- **Why**: The inline style hardcoded a specific dark blue background that differs from `--panel-bg-strong`. To avoid a visual change, replicate the exact values in CSS. The `.modal-shell` base class will also contribute its styles; the explicit background here overrides it to maintain the current appearance.

#### Step 3.2: Move `#coordHeader` inline styles to CSS

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/index.html` (line 411)
- **Current code**:
```html
<div id="coordHeader" style="display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;">
```
- **New code**:
```html
<div id="coordHeader">
```
- The CSS already has `#coordHeader` defined at line 2356-2362 with identical properties. No CSS change needed.
- **Why**: The CSS rule already exists and matches.

#### Step 3.3: Move coord picker `<h2>` inline style to CSS

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/index.html` (line 412)
- **Current code**:
```html
<h2 style="margin: 0;" data-i18n="coord_picker_title">Player Name Label Position Picker</h2>
```
- **New code**:
```html
<h2 class="modal-title" data-i18n="coord_picker_title">Player Name Label Position Picker</h2>
```
- `.modal-title` already has `margin: 0` (line 2302-2304). No CSS change needed.
- **Why**: Reuses existing class.

#### Step 3.4: Move `#gameMetadataOverlay > div` inline styles to CSS

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/index.html` (line 434), `/Users/constantinescucristian/repos/events-team-generator/styles.css`
- **Current code** (`index.html` line 434):
```html
<div style="width: min(520px, 94vw); background: rgba(26, 26, 46, 0.98); border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); padding: 22px;">
```
- **New code** (`index.html` line 434):
```html
<div class="modal-shell modal-shell--game-metadata">
```
- **New CSS** (add after `.modal-shell--coord-picker` block in `styles.css`):
```css
.modal-shell--game-metadata {
    width: min(520px, 94vw);
    padding: 22px;
    background: rgba(26, 26, 46, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
}
```
- **Why**: Moves inline styles to a named class, enabling media query overrides.

#### Step 3.5: Move game metadata header inline styles to CSS

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/index.html` (line 435)
- **Current code**:
```html
<div style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
```
- **New code**:
```html
<div class="modal-header">
```
- **New CSS** (add near modal styles):
```css
.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
}
```
- **Why**: Reusable modal header pattern. Note: `.settings-modal-header` already has nearly identical styles (line 2295-2301) but includes `margin-bottom: 6px`. A new `.modal-header` class without the margin is more generic.

#### Step 3.6: Move game metadata `<h2>` inline style to CSS

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/index.html` (line 436)
- **Current code**:
```html
<h2 style="margin: 0;" data-i18n="game_metadata_admin_title">Game Metadata Admin</h2>
```
- **New code**:
```html
<h2 class="modal-title" data-i18n="game_metadata_admin_title">Game Metadata Admin</h2>
```
- **Why**: Reuses existing `.modal-title` class.

#### Step 3.7: Move game metadata help `<p>` inline style to CSS

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/index.html` (line 439)
- **Current code**:
```html
<p style="opacity: 0.86; margin: 8px 0 16px;" data-i18n="game_metadata_admin_help">
```
- **New code**:
```html
<p class="modal-description" data-i18n="game_metadata_admin_help">
```
- `.modal-description` at line 2305-2308 has `opacity: 0.85; margin: 0 0 16px;`. The difference is minor (0.86 vs 0.85, 8px vs 0 top margin). Accept this tiny visual change for consistency.
- **Why**: Reuses existing class, minor visual delta is acceptable.

#### Step 3.8: Move game metadata actions `<div>` inline style to CSS

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/index.html` (line 462)
- **Current code**:
```html
<div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px;">
```
- **New code**:
```html
<div class="settings-modal-actions">
```
- `.settings-modal-actions` at line 2318-2324 has identical properties. No CSS change needed.
- **Why**: Reuses existing class.

#### Step 3.9: Move `#allianceDisplay` inline style to CSS

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/index.html` (line 122)
- **Current code**:
```html
<span id="allianceDisplay" style="display: none; color: var(--gold); font-weight: bold; opacity: 0.7; cursor: pointer;"></span>
```
- **New code**:
```html
<span id="allianceDisplay"></span>
```
- The CSS already has `#allianceDisplay` at lines 1659-1669 with `display: none; color: rgba(var(--gold-rgb), 0.86); font-weight: 700; opacity: 0.7; cursor: pointer;`. The color differs slightly (`var(--gold)` vs `rgba(var(--gold-rgb), 0.86)`) but the CSS version is correct. No CSS change needed.
- **Why**: CSS rule already handles all these styles.

#### Step 3.10: Move `#allianceCreateBtn` inline style to CSS

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/index.html` (line 123)
- **Current code**:
```html
<button id="allianceCreateBtn" title="Create/Join Alliance" style="display: none;">
```
- **New code**:
```html
<button id="allianceCreateBtn" title="Create/Join Alliance">
```
- The CSS at line 374-388 already has `#allianceCreateBtn { display: none; ... }`. No CSS change needed.
- **Why**: CSS rule already handles `display: none`.

### Testing & Verification

- Open coord picker overlay — verify layout matches exactly.
- Open game metadata overlay — verify layout matches exactly.
- Check `#allianceDisplay` and `#allianceCreateBtn` visibility toggling still works (JavaScript sets `display` via `.style.display`). Verify in `app.js` lines 5640-5645 that the JS `style.display` assignments will override the CSS `display: none`. This will work because inline styles set by JS take priority.
- All E2E tests should pass unchanged.

### Risks & Mitigations

- **Risk**: JS code in `app.js` sets `display` via `.style.display` for `#allianceDisplay` and `#allianceCreateBtn` (lines 5640-5645). This is fine because JS inline styles override CSS.
- **Risk**: Coord picker overlay uses `.modal-shell` base which has `var(--panel-bg-strong)` background. The explicit `background` on `.modal-shell--coord-picker` overrides it. No conflict.

---

## Phase 4: Mobile Nav Grouping

Priority: P1
Estimated complexity: Low
Dependencies: None

### Rationale

Addresses recommendation 1.3. The navigation menu has 10+ items with only one divider before Support. Grouping related items improves scannability on mobile.

### Technical Steps

#### Step 4.1: Add dividers between navigation groups in HTML

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/index.html` (lines 74-102)
- **Current code**: All menu items listed sequentially with one `header-menu-divider` before Support (line 90).
- **New code**: Add group labels and dividers:
```html
<div id="navMenuPanel" class="header-menu-panel hidden" role="menu" aria-label="Menu">
    <div class="header-menu-group-label" data-i18n="nav_group_views">Views</div>
    <button id="navGeneratorBtn" class="header-menu-item" role="menuitem"><span data-i18n="generator_button">Generator</span></button>
    <button id="navPlayersBtn" class="header-menu-item" role="menuitem"><span data-i18n="players_management_button">Players Management</span></button>
    <button id="navConfigBtn" class="header-menu-item" role="menuitem"><span data-i18n="events_manager_title">Events Manager</span></button>
    <div class="header-menu-divider"></div>
    <div class="header-menu-group-label" data-i18n="nav_group_data">Data</div>
    <button id="navAllianceBtn" class="header-menu-item" role="menuitem"><span data-i18n="alliance_button">Alliance</span></button>
    <button id="navEventHistoryBtn" class="header-menu-item" role="menuitem">
        <span data-i18n="event_history_nav">Event History</span>
        <span id="eventHistoryPendingBadge" class="nav-badge hidden" aria-label="Pending finalization">0</span>
    </button>
    <button id="navPlayerUpdatesBtn" class="header-menu-item" role="menuitem">
        <span data-i18n="player_updates_review_nav">Pending Updates</span>
        <span id="playerUpdatesPendingBadge" class="nav-badge hidden" aria-label="Pending updates">0</span>
    </button>
    <button id="navGameMetadataBtn" class="header-menu-item hidden" role="menuitem"><span data-i18n="game_metadata_admin_menu">Game Metadata Admin</span></button>
    <div class="header-menu-divider"></div>
    <div class="header-menu-group-label" data-i18n="nav_group_account">Account</div>
    <button id="navSettingsBtn" class="header-menu-item" role="menuitem"><span data-i18n="settings_button">Settings</span></button>
    <button id="navSwitchGameBtn" class="header-menu-item" role="menuitem"><span data-i18n="game_switch_button">Switch Game</span></button>
    <div class="header-menu-divider"></div>
    <button id="navSupportBtn" class="header-menu-item" role="menuitem">
        <span class="header-menu-item-icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v.01"/><path d="M12 8a2.5 2.5 0 0 1 2.1 3.9c-.8 1.1-2.1 1.5-2.1 2.6"/></svg>
        </span>
        <span data-i18n="support_button">Support</span>
    </button>
    <button id="navSignOutBtn" class="header-menu-item danger" role="menuitem">
        <span class="header-menu-item-icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </span>
        <span data-i18n="sign_out_button">Sign Out</span>
    </button>
</div>
```
- **Why**: Groups items into Views (Generator, Players, Events), Data (Alliance, History, Updates, Metadata), and Account (Settings, Switch Game). Support and Sign Out stay separate at the bottom.

#### Step 4.2: Add CSS for group labels

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/styles.css` (add after `.header-menu-divider` rule at line 1713)
- **New code**:
```css
.header-menu-group-label {
    padding: 6px 12px 2px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
    opacity: 0.7;
    pointer-events: none;
}
```
- **Why**: Subtle group headers that don't interfere with keyboard navigation (not focusable). The `role="menu"` container means screen readers navigate by menu items, and the group labels are purely visual aids.

#### Step 4.3: Add i18n keys for group labels

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/translations.js`
- **New keys** to add to each language dictionary:
```js
nav_group_views: 'Views',
nav_group_data: 'Data',
nav_group_account: 'Account',
```
- Translations for other languages:
  - FR: `'Vues'`, `'Données'`, `'Compte'`
  - DE: `'Ansichten'`, `'Daten'`, `'Konto'`
  - IT: `'Viste'`, `'Dati'`, `'Account'`
  - KO: `'보기'`, `'데이터'`, `'계정'`
  - RO: `'Vizualizări'`, `'Date'`, `'Cont'`
- **Why**: All user-visible strings must use i18n keys per project conventions.

### Testing & Verification

- Open hamburger menu on desktop and mobile. Verify three labeled groups with dividers.
- Test keyboard navigation through the menu (Tab/Arrow keys should skip group labels).
- Verify all menu items still work (no IDs changed).
- Run existing E2E nav tests.

### Risks & Mitigations

- **Risk**: Group labels could confuse screen readers if announced as interactive. **Mitigation**: No `role` attribute and `pointer-events: none` ensures they are treated as decorative text.

---

## Phase 5: CSS File Organization

Priority: P1
Estimated complexity: Low
Dependencies: None

### Rationale

Addresses recommendation 1.1. The 3575-line `styles.css` has no table of contents and inconsistent section markers. Adding a TOC and clear section headers makes navigation easier. Per project conventions, the file stays as a single file.

### Technical Steps

#### Step 5.1: Add Table of Contents at the top of `styles.css`

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/styles.css`
- **Current code** (line 1):
```css
* { margin: 0; padding: 0; box-sizing: border-box; }
```
- **New code** — prepend before line 1:
```css
/* ================================================================
   STYLES.CSS — Table of Contents
   ================================================================
   1.  RESET & ROOT VARIABLES .................. line ~10
   2.  THEME: LAST WAR ......................... line ~50
   3.  BASE / BODY ............................. line ~80
   4.  LAYOUT (container, app-view, screen) ..... line ~125
   5.  LOGIN SCREEN ............................ line ~135
   6.  TYPOGRAPHY (h1, section-title, etc.) ..... line ~245
   7.  BUTTONS (base, secondary, clear, team) ... line ~420
   8.  CARDS & PANELS .......................... line ~395
   9.  OVERLAYS & MODALS ....................... line ~450
  10.  ONBOARDING .............................. line ~580
  11.  COLLAPSIBLE PANELS ...................... line ~685
  12.  FILTERS & DROPDOWNS ..................... line ~715
  13.  TEAM COUNTERS & SELECTION ............... line ~790
  14.  PLAYER TABLE ............................ line ~830
  15.  ROLE TOGGLE & DISPLAY TOGGLE ............ line ~1280
  16.  FLOATING GENERATE BUTTONS ............... line ~1380
  17.  MOBILE BOTTOM NAV ....................... line ~1415
  18.  MESSAGES ................................ line ~1490
  19.  HEADER .................................. line ~1520
  20.  NOTIFICATIONS ........................... line ~1770
  21.  EVENTS MANAGER .......................... line ~1870
  22.  BUILDINGS TABLE ......................... line ~1140
  23.  PLAYERS MANAGEMENT ...................... line ~900
  24.  SETTINGS MODAL .......................... line ~2290
  25.  UPLOAD TARGET MODAL ..................... line ~2330
  26.  COORD PICKER ............................ line ~2350
  27.  DOWNLOAD MODAL .......................... line ~2445
  28.  ALLIANCE PANEL .......................... line ~2500
  29.  SUPPORT PAGE ............................ line ~2680
  30.  RESPONSIVE: TABLET (max-width: 960px) ... line ~2920
  31.  RESPONSIVE: PHONE (max-width: 768px) .... line ~2950
  32.  REDUCED MOTION .......................... line ~3440
  33.  EVENT HISTORY & RELIABILITY ............. line ~3450
  34.  PLAYER SELF-UPDATE ...................... line ~3525
   ================================================================ */
```
- **Why**: Provides a quick reference to find any section. Line numbers are approximate and should be verified after other phases are applied.

#### Step 5.2: Normalize existing section markers

Throughout `styles.css`, ensure every major section uses the same comment format:
```css
/* ── Section Name ── */
```
Many sections already use this format (e.g., line 286 `/* ── Event Selector (segmented tabs) ── */`). Sections that lack markers should have them added. Key sections to add markers:
- Before line 77 `body {`: `/* ── Base / Body ── */`
- Before line 128 `.login-card {`: `/* ── Login Screen ── */`
- Before line 238 `h1 {`: `/* ── Typography ── */`
- Before line 389 `.card {`: `/* ── Cards & Panels ── */`
- Before line 412 `button {`: `/* ── Buttons ── */`
- Before line 446 `.coord-overlay {`: `/* ── Overlays & Modals ── */`

- **Why**: Consistent comment format enables editor search/fold features and helps developers navigate.

### Testing & Verification

- Comments-only change. Zero visual impact.
- `npm test` passes.
- `npm run build` produces identical bundle (CSS is not bundled by esbuild).

### Risks & Mitigations

- **Risk**: Line numbers in TOC become stale after edits. **Mitigation**: The TOC uses approximate line numbers with `~` prefix. Update after major changes.

---

## Phase 6: Color Contrast Audit

Priority: P2
Estimated complexity: Medium
Dependencies: None

### Rationale

Addresses recommendation 2.1. Several text elements use opacity-based coloring that may fail WCAG AA (4.5:1) contrast ratios against dark backgrounds.

### Technical Steps

#### Step 6.1: Audit and fix `rgba(255, 255, 255, 0.72)` text

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/styles.css`
- **Affected selectors** (found via grep):
  - Line 356: `#playerCount, #playersListCount` — `color: rgba(255,255,255,0.72)` on `--panel-bg` (~`#0e1425`)
  - Line 943: `.players-mgmt-filter-summary` — `color: rgba(255,255,255,0.72)`
  - Line 1259: `.clear-btn` — `color: rgba(255,255,255,0.72)`
- **Analysis**: `rgba(255,255,255,0.72)` on `#0e1425` computes to approximately `#B9B9B9` which yields ~8.2:1 contrast. This passes AA. However, verify with the actual computed background.
- **Action**: Run axe-core or Chrome DevTools contrast checker on every page. Document any failures and fix by increasing alpha values or switching to explicit color values. Likely issues:
  - `.players-mgmt-inline-help` (line 920): `color: var(--text-muted)` — passes.
  - `opacity: 0.6` and `opacity: 0.7` on pseudo-element labels (lines 3102, 3290): These reduce effective contrast. Fix:

- **Current code** (line 3102):
```css
    opacity: 0.6;
```
- **New code**:
```css
    opacity: 0.75;
```

- **Current code** (line 3290):
```css
    opacity: 0.6;
```
- **New code**:
```css
    opacity: 0.75;
```

- **Why**: Raising opacity from 0.6 to 0.75 ensures the label text on mobile card views meets AA contrast ratio. `0.6` on white text against `#070c19` computes to ~6:1 (passes AA for large text only). At 0.75 it reaches ~8:1 (passes for all text sizes).

#### Step 6.2: Fix `#playersMgmtTable td::before` color

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/styles.css`
- **Current code** (line 3178):
```css
    color: rgba(255,255,255,0.68);
```
- **New code**:
```css
    color: var(--text-muted);
```
- **Why**: Uses the design token instead of a one-off opacity value. `--text-muted` is `rgba(245, 247, 255, 0.74)` which has higher contrast.

### Testing & Verification

- Run Chrome DevTools Accessibility audit on each page.
- Run axe-core extension. Target: zero contrast failures.
- Visual check: labels should be slightly more visible on mobile card views.

### Risks & Mitigations

- **Risk**: Increasing opacity may make decorative labels too prominent. **Mitigation**: 0.75 is a modest increase from 0.6 that stays visually subordinate to primary text.

---

## Phase 7: Loading & Empty States

Priority: P2
Estimated complexity: Medium
Dependencies: None

### Rationale

Addresses recommendation 2.2. When Firebase data loads, users see a blank `#playersTableBody` with no feedback.

### Technical Steps

#### Step 7.1: Add loading state CSS

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/styles.css`
- **New code** (add in the Players Table section):
```css
/* ── Loading & empty states ── */
.table-loading-state,
.table-empty-state {
    text-align: center;
    padding: 40px 20px;
    color: var(--text-muted);
    font-size: 15px;
}
.table-loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
}
@keyframes loading-spin {
    to { transform: rotate(360deg); }
}
.loading-spinner {
    width: 28px;
    height: 28px;
    border: 3px solid rgba(var(--gold-rgb), 0.2);
    border-top-color: var(--gold);
    border-radius: 50%;
    animation: loading-spin 0.8s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
    .loading-spinner {
        animation: none;
        border-top-color: rgba(var(--gold-rgb), 0.6);
    }
}
```
- **Why**: Provides a CSS-only spinner and empty state message pattern. Respects `prefers-reduced-motion`.

#### Step 7.2: Add loading state rendering in player-table-ui.js

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/js/ui/player-table-ui.js`
- Add a new function to the IIFE's public API:
```js
function renderLoadingState(tableBody, translate) {
    const t = getTranslator(translate);
    tableBody.innerHTML = '';
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.setAttribute('colspan', '5');
    td.className = 'table-loading-state';
    td.innerHTML = '<div class="loading-spinner"></div><span>' +
        t('loading_players') + '</span>';
    tr.appendChild(td);
    tableBody.appendChild(tr);
}

function renderEmptyState(tableBody, translate) {
    const t = getTranslator(translate);
    tableBody.innerHTML = '';
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.setAttribute('colspan', '5');
    td.className = 'table-empty-state';
    td.textContent = t('empty_state_no_players');
    tr.appendChild(td);
    tableBody.appendChild(tr);
}
```
- Expose in the module's public API: `global.DSPlayerTableUi.renderLoadingState = renderLoadingState;` and `global.DSPlayerTableUi.renderEmptyState = renderEmptyState;`
- **Why**: Follows the IIFE module pattern. The functions create the loading spinner and empty message using table rows for semantic correctness.

#### Step 7.3: Add i18n keys

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/translations.js`
- **New keys**:
```js
loading_players: 'Loading players...',
empty_state_no_players: 'No players yet. Upload a spreadsheet or add players manually.',
```
- Add translations for all six languages.
- **Why**: All user-visible strings must use i18n.

#### Step 7.4: Wire loading state into app.js

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/app.js`
- At the point where `renderPlayersTable()` is called after auth but before data arrives, call `DSPlayerTableUi.renderLoadingState()` on both `#playersTableBody` and `#playersMgmtTableBody`.
- When data arrives and `allPlayers` is empty, call `DSPlayerTableUi.renderEmptyState()` instead of leaving the table blank.
- **Why**: Provides immediate visual feedback during data loading.

### Testing & Verification

- Sign in with a new account (no players). Verify "No players yet..." message appears.
- Throttle network in DevTools. Verify spinner appears during load.
- `npm test` — add a unit test for `renderLoadingState` and `renderEmptyState` functions.
- Verify `prefers-reduced-motion: reduce` stops the spinner animation.

### Risks & Mitigations

- **Risk**: The spinner runs during initial page load before Firebase auth completes, then the table re-renders. **Mitigation**: The spinner is only shown when explicitly called; it will be replaced by the actual data render.

---

## Phase 8: Emoji to SVG Icons

Priority: P2
Estimated complexity: Medium
Dependencies: Phase 7 (for consistency with new loading states)

### Rationale

Addresses recommendation 2.3. Emoji rendering varies across platforms. The app already uses SVGs extensively in table headers and navigation.

### Technical Steps

#### Step 8.1: Replace emoji in `#playersMgmtTable td::before` pseudo-elements

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/styles.css` (lines 3181-3185)
- **Current code**:
```css
#playersMgmtTable td:nth-child(1)::before { content: '👤 ' attr(data-label); }
#playersMgmtTable td:nth-child(2)::before { content: '⚡ ' attr(data-label); }
#playersMgmtTable td:nth-child(3)::before { content: '⛨ ' attr(data-label); }
#playersMgmtTable td:nth-child(4)::before { content: '⌖ ' attr(data-label); }
#playersMgmtTable td:nth-child(5)::before { content: '⚙ ' attr(data-label); }
```
- **New code**:
```css
#playersMgmtTable td:nth-child(1)::before { content: attr(data-label); }
#playersMgmtTable td:nth-child(2)::before { content: attr(data-label); }
#playersMgmtTable td:nth-child(3)::before { content: attr(data-label); }
#playersMgmtTable td:nth-child(4)::before { content: attr(data-label); }
#playersMgmtTable td:nth-child(5)::before { content: attr(data-label); }
```
- **Why**: Removes emoji from CSS pseudo-elements. The table already has SVG icons in the `<thead>` which match each column. On mobile card view, showing just the text label (from `data-label`) is sufficient and consistent. Adding inline SVGs to `::before` content is not possible in CSS, and the simplest fix is to remove the emoji entirely.

#### Step 8.2: Replace emoji in upload buttons

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/index.html` (lines 610-611)
- **Current code**:
```html
<button id="downloadTemplateBtn" class="secondary" ...><span class="action-btn-text">📥 <span data-i18n="download_template">Download Template</span></span><span class="action-btn-icon" aria-hidden="true">📥</span></button>
<button id="uploadPlayerBtn" ...><span class="action-btn-text">📤 <span data-i18n="upload_player_data">Upload Player Data</span></span><span class="action-btn-icon" aria-hidden="true">📤</span></button>
```
- **New code**:
```html
<button id="downloadTemplateBtn" class="secondary" title="Download Template" aria-label="Download Template"><span class="action-btn-text"><span data-i18n="download_template">Download Template</span></span><span class="action-btn-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></span></button>
<button id="uploadPlayerBtn" title="Upload Player Data" aria-label="Upload Player Data"><span class="action-btn-text"><span data-i18n="upload_player_data">Upload Player Data</span></span><span class="action-btn-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></span></button>
```
- **Why**: Replaces emoji with consistent SVG download/upload icons matching the style used elsewhere.

#### Step 8.3: Replace `📊` emoji in Player Database title

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/index.html` (line 599)
- **Current code**:
```html
<h2 class="inline-title" data-i18n="player_db_title">📊 Player Database</h2>
```
- **New code**:
```html
<h2 class="inline-title" data-i18n="player_db_title">Player Database</h2>
```
- Also update the i18n value for `player_db_title` in `translations.js` to remove the emoji prefix from all languages.
- **Why**: Removes emoji from heading text. The section context is clear without a decorative icon.

#### Step 8.4: Replace `🔵` emoji on Google sign-in button

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/index.html` (line 26)
- **Current code**:
```html
<button id="googleSignInBtn" class="login-btn login-btn-provider">
    🔵 <span data-i18n="login_google">Sign in with Google</span>
</button>
```
- **New code**:
```html
<button id="googleSignInBtn" class="login-btn login-btn-provider">
    <svg class="login-provider-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
    <span data-i18n="login_google">Sign in with Google</span>
</button>
```
- Add CSS:
```css
.login-provider-icon {
    flex-shrink: 0;
    vertical-align: middle;
}
```
- **Why**: Replaces the blue circle emoji with the official Google "G" SVG icon for professional appearance.

### Testing & Verification

- Check all pages visually. No emoji should remain in the UI.
- Mobile card views should show text-only labels (no emoji prefix).
- Login screen should show Google icon properly.
- `npm test` — no changes expected.

### Risks & Mitigations

- **Risk**: Removing emoji from `translations.js` `player_db_title` key affects all languages. **Mitigation**: The emoji was always prepended to the English text; just remove it from the translation string.

---

## Phase 9: Modal Standardization

Priority: P2
Estimated complexity: High
Dependencies: Phase 3 (inline styles must be moved to CSS first)

### Rationale

Addresses recommendation 2.6. Multiple overlays use different patterns: `coord-overlay` class, `modal-shell`, inline styles. After Phase 3, inline styles are resolved but the structural patterns still differ.

### Technical Steps

#### Step 9.1: Define standard modal structure and CSS

The existing `.coord-overlay` (backdrop) + `.modal-shell` (content box) pattern is already the most common. Standardize all modals to use this pattern.

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/styles.css`
- **New code** — add a unified `.modal-header` pattern (partially done in Phase 3, Step 3.5):
```css
/* ── Unified modal patterns ── */
.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
}
.modal-close-btn {
    flex-shrink: 0;
}
```
- **Why**: Every modal should have a header with title left and close button right. This unifies `.settings-modal-header`, the inline header divs in coord picker and game metadata.

#### Step 9.2: Migrate `#settingsModal` header to use `.modal-header`

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/index.html` (line 323)
- **Current code**:
```html
<div class="settings-modal-header">
```
- **New code**:
```html
<div class="modal-header">
```
- Update CSS: keep `.settings-modal-header` as an alias or remove it and update `.modal-header` to include the `margin-bottom: 6px`. Since Phase 3's `.modal-header` doesn't have margin-bottom, add it:
- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/styles.css`
- The `.modal-header` definition should include `margin-bottom: 6px;` (matching the settings header).
- **Why**: All modals use the same header class.

#### Step 9.3: Add `role="dialog"` and `aria-modal` to all overlays

Currently `#settingsModal` and `#uploadTargetModal` have `role="dialog" aria-modal="true"` but `#coordPickerOverlay`, `#gameMetadataOverlay`, `#gameSelectorOverlay`, and `#downloadModalOverlay` do not.

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/index.html`
- Add to each overlay div that lacks them:
  - Line 409: `<div id="coordPickerOverlay" class="coord-overlay hidden">` → add `role="dialog" aria-modal="true" aria-labelledby="coordPickerTitle" tabindex="-1"` (also add `id="coordPickerTitle"` to the h2 inside).
  - Line 433: `<div id="gameMetadataOverlay" class="coord-overlay hidden">` → add `role="dialog" aria-modal="true" aria-labelledby="gameMetadataTitle" tabindex="-1"` (also add `id="gameMetadataTitle"` to the h2 inside).
  - Line 394: `<div id="gameSelectorOverlay" class="coord-overlay hidden">` → add `role="dialog" aria-modal="true" tabindex="-1"`.
- **Why**: Screen readers need `role="dialog"` and `aria-modal="true"` to properly announce modal context and trap focus.

#### Step 9.4: Add Escape key handler for all modals

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/app.js`
- Verify that all modals close on Escape. Check existing code for `keydown` listeners. If any modal lacks an Escape handler, add one following the existing pattern used by the settings modal.
- **Why**: WCAG requires modals to be dismissable via keyboard.

### Testing & Verification

- Open every modal/overlay. Verify:
  - Header layout is consistent (title left, close button right).
  - Escape key closes each one.
  - Focus is trapped within the modal (Tab does not escape to background).
  - Screen reader announces the modal title.
- Existing E2E tests should still pass.

### Risks & Mitigations

- **Risk**: Renaming `.settings-modal-header` to `.modal-header` may break CSS specificity elsewhere. **Mitigation**: Search for all references to `.settings-modal-header` and update. There is only one usage (line 323 of HTML and line 2295 of CSS).
- **Risk**: Adding `aria-modal="true"` to overlays that don't have focus trapping JS may create an incomplete implementation. **Mitigation**: Verify existing overlay open/close handlers already manage focus.

---

## Phase 10: Responsive Table Utility

Priority: P2
Estimated complexity: Medium
Dependencies: Phase 5 (CSS organization for placement)

### Rationale

Addresses recommendation 2.5. The mobile card layout CSS for tables is duplicated across `#playersTable`, `#buildingsTable`, `#playersMgmtTable`, and `#eventBuildingsEditorTable` — about 180 lines of repetitive CSS (lines 3012-3188).

### Technical Steps

#### Step 10.1: Extract shared card-table base styles

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/styles.css`
- The class `.responsive-table-card` already exists on the tables in HTML (lines 547, 686). The CSS at lines 3013-3046 partially uses it but also repeats the individual table IDs.
- **Current code** (lines 3013-3046, inside `@media (max-width: 768px)`):
```css
.responsive-table-card,
#playersTable, #buildingsTable, #playersMgmtTable, #eventBuildingsEditorTable { display: block; }
.responsive-table-card thead,
#playersTable thead, #buildingsTable thead, #playersMgmtTable thead, #eventBuildingsEditorTable thead { display: none; }
.responsive-table-card tbody,
#playersTable tbody, #buildingsTable tbody, #playersMgmtTable tbody, #eventBuildingsEditorTable tbody { display: block; }

.responsive-table-card tr,
#playersTable tr, #buildingsTable tr, #playersMgmtTable tr, #eventBuildingsEditorTable tr {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    background: rgba(255,255,255,0.07);
    border-radius: 10px;
    padding: 12px;
    margin-bottom: 10px;
    border: 1px solid rgba(255,255,255,0.12);
}
...
.responsive-table-card td,
#playersTable td, #buildingsTable td, #playersMgmtTable td, #eventBuildingsEditorTable td {
    border-bottom: none;
    padding: 5px 0;
}
```
- **New code**: Replace with only `.responsive-table-card`:
```css
.responsive-table-card { display: block; }
.responsive-table-card thead { display: none; }
.responsive-table-card tbody { display: block; }
.responsive-table-card tr {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    background: rgba(255,255,255,0.07);
    border-radius: 10px;
    padding: 12px;
    margin-bottom: 10px;
    border: 1px solid rgba(255,255,255,0.12);
}
.responsive-table-card td {
    border-bottom: none;
    padding: 5px 0;
}
```
- Then keep the table-specific overrides (lines 3031+) but remove the duplicated base selectors from them.
- **Why**: Reduces ~30 lines of duplicated selectors. All four tables already have the `responsive-table-card` class in HTML.

#### Step 10.2: Add `responsive-table-card` class to tables that lack it

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/index.html`
- Check `#buildingsTable` and `#eventBuildingsEditorTable`. If they don't have `class="responsive-table-card"`, add it.
- The buildings table is rendered dynamically in JS, so also check `app.js` for where it creates the table element.
- **Why**: The shared class must be present on all tables for the consolidated CSS to work.

### Testing & Verification

- On mobile viewport (375px), verify all four table types render as cards with correct layout.
- Desktop view should be unaffected (the shared class only applies within `@media (max-width: 768px)`).
- `npm test` passes.

### Risks & Mitigations

- **Risk**: Removing ID-based selectors may reduce specificity, causing table-specific overrides to not apply. **Mitigation**: Keep the table-specific ID selectors for overrides (e.g., `#buildingsTable tr { display: grid; ... }`). Only the shared base styles use the class.

---

## Phase 11: Typography Scale

Priority: P3
Estimated complexity: Medium
Dependencies: Phase 5 (CSS organization)

### Rationale

Addresses recommendation 3.1. Font sizes are ad-hoc (11px, 12px, 13px, 14px, 15px, 16px, 18px, 20px, 24px) with no consistent scale.

### Technical Steps

#### Step 11.1: Define typography custom properties

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/styles.css`
- **New code** — add to `:root` block:
```css
    /* Typography scale */
    --text-xs: 11px;
    --text-sm: 13px;
    --text-base: 15px;
    --text-lg: 18px;
    --text-xl: 22px;
    --text-2xl: 28px;
```
- **Why**: Establishes a modular type scale with clear naming.

#### Step 11.2: Gradually replace hardcoded font sizes

This is a large mechanical change. Replace the most common occurrences first:
- `font-size: 11px` → `font-size: var(--text-xs)` (e.g., lines 616, 1401, 3101)
- `font-size: 13px` → `font-size: var(--text-sm)` (e.g., lines 155, 1288, 1262)
- `font-size: 14px` → `font-size: var(--text-sm)` or a new `--text-md: 14px` if needed
- `font-size: 15px` → `font-size: var(--text-base)` (e.g., lines 175, 418)
- `font-size: 16px` → `font-size: var(--text-base)` or `1rem`

**Important**: This is a gradual migration. Do NOT attempt a global find-and-replace. Apply to one section at a time and verify visually.

- **Why**: Design tokens make future size adjustments trivial and ensure consistency.

### Testing & Verification

- Visual regression: no visible changes since token values match current values.
- Spot-check each page after each section is migrated.

### Risks & Mitigations

- **Risk**: Some font sizes (e.g., 14px in the filter dropdowns) don't map cleanly to the scale. **Mitigation**: Consider adding `--text-md: 14px` if needed, or accept 14px as `var(--text-sm)` + 1px.

---

## Phase 12: Motion & Animation

Priority: P3
Estimated complexity: Low
Dependencies: Phase 5 (CSS organization)

### Rationale

Addresses recommendation 3.2. Motion custom properties exist (`--motion-fast: 140ms`, `--motion-medium: 170ms`, `--motion-slow: 240ms`) but many transitions use hardcoded `0.2s`.

### Technical Steps

#### Step 12.1: Replace hardcoded transition durations

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/styles.css`
- **Search**: All occurrences of `transition:` with hardcoded duration values like `0.2s`, `0.15s`, `0.25s`, `0.3s`, `0.4s`.
- **Replace pattern**:
  - `0.15s` → `var(--motion-fast)` (140ms ~ 0.14s)
  - `0.2s` → `var(--motion-medium)` (170ms ~ 0.17s)
  - `0.25s` → `var(--motion-slow)` (240ms ~ 0.24s)
  - `0.3s` → `var(--motion-slow)`
  - `0.4s` → keep as-is (for `max-height` collapse transitions which need longer)

Key occurrences:
- Line 309: `.event-btn` `transition: background 0.2s, color 0.2s, box-shadow 0.2s` → `transition: background var(--motion-medium), color var(--motion-medium), box-shadow var(--motion-medium)`
- Line 422: `button` `transition: transform 0.2s, box-shadow 0.2s, filter 0.2s, border-color 0.2s` → `transition: transform var(--motion-medium), box-shadow var(--motion-medium), filter var(--motion-medium), border-color var(--motion-medium)`
- Line 703: `.expand-icon` `transition: transform 0.3s` → `transition: transform var(--motion-slow)`
- Line 927: `.players-mgmt-inline-content` `transition: max-height 0.25s ease, opacity 0.2s ease, margin-top 0.2s ease` → `transition: max-height var(--motion-slow) ease, opacity var(--motion-medium) ease, margin-top var(--motion-medium) ease`

- **Why**: Centralizes timing so all animations feel cohesive and can be adjusted from one place.

#### Step 12.2: Verify `prefers-reduced-motion` rule

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/styles.css` (lines 3438-3445)
- **Current code**:
```css
@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
    }
}
```
- This already exists and is correct. No change needed.
- **Why**: Confirms the safety net is in place before we add more transitions.

### Testing & Verification

- All transitions should feel identical (the token values approximate the previous hardcoded values).
- Toggle `prefers-reduced-motion` in browser DevTools. All animations should stop.
- `npm test` passes.

### Risks & Mitigations

- **Risk**: CSS custom properties in `transition` shorthand might not be supported in older browsers. **Mitigation**: Custom properties in transition values are supported in all browsers that support CSS custom properties (all modern browsers since 2017+). The app already uses custom properties extensively.

---

## Phase 13: Safe Area Audit

Priority: P3
Estimated complexity: Low
Dependencies: None

### Rationale

Addresses recommendation 3.3. `--safe-area-inset-bottom` is defined but only used in a few places. All fixed/sticky elements need verification.

### Technical Steps

#### Step 13.1: Audit all fixed/sticky positioned elements

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/styles.css`
- Fixed/sticky elements found:
  1. `.floating-buttons` (line 1376) — **Already uses** `padding: 14px 16px calc(12px + var(--safe-area-inset-bottom))`. OK.
  2. `.mobile-bottom-nav` (line 1410) — **Already uses** `padding: 8px 10px calc(8px + var(--safe-area-inset-bottom))`. OK.
  3. `#notificationsPanel` (line 2411) — `position: fixed; top: 60px; right: 20px;`. No bottom positioning, so safe area not needed. OK.
  4. `.onboarding-tooltip` (line 588) — `position: fixed`. Positioned dynamically by JS, not bottom-anchored. OK.
  5. `body::before` (line 91) — `position: fixed; inset: 0;`. Decorative only. OK.

- **Conclusion**: The current safe area handling is adequate. All bottom-anchored fixed elements already account for safe area insets.

#### Step 13.2: Verify `viewport-fit=cover` meta tag

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/index.html`
- **Current code** (line 4):
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```
- **New code**:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
```
- **Why**: `viewport-fit=cover` is required for `env(safe-area-inset-bottom)` to actually return non-zero values on iOS devices with home indicators.

### Testing & Verification

- Test on iPhone with notch/dynamic island simulator. Verify no content is obscured by the home indicator.
- The floating generate buttons and bottom nav should have appropriate padding.

### Risks & Mitigations

- **Risk**: Adding `viewport-fit=cover` might cause content to extend behind the status bar on some devices. **Mitigation**: The app's header is not fixed at the very top, and the body already has `padding: 20px`. Content should remain clear.

---

## Phase 14: Surface Elevation System

Priority: P3
Estimated complexity: Medium
Dependencies: Phase 5 (CSS organization)

### Rationale

Addresses recommendation 3.5. Surface elevation values are inconsistent: cards use `rgba(255,255,255,0.07)` on mobile but `rgba(9, 14, 25, 0.58)` on desktop. Hover states mix `0.06` and `0.12`.

### Technical Steps

#### Step 14.1: Define elevation custom properties

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/styles.css`
- **New code** — add to `:root` block:
```css
    /* Surface elevation system */
    --surface-0: var(--bg-0);
    --surface-1: rgba(255, 255, 255, 0.04);
    --surface-2: rgba(255, 255, 255, 0.07);
    --surface-3: rgba(255, 255, 255, 0.11);
    --surface-4: rgba(255, 255, 255, 0.14);
```
- Also add to `:root[data-theme='last-war']`:
```css
    --surface-1: rgba(255, 255, 255, 0.03);
    --surface-2: rgba(255, 255, 255, 0.06);
    --surface-3: rgba(255, 255, 255, 0.09);
    --surface-4: rgba(255, 255, 255, 0.12);
```
- **Why**: Establishes a consistent elevation hierarchy. Note: `--surface-soft` and `--surface-hover` already exist. Map them: `--surface-soft` → `--surface-1`, `--surface-hover` → `--surface-3`.

#### Step 14.2: Gradually migrate surface values

Replace the most common hardcoded values:
- `rgba(255,255,255,0.04)` → `var(--surface-1)` (at-rest card backgrounds on mobile)
- `rgba(255,255,255,0.07)` → `var(--surface-2)` (raised cards, mobile table rows)
- `rgba(255,255,255,0.12)` → `var(--surface-3)` (hover states)
- This is a gradual migration; tackle one section per PR.

### Testing & Verification

- Visual regression: zero visible change since token values match current values.
- Dark theme and Last War theme both look correct.
- `npm test` passes.

### Risks & Mitigations

- **Risk**: Some elements intentionally use different elevation levels for visual hierarchy. **Mitigation**: Only replace exact matches. Do not force all elements into the same level.

---

## Phase 15: Sticky Filter Bar

Priority: P2
Estimated complexity: Low
Dependencies: None

### Rationale

Addresses mobile-specific recommendation 2. The player search/filter controls scroll out of view when scrolling through a long player list.

### Technical Steps

#### Step 15.1: Make `.filters` sticky on mobile

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/styles.css`
- Add inside the `@media (max-width: 768px)` block:
```css
    /* ── Sticky filter bar on mobile ── */
    .filters {
        position: sticky;
        top: 0;
        z-index: 100;
        background:
            linear-gradient(180deg, rgba(9, 14, 26, 0.98) 0%, rgba(9, 14, 26, 0.92) 100%);
        padding: 10px 0;
        margin: 0 -12px;
        padding-left: 12px;
        padding-right: 12px;
    }
```
- **Why**: Makes the filter bar stick to the top of the viewport when the user scrolls down through the player list. The background prevents content from showing through. Negative margin + padding compensates for the card padding so the sticky bar spans full width.

#### Step 15.2: Also make `.players-mgmt-filters` sticky on mobile

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/styles.css`
- Add inside the `@media (max-width: 768px)` block:
```css
    .players-mgmt-filters {
        position: sticky;
        top: 0;
        z-index: 100;
        background:
            linear-gradient(180deg, rgba(9, 14, 26, 0.98) 0%, rgba(9, 14, 26, 0.92) 100%);
        padding-top: 10px;
        padding-bottom: 10px;
    }
```
- **Why**: Same treatment for the Players Management page filter bar.

### Testing & Verification

- On mobile viewport, scroll down through a player list with 20+ players. The search and filter controls should remain visible at the top.
- Desktop view unaffected.
- Verify the sticky bar doesn't clip filter dropdown panels (the panels use `z-index: 500` which is above the sticky bar's `z-index: 100`).

### Risks & Mitigations

- **Risk**: `overflow: hidden` on parent `.card` (or `#selectionSection` at line 2486) prevents sticky positioning. **Mitigation**: Line 3357 already sets `#selectionSection { overflow: visible; }` on mobile specifically for dropdown panels. This also enables sticky positioning.
- **Risk**: The sticky background color uses a hardcoded dark value that won't match the Last War theme exactly. **Mitigation**: Use `var(--bg-0)` or `var(--panel-bg-strong)` instead of hardcoded rgba. Updated recommendation:
```css
    background: var(--panel-bg-strong);
```

---

## Phase 16: dvh Units

Priority: P3
Estimated complexity: Low
Dependencies: None

### Rationale

Addresses mobile-specific recommendation 5. The only `vh` usage is `min-height: 100vh` on `body` (line 86). On mobile browsers, the viewport height changes when the address bar shows/hides.

### Technical Steps

#### Step 16.1: Replace `100vh` with `100dvh` (with fallback)

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/styles.css`
- **Current code** (line 86):
```css
    min-height: 100vh;
```
- **New code**:
```css
    min-height: 100vh;
    min-height: 100dvh;
```
- **Why**: The `dvh` unit dynamically adjusts when the mobile browser chrome appears/disappears. The `vh` fallback ensures older browsers still work. This is the recommended progressive enhancement pattern.

#### Step 16.2: Check modal overlays using `vh`

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/styles.css`
- Search for `vh` usage:
  - Line 459: `.game-selector-modal { max-height: min(78vh, 760px); }` — Change to `max-height: min(78dvh, 760px);` with fallback.
  - The `.modal-shell--coord-picker` uses `max-height: 90vh` — Change to `max-height: 90dvh;` with fallback.
- Pattern for each:
```css
    max-height: 90vh;
    max-height: 90dvh;
```
- **Why**: Modals should use dynamic viewport height so they don't overflow on mobile when the browser chrome is visible (svh state).

### Testing & Verification

- Test on iOS Safari and Android Chrome. The body should fill the visible area without the 100vh bottom gap issue.
- Modals should not extend below the visible area when the address bar is showing.
- Desktop unaffected (dvh === vh on desktop).

### Risks & Mitigations

- **Risk**: `dvh` causes layout shifts on scroll as the browser chrome animates. **Mitigation**: `dvh` is only used on `min-height` (body) and `max-height` (modals), not on element heights. The CSS spec notes that `dvh` can cause content to resize during scroll, but for `min-height` on body this is harmless. For modal `max-height`, it means the modal slightly adjusts available space which is desirable.

---

## Phase 17: Accent Color Optimization

Priority: P3
Estimated complexity: Low
Dependencies: None

### Rationale

Addresses dark theme-specific recommendation 2. The gold accent `#FDC830` is highly saturated and can cause visual vibration on OLED screens in dark environments.

### Technical Steps

#### Step 17.1: Slightly desaturate the gold accent

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/styles.css`
- **Current code** (line 4):
```css
    --gold: #FDC830;
    --gold-rgb: 253, 200, 48;
```
- **New code**:
```css
    --gold: #F0C040;
    --gold-rgb: 240, 192, 64;
```
- **Why**: `#F0C040` is slightly desaturated compared to `#FDC830` (HSL shifts from 45, 98%, 59% to 45, 85%, 60%). The change is subtle — less eye strain on OLED while maintaining the gold identity. The `rgb` values are updated to match.

### Testing & Verification

- Side-by-side screenshot comparison. The gold should appear very similar but slightly warmer/softer.
- Test on both Standard and Last War themes (Last War already uses `#F2BC55` which is even more desaturated — no change needed there).
- All gold-using elements (headers, buttons, borders) should look cohesive.
- `npm test` passes.

### Risks & Mitigations

- **Risk**: The color change affects the entire brand identity. **Mitigation**: The shift is minimal (delta E < 5). If stakeholders prefer the original, this phase can be reverted with a single line change.

---

## Phase 18: Elevation via Lightness

Priority: P3
Estimated complexity: Low
Dependencies: Phase 14 (surface elevation system must be defined first)

### Rationale

Addresses dark theme-specific recommendation 3. Some containers use gold borders for emphasis where subtle background elevation would be cleaner.

### Technical Steps

#### Step 18.1: Identify gold-bordered decorative containers

- **File(s)**: `/Users/constantinescucristian/repos/events-team-generator/styles.css`
- Candidates:
  - `.card` (line 398): `border: 1px solid var(--panel-border)` — This is a core pattern, change with caution. Replace with:
    ```css
    border: 1px solid rgba(var(--gold-rgb), 0.12);
    ```
    And increase the card background to use `--surface-2` level:
    ```css
    background:
        linear-gradient(180deg, var(--surface-2) 0%, var(--surface-1) 100%),
        var(--panel-bg);
    ```
  - `.alliance-invite-card` (line 2588): `border: 1px solid rgba(255,255,255,0.12)` — Already uses white border, no change needed.

- **Why**: Reduces the prominence of decorative borders, letting background elevation create the visual hierarchy instead. Gold borders should be reserved for interactive elements.

**Note**: This is a subtle aesthetic change. Apply to one component at a time and gather feedback before broad application.

### Testing & Verification

- Cards should appear subtly raised without prominent gold borders.
- Interactive elements (buttons, inputs) should still have gold borders.
- Both themes should look correct.

### Risks & Mitigations

- **Risk**: Reducing card border visibility may make the layout feel flat. **Mitigation**: The gold top-stripe (`card::before` at line 401) remains, providing visual structure. Only the side/bottom borders are reduced.
- **Risk**: The Last War theme may need different border opacity. **Mitigation**: Test both themes; adjust the `--panel-border` variable in the theme override if needed.

---

## Implementation Order

The recommended order maximizes independence and minimizes merge conflicts:

1. **Phase 5** (CSS organization) — comments only, zero risk
2. **Phase 1** (focus-visible) — small CSS change, high accessibility impact
3. **Phase 2** (button sizing) — CSS tokens, no visual change
4. **Phase 3** (inline styles) — HTML + CSS, enables Phase 9
5. **Phase 4** (nav grouping) — HTML + CSS + i18n
6. **Phase 13** (safe area) — one-line meta tag change
7. **Phase 16** (dvh units) — small CSS additions
8. **Phase 15** (sticky filter) — mobile CSS addition
9. **Phase 6** (contrast audit) — CSS opacity tweaks
10. **Phase 12** (motion tokens) — CSS find-and-replace
11. **Phase 11** (typography scale) — gradual CSS migration
12. **Phase 14** (surface elevation) — CSS tokens
13. **Phase 7** (loading states) — JS + CSS + i18n
14. **Phase 8** (emoji to SVG) — HTML + CSS + i18n
15. **Phase 10** (responsive table) — CSS refactor
16. **Phase 9** (modal standardization) — HTML + CSS + JS, highest complexity
17. **Phase 17** (accent color) — one-line CSS change
18. **Phase 18** (elevation borders) — subtle CSS tweaks
