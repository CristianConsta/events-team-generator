# Player Card Redesign Plan

## 1. Current Problems

### 1.1 Excessive Vertical Space per Card

On mobile (max-width 768px), each player "card" (actually a `<tr>` styled as a card via `.responsive-table-card`) consumes significant vertical space because:

- **Stats are displayed on a single flex line but with verbose prefixes**: Each stat cell (`td:nth-child(2)`, `td:nth-child(3)`, `td:nth-child(4)`) uses `::before` pseudo-elements with emoji + label text (e.g., `'⚡ '`, `' | ⛨ THP: '`, `' | '`). These prefixes add visual noise without aiding comprehension for repeat users.
  - File: `styles.css`, lines 3117-3134
- **Team selection buttons occupy a full-width row below stats**: `td:nth-child(5)` is set to `width: 100%` with `padding-top: 8px` and a `border-top`, creating a visually separate "actions section" that adds ~60px of height per card.
  - File: `styles.css`, lines 3136-3141
- **Card padding is generous**: Each `<tr>` card has `padding: 12px` and `margin-bottom: 10px` (line 3027-3028), totaling ~22px of vertical dead space between content areas.

**Impact**: On a typical 390px-wide mobile viewport, only ~1.5 cards are visible at a time, requiring excessive scrolling to review players.

### 1.2 Redundant Labels

- The table header row is hidden on mobile (`thead { display: none }`, line 3015-3016), but inline `::before` labels re-introduce verbose text per cell.
- The THP cell uses `attr(data-inline-label)` set from JS (`player-table-ui.js`, line 69: `thpCell.setAttribute('data-inline-label', t('table_header_thp'))`), producing content like `" | ⛨ THP: 5"`. This is redundant once users learn the interface.

### 1.3 Heavy Visual Weight

- Card border: `1px solid rgba(255,255,255,0.12)` (line 3029) -- acceptable but combined with background `rgba(255,255,255,0.07)` and the parent table border `1px solid rgba(var(--gold-rgb), 0.22)` (line 816), creates a double-framed look.
- Selected-state cards add colored borders (`border-color: rgba(var(--team-a-rgb),0.4)`) on top of the base border (lines 3039-3040).
- The table itself has `border-radius: 12px; overflow: hidden; background: rgba(9, 14, 25, 0.58); border: 1px solid rgba(var(--gold-rgb), 0.22)` (lines 813-816), wrapping all cards in a gold-bordered container.

### 1.4 Actions Section Separation

- The 5th `<td>` (team selection buttons) is visually separated with `border-top: 1px solid rgba(255,255,255,0.08)` and `padding-top: 8px` (lines 3138-3140).
- This creates a distinct "actions zone" per card, wasting vertical space and breaking the flow.
- The `team-actions-stack` on mobile wraps to full width with `flex-wrap: wrap` and the clear button takes `width: 100%` (lines 3192-3198), adding another full row.

### 1.5 Typography Lacks Hierarchy

- Player name uses `font-size: 14px` (line 3115) -- the same visual weight as stat values at `13px` (lines 3117, 3123, 3129).
- No color differentiation between name and stats -- both use `var(--text-primary)` or slight opacity differences (`opacity: 0.85`).

---

## 2. Redesign Specification

### 2.1 Compact Card Layout

**What**: Reduce card padding and margin.

