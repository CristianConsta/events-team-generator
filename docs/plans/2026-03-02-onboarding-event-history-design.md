# Design: Extend Onboarding Tour — Event History & Player Updates

**Date:** 2026-03-02
**Status:** Approved

---

## Problem

The existing onboarding tour covers 11 steps guiding new users through Menu, Players Management, Events Manager, Generator, and Alliance. Two major features — **Event History** and **Player Updates** — are completely absent from the tour. New users have no guided introduction to these pages.

Event History in particular involves non-obvious interactions: a 3-state attendance status toggle (Attended / No Show / Excused) and a Finalize action that permanently locks a record and recalculates player reliability scores. Without onboarding context, users may overlook or misuse these features.

## Intended Outcome

After this change, new users completing the onboarding tour will:
1. Be directed to the **Event History** nav button and understand its purpose
2. See the **Event History view** highlighted with an explanation of attendance marking and finalization
3. Be directed to the **Player Updates** nav button and understand the review workflow

Existing users (who already have `ds_onboarding_done` in localStorage) are unaffected.

---

## Design: 3 New Onboarding Steps (11 → 14)

| Step | Target selector | Position | Title key | Desc key |
|------|----------------|----------|-----------|----------|
| 12 | `#navEventHistoryBtn` | bottom | `onboarding_step12_title` | `onboarding_step12_desc` |
| 13 | `#eventHistoryView` | top | `onboarding_step13_title` | `onboarding_step13_desc` |
| 14 | `#navPlayerUpdatesBtn` | bottom | `onboarding_step14_title` | `onboarding_step14_desc` |

Steps 12 and 14 mirror the existing Alliance pattern (step 10 targets the nav button, step 11 targets the page content). Step 13 targets the Event History view — a content-level step like step 11 (`#alliancePage`).

---

## English Strings

```
onboarding_step12_title: 'Event History'
onboarding_step12_desc:  'Open Event History to review past team assignments for every event.'

onboarding_step13_title: 'Mark & Finalize Attendance'
onboarding_step13_desc:  'Use the attendance panel to mark each player as Attended, No Show, or Excused. Finalize the record to lock it and update player reliability scores.'

onboarding_step14_title: 'Player Updates'
onboarding_step14_desc:  'Open Player Updates to review and apply power or troop changes submitted by players via their secure update links.'
```

---

## File Changes

### 1. `js/shell/onboarding-controller.js` — 2 edits

**Edit A:** Append 3 entries to `ONBOARDING_STEPS`:
```js
{ titleKey: 'onboarding_step12_title', descKey: 'onboarding_step12_desc', targetSelector: '#navEventHistoryBtn',  position: 'bottom' },
{ titleKey: 'onboarding_step13_title', descKey: 'onboarding_step13_desc', targetSelector: '#eventHistoryView',     position: 'top'    },
{ titleKey: 'onboarding_step14_title', descKey: 'onboarding_step14_desc', targetSelector: '#navPlayerUpdatesBtn', position: 'bottom' },
```

**Edit B:** Add `#navEventHistoryBtn` and `#navPlayerUpdatesBtn` to the menu-open selector list (the `if` block at lines 44–53 that calls `deps.openNavigationMenu()`). Without this, those nav buttons appear inside a hidden menu panel and the steps are deferred indefinitely.

### 2. `app.js` — 1 edit

Add `resumePendingOnboardingStep()` to the `navEventHistoryBtn` click handler, **after** `eventHistoryView.classList.remove('hidden')`.

**Why:** Event History navigation bypasses `setPageView()`, which is the only place `resumePendingOnboardingStep()` is normally called. Step 13 targets `#eventHistoryView` which is hidden until the user clicks the nav button in step 12. Without this call, step 13 is stored as a pending step but never resumed.

### 3. `translations.js` — 18 new keys (3 keys × 2 strings × 6 languages)

Add `onboarding_step12_title`, `onboarding_step12_desc`, `onboarding_step13_title`, `onboarding_step13_desc`, `onboarding_step14_title`, `onboarding_step14_desc` to each of the 6 language blocks: **EN, FR, DE, IT, KO, RO**.

Parity is enforced by `tests/i18n-keys.core.test.js` — the test will fail if any language is missing a key.

---

## localStorage Key

Keep `ds_onboarding_done` unchanged. Only new users (who have never completed the tour) will see the 14-step tour. Existing users are not re-triggered.

---

## Verification

1. `npm test` — `tests/i18n-keys.core.test.js` must pass (6-language key parity check)
2. Clear `ds_onboarding_done` from DevTools → Application → Local Storage
3. Sign in → tour starts at step 1, runs through all 14 steps
4. Reaching step 12: menu opens, `#navEventHistoryBtn` highlights
5. Clicking it: Event History view appears, step 13 immediately resumes with `#eventHistoryView` highlighted
6. Clicking through step 13: menu reopens, `#navPlayerUpdatesBtn` highlights (step 14)
7. Confirm: user with `ds_onboarding_done` already set → tour does NOT re-trigger