**Why**: Maximizes cards visible per screen. Research recommends 8-12px padding for compact data cards on mobile ([Material Design density guidance](https://m3.material.io/foundations/layout/understanding-layout/density)).

**How**:
```css
/* BEFORE (styles.css ~line 3027-3028) */
#playersTable tr {
    padding: 12px;
    margin-bottom: 10px;
}

/* AFTER */
#playersTable tr {
    padding: 8px 10px;
    margin-bottom: 6px;
}
```

**Files**: `styles.css`, lines 3020-3030

### 2.2 Horizontal Stat Layout with Minimal Labels

**What**: Display stats inline as `PlayerName` on the first line and `120M  |  5  |  Tank` on the same line or immediately after, using only separator pipes instead of emoji+text labels. Use subtle color/opacity to distinguish stat types.

**Why**: Eliminates redundant labels, reduces per-card height by ~20px. Best practice: "Lead with descriptive yet brief headlines, then use tight, scannable copy" ([Card UI Design Best Practices](https://uxdworld.com/designing-ui-cards/)).

**How -- CSS changes**:
```css
/* BEFORE (styles.css ~lines 3117-3134) */
#playersTable td:nth-child(2)::before {
    content: '⚡ ';
    opacity: 0.75;
    margin-right: 2px;
}
#playersTable td:nth-child(3)::before {
    content: ' | ⛨ ' attr(data-inline-label) ': ';
    opacity: 0.8;
    margin-right: 2px;
}
#playersTable td:nth-child(4)::before {
    content: ' | ';
    opacity: 0.78;
    margin-right: 2px;
}

/* AFTER */
#playersTable td:nth-child(2)::before {
    content: none;
}
#playersTable td:nth-child(3)::before {
    content: '\00B7';  /* middle dot separator */
    opacity: 0.4;
    margin: 0 5px;
}
#playersTable td:nth-child(4)::before {
    content: '\00B7';
    opacity: 0.4;
    margin: 0 5px;
}
```

Also update stat cells to use a unified muted style:
```css
#playersTable td:nth-child(2),
#playersTable td:nth-child(3),
#playersTable td:nth-child(4) {
    flex: 0 0 auto;
    white-space: nowrap;
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1;
}
```

**Files**: `styles.css`, lines 3117-3134

### 2.3 Player Name Prominence

**What**: Make the player name larger and bolder relative to stats.

**Why**: Establishes clear visual hierarchy. The name is the primary identifier; stats are secondary metadata.

**How**:
```css
/* BEFORE */
#playersTable td:first-child strong { font-size: 14px; }

/* AFTER */
#playersTable td:first-child strong {
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.01em;
}
```

**Files**: `styles.css`, line 3115

### 2.4 Inline Actions (Eliminate Separate Actions Row)

**What**: Move team selection buttons to the right side of the card header line instead of a separate full-width row below. Use a two-row card: Row 1 = `[Name] ... [Team A] [Team B]`, Row 2 = `120M . 5 . Tank`.

**Why**: Eliminates the `border-top` separator and `padding-top: 8px` wasted space. Saves ~30-40px per card. Common pattern: trailing action buttons in card headers ([Card UI best practices](https://bricxlabs.com/blogs/card-ui-design-examples)).

**How -- CSS**:
```css
/* Card grid layout: 2 rows */
#playersTable tr {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;
    column-gap: 8px;
    row-gap: 2px;
    align-items: center;
    padding: 8px 10px;
    margin-bottom: 6px;
}

/* Name: row 1, col 1 */
#playersTable td:first-child {
    grid-column: 1;
    grid-row: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* Team buttons: row 1, col 2 */
#playersTable td:nth-child(5) {
    grid-column: 2;
    grid-row: 1;
    width: auto;
    padding-top: 0;
    border-top: none;
    margin-top: 0;
}

/* Stats (power, THP, troops): row 2, spanning both columns */
#playersTable td:nth-child(2),
#playersTable td:nth-child(3),
#playersTable td:nth-child(4) {
    grid-row: 2;
}
#playersTable td:nth-child(2) { grid-column: 1; }
```

However, since power/THP/troops are separate `<td>` elements and we need them inline on row 2, we need a subgrid or simpler approach. Better approach -- wrap stats visually by placing them all on row 2, column 1/-1:

```css
/* Stats all on row 2, displayed inline */
#playersTable td:nth-child(2) { grid-column: 1; grid-row: 2; }
#playersTable td:nth-child(3) { grid-column: 1; grid-row: 2; }  /* won't work -- same cell */
```

Since we have separate `<td>` elements, the cleanest approach is keeping `display: flex; flex-wrap: wrap` but restructuring with `order`:

```css
#playersTable tr {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0;
    padding: 8px 10px;
    margin-bottom: 6px;
}

/* Row 1: Name (grows) + Actions (fixed) */
#playersTable td:first-child {
    flex: 1 1 0;
    min-width: 0;
    order: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 2px 0;
}
#playersTable td:nth-child(5) {
    flex: 0 0 auto;
    order: 2;
    width: auto;
    padding: 2px 0;
    border-top: none;
    margin-top: 0;
}

/* Row 2: Stats (force line break after actions) */
#playersTable td:nth-child(2) {
    order: 3;
    padding: 2px 0;
}
#playersTable td:nth-child(3) {
    order: 4;
    padding: 2px 0;
}
#playersTable td:nth-child(4) {
    order: 5;
    padding: 2px 0;
}

/* Force stats to a new line */
#playersTable td:nth-child(2)::before {
    content: none;
}
/* Use the actions cell to create a line break */
#playersTable td:nth-child(5) {
    /* already order: 2, sits after name */
}
/* After actions, force wrap by making stats collectively take full width */
#playersTable td:nth-child(2) {
    flex-basis: auto;
}
```

**Recommended final approach** using a hidden flex-break:

```css
@media (max-width: 768px) {
    #playersTable tr {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        padding: 8px 10px;
        margin-bottom: 6px;
        border-radius: 8px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.08);
    }

    /* Name: left side of row 1 */
    #playersTable td:first-child {
        flex: 1 1 0;
        min-width: 0;
        order: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        padding: 2px 0;
    }
    #playersTable td:first-child strong { font-size: 15px; }

    /* Actions: right side of row 1 */
    #playersTable td:nth-child(5) {
        flex: 0 0 auto;
        order: 2;
        width: auto;
        padding: 2px 0;
        border-top: none;
        margin-top: 0;
    }

    /* Stats: row 2, full width */
    #playersTable td:nth-child(2) {
        flex: 0 0 auto;
        order: 3;
        font-size: 12px;
        color: var(--text-muted);
        white-space: nowrap;
        padding: 1px 0;
    }
    #playersTable td:nth-child(2)::before { content: none; }

    #playersTable td:nth-child(3) {
        flex: 0 0 auto;
        order: 4;
        font-size: 12px;
        color: var(--text-muted);
        white-space: nowrap;
        padding: 1px 0;
    }
    #playersTable td:nth-child(3)::before {
        content: '\00B7';
        opacity: 0.4;
        margin: 0 5px;
    }

    #playersTable td:nth-child(4) {
        flex: 0 0 auto;
        order: 5;
        font-size: 12px;
        color: var(--text-muted);
        white-space: nowrap;
        padding: 1px 0;
    }
    #playersTable td:nth-child(4)::before {
        content: '\00B7';
        opacity: 0.4;
        margin: 0 5px;
    }

    /* Force line break between row 1 and row 2 */
    #playersTable td:nth-child(5) + td {
        /* This won't work due to DOM order */
    }
}
```

**Key issue**: The DOM order of `<td>` is: name, power, thp, troops, actions. CSS `order` can reorder visually, but to force a line break between actions (order:2) and power (order:3), we need `flex-basis: 100%` on a pseudo-element or the actions cell needs to signal a break.

**Final recommended approach -- use `order` + force break via actions cell margin trick**:

```css
@media (max-width: 768px) {
    /* Actions cell signals end of row 1 */
    #playersTable td:nth-child(5) {
        order: 2;
        flex: 0 0 auto;
        width: auto;
        padding: 2px 0;
        border-top: none;
        margin-top: 0;
        margin-bottom: 0;
    }

    /* Force stats to new line by making power cell break */
    #playersTable td:nth-child(2) {
        order: 3;
        flex-basis: 0;
        /* Since name is flex:1 and actions is flex:0, they fill row 1.
           Stats with order 3-5 will naturally wrap to row 2
           IF name + actions fill the full width. */
    }
}
```

Since name is `flex: 1 1 0` it will expand to fill all space not taken by actions. This means power/thp/troops (order 3-5) cannot fit on row 1 and will wrap to row 2. This is the cleanest approach.

**Files**: `styles.css`, lines 3020-3141 (mobile responsive section for `#playersTable`)

### 2.5 Compact Team Buttons

**What**: Make team A/B buttons smaller on mobile when displayed inline with the name.

**Why**: They need to fit beside the player name without consuming too much width.

**How**:
```css
/* Compact team buttons when inline */
@media (max-width: 768px) {
    #playersTable .team-btn {
        padding: 6px 10px;
        min-height: 36px;
        font-size: 13px;
        border-radius: 8px;
        border-width: 1.5px;
    }
    #playersTable .team-select-group {
        gap: 6px;
    }
    /* Role toggle compact */
    #playersTable .role-btn {
        padding: 6px 8px;
        min-height: 36px;
        font-size: 12px;
        min-width: 64px;
    }
    #playersTable .team-clear-btn {
        min-width: 56px;
        padding: 6px 8px;
        min-height: 36px;
        font-size: 12px;
    }
    #playersTable .team-actions-stack {
        flex-wrap: nowrap;
        width: auto;
    }
    #playersTable .team-actions-stack .team-clear-btn {
        width: auto;
    }
}
```

> **Note on touch targets**: The reduced `min-height: 36px` is below the 44px WCAG AAA recommendation. However, WCAG 2.2 Level AA (Success Criterion 2.5.8) requires only 24x24px minimum with adequate spacing. The 36px height with 6px gaps between buttons exceeds the AA requirement. For AAA compliance, keep `min-height: 44px` and accept wider cards.

**Files**: `styles.css`, lines 3191-3213

### 2.6 Reduced Visual Weight

**What**: Thinner, subtler card borders and no outer table container border on mobile.

**Why**: Dark theme best practice: use surface elevation (background lightness) rather than heavy borders to create depth ([Dark Mode UI Best Practices](https://www.graphiceagle.com/dark-mode-ui/)).

**How**:
```css
@media (max-width: 768px) {
    /* Remove table-level border on mobile */
    .players-table {
        border: none;
        background: transparent;
    }

    /* Subtler card borders */
    #playersTable tr {
        border: 1px solid rgba(255,255,255,0.06);
        background: rgba(255,255,255,0.04);
    }
    #playersTable tr:hover {
        background: rgba(255,255,255,0.06);
    }
    #playersTable tr.selected-a {
        background: rgba(var(--team-a-rgb), 0.15);
        border-color: rgba(var(--team-a-rgb), 0.3);
    }
    #playersTable tr.selected-b {
        background: rgba(var(--team-b-rgb), 0.15);
        border-color: rgba(var(--team-b-rgb), 0.3);
    }
}
```

**Files**: `styles.css`, lines 3025-3040, 813-816

### 2.7 Remove `data-inline-label` from JS

**What**: Remove the `data-inline-label` attribute from the THP cell since we no longer use it in CSS `::before` content.

**Why**: Dead code cleanup.

**How**:
```js
// BEFORE (player-table-ui.js, lines 69, 105)
thpCell.setAttribute('data-inline-label', t('table_header_thp'));

// AFTER -- remove these lines entirely
```

**Files**: `js/ui/player-table-ui.js`, lines 69 and 105

---

## 3. Expected Outcome

### Before (estimated per card on mobile)
- Name row: ~36px
- Stats with labels: ~20px (inline but with emoji prefixes)
- Separator border + padding: ~10px
- Action buttons (full width): ~50px
- Card padding + margin: ~34px
- **Total: ~150px per card**

### After (estimated per card on mobile)
- Name + inline action buttons: ~40px
- Stats row (compact, no labels): ~18px
- Card padding + margin: ~22px
- **Total: ~80px per card**

**Result**: ~1.9x improvement in density. On a 667px viewport (iPhone SE), visible cards increase from ~1.5 to ~3.

---

## 4. Implementation Checklist

### Phase 1: CSS-only changes (no JS or HTML modifications)

1. [ ] **Reduce card padding and margin** -- Update `#playersTable tr` in the `@media (max-width: 768px)` block (line ~3020) to `padding: 8px 10px; margin-bottom: 6px; border-radius: 8px;`

2. [ ] **Reorder cells with CSS `order`** -- Add `order` properties to `#playersTable td` selectors in the mobile media query:
   - `td:first-child` -> `order: 1; flex: 1 1 0;`
   - `td:nth-child(5)` -> `order: 2; flex: 0 0 auto; width: auto; border-top: none; padding-top: 2px;`
   - `td:nth-child(2)` -> `order: 3;`
   - `td:nth-child(3)` -> `order: 4;`
   - `td:nth-child(4)` -> `order: 5;`

3. [ ] **Simplify stat `::before` labels** -- Replace emoji+text prefixes with minimal dot separators:
   - `td:nth-child(2)::before` -> `content: none;`
   - `td:nth-child(3)::before` -> `content: '\00B7'; opacity: 0.4; margin: 0 5px;`
   - `td:nth-child(4)::before` -> `content: '\00B7'; opacity: 0.4; margin: 0 5px;`

4. [ ] **Unify stat cell styling** -- Set `font-size: 12px; color: var(--text-muted); padding: 1px 0;` on stat cells.

5. [ ] **Increase name prominence** -- Set `#playersTable td:first-child strong` to `font-size: 15px; font-weight: 700;`

6. [ ] **Reduce card border weight** -- Change card border to `rgba(255,255,255,0.06)` and background to `rgba(255,255,255,0.04)`.

7. [ ] **Remove table container border on mobile** -- Add `.players-table { border: none; background: transparent; }` inside the 768px media query.

8. [ ] **Reduce selected-state border intensity** -- Lower alpha values for `.selected-a` and `.selected-b` border colors.

### Phase 2: Team button compaction

9. [ ] **Compact team buttons** -- Scope `#playersTable .team-btn` to `padding: 6px 10px; min-height: 36px; font-size: 13px;` in the mobile query.

10. [ ] **Compact role toggle** -- Scope `#playersTable .role-btn` to `padding: 6px 8px; min-height: 36px; min-width: 64px;`

11. [ ] **Prevent clear button full-width** -- Override `.team-actions-stack` to `flex-wrap: nowrap; width: auto;` and `.team-clear-btn` to `width: auto; min-width: 56px;`

### Phase 3: JS cleanup

12. [ ] **Remove `data-inline-label` attribute** -- Delete `thpCell.setAttribute('data-inline-label', ...)` from `player-table-ui.js` lines 69 and 105.

### Phase 4: QA Verification

13. [ ] **Mobile viewport testing** -- Verify 2+ cards visible on 390px-wide viewport without scrolling.
14. [ ] **Touch target audit** -- Confirm all buttons meet minimum 36px height with 6px+ spacing (WCAG AA 2.5.8).
15. [ ] **Selected state visibility** -- Verify Team A (blue) and Team B (red) selected cards are clearly distinguishable.
16. [ ] **Role toggle functionality** -- Confirm Starter/Sub toggle and Clear button still work after layout changes.
17. [ ] **Desktop regression** -- Verify the desktop table layout (>768px) is unaffected since all changes are scoped to the mobile media query.
18. [ ] **Both themes** -- Test with both "Standard" and "Last War" themes (`:root[data-theme='last-war']`).
19. [ ] **RTL/i18n check** -- Verify layout works with longer translations (German, French) without overflow.
20. [ ] **Players Management page** -- Confirm `#playersMgmtTable` cards are unaffected (changes are scoped to `#playersTable`).

---

## 5. Wireframe (ASCII)

### Current Mobile Card (~150px tall)
```
+--------------------------------------------+
|  PlayerName                                 |
|  ⚡ 120M | ⛨ THP: 5 | Tank                 |
|  ─────────────────────────────────────────  |
|  [  Team A  ]        [  Team B  ]           |
+--------------------------------------------+
```

### Redesigned Mobile Card (~80px tall)
```
+--------------------------------------------+
|  PlayerName              [ A ]  [ B ]       |
|  120M . 5 . Tank                            |
+--------------------------------------------+
```

### Redesigned Card (Selected, with role toggle)
```
+--------------------------------------------+
|  PlayerName        [Starter|Sub] [Clear]    |
|  120M . 5 . Tank                            |
+--------------------------------------------+
```
