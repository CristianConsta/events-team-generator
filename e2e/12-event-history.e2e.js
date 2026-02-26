// e2e/12-event-history.e2e.js
// Event History feature E2E tests.
// Covers: auto-save on generate, entry display (badge/name/date/count/button),
// newest-first ordering, filter dropdown, attendance panel, status toggle cycle,
// and the 10-entry soft-delete limit enforcement.
//
// Edge browser is NOT installed locally -- all tests are skipped on
// edge-desktop and edge-mobile projects.
//
// Requires: npm run build (tests load dist/bundle.js, not individual sources).

'use strict';

const { test, expect } = require('@playwright/test');
const { loadApp, injectMockFirebase, waitForMainApp } = require('./helpers');

// ---------------------------------------------------------------------------
// Skip Edge everywhere
// ---------------------------------------------------------------------------

test.skip(({ browserName }) => browserName === 'msedge', 'Edge not installed locally');

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/**
 * Inject mock Firebase with an in-memory event-history store so tests can
 * verify saves and loads end-to-end without real Firestore.
 */
async function setupWithHistoryMock(page, opts) {
  opts = opts || {};
  await injectMockFirebase(page, Object.assign({
    isSignedIn: true,
    allianceId: null,
    allianceName: null,
  }, opts.firebaseOpts || {}));

  await page.addInitScript((seedRecords) => {
    window.__E2E_HISTORY_STORE = Array.isArray(seedRecords) ? seedRecords.slice() : [];
    window.__E2E_ATTENDANCE_STORE = {};
    window.__E2E_ATTENDANCE_UPDATE_CALLS = [];
    window.__E2E_ENFORCE_LIMIT_CALLS = [];

    var _nextId = 1000;
    function nextHistId() { return 'hist_e2e_' + (_nextId++); }

    document.addEventListener('DOMContentLoaded', function patchHistoryMethods() {
      var mgr = window.FirebaseManager;
      if (!mgr) return;

      mgr.subscribePendingFinalizationCount = function (allianceId, cb) {
        if (typeof cb === 'function') cb(0);
        return function () {};
      };
      mgr.subscribePendingUpdatesCount = function (allianceId, cb) {
        if (typeof cb === 'function') cb(0);
        return function () {};
      };

      mgr.loadHistoryRecords = async function (allianceId, filters) {
        filters = filters || {};
        var records = window.__E2E_HISTORY_STORE || [];
        if (filters.activeOnly) {
          records = records.filter(function (r) { return r.active !== false; });
        }
        if (filters.eventTypeId) {
          records = records.filter(function (r) { return r.eventTypeId === filters.eventTypeId; });
        }
        return records.slice().sort(function (a, b) {
          var ta = a.createdAt instanceof Date ? a.createdAt.getTime() : Number(a.createdAt) || 0;
          var tb = b.createdAt instanceof Date ? b.createdAt.getTime() : Number(b.createdAt) || 0;
          return tb - ta;
        });
      };
      mgr.loadEventHistoryRecords = mgr.loadHistoryRecords;

      mgr.saveHistoryRecord = async function (allianceId, record) {
        var id = nextHistId();
        var stored = Object.assign({ id: id }, record);
        window.__E2E_HISTORY_STORE.unshift(stored);
        return { ok: true, historyId: id };
      };
      mgr.saveEventHistoryRecord = mgr.saveHistoryRecord;

      mgr.saveAttendanceBatch = async function (allianceId, historyId, docs) {
        var stored = (docs || []).map(function (entry) {
          return Object.assign({ status: 'attended' }, entry.doc, { docId: entry.docId });
        });
        window.__E2E_ATTENDANCE_STORE[historyId] = stored;
        return { ok: true };
      };

      mgr.loadAttendance = async function (allianceId, historyId) {
        if (window.__E2E_ATTENDANCE_STORE[historyId]) {
          return window.__E2E_ATTENDANCE_STORE[historyId];
        }
        var rec = (window.__E2E_HISTORY_STORE || []).find(function (r) { return r.id === historyId; });
        if (!rec || !Array.isArray(rec.players)) return [];
        return rec.players.map(function (p) {
          return {
            playerName: p.playerName || p.name || '',
            docId: p.playerName || p.name || '',
            status: 'attended',
            role: p.role || 'starter',
          };
        });
      };
      mgr.loadEventAttendance = mgr.loadAttendance;

      mgr.updateAttendanceStatus = async function (allianceId, historyId, docId, status) {
        window.__E2E_ATTENDANCE_UPDATE_CALLS.push({ historyId: historyId, docId: docId, status: status });
        var docs = window.__E2E_ATTENDANCE_STORE[historyId];
        if (docs) {
          var entry = docs.find(function (d) { return d.docId === docId || d.playerName === docId; });
          if (entry) entry.status = status;
        }
        return { ok: true };
      };

      mgr.enforceEventHistoryLimit = async function (allianceId, eventTypeId, limit) {
        window.__E2E_ENFORCE_LIMIT_CALLS.push({ eventTypeId: eventTypeId, limit: limit });
        var records = (window.__E2E_HISTORY_STORE || []).filter(function (r) {
          return r.eventTypeId === eventTypeId && r.active !== false;
        });
        records.sort(function (a, b) {
          var ta = a.createdAt instanceof Date ? a.createdAt.getTime() : Number(a.createdAt) || 0;
          var tb = b.createdAt instanceof Date ? b.createdAt.getTime() : Number(b.createdAt) || 0;
          return ta - tb;
        });
        while (records.length > limit) {
          records.shift().active = false;
        }
        return { ok: true };
      };

      mgr.finalizeHistory = async function (allianceId, historyId) {
        var rec = (window.__E2E_HISTORY_STORE || []).find(function (r) { return r.id === historyId; });
        if (rec) { rec.finalized = true; rec.status = 'completed'; }
        return { ok: true };
      };
      mgr.finalizeEventHistory = mgr.finalizeHistory;

      mgr.loadPlayerStats = async function () { return {}; };
      mgr.upsertPlayerStats = async function () { return { ok: true }; };
    });
  }, opts.initialRecords || []);
}

/** Navigate to the Event History view (not in navigateTo() helper map). */
async function navigateToEventHistory(page) {
  const menuBtn = page.locator('#navMenuBtn');
  if (await menuBtn.isVisible().catch(() => false)) {
    const panel = page.locator('#navMenuPanel');
    const visible = await panel.isVisible().catch(() => false);
    if (!visible) {
      await menuBtn.click({ force: true });
      await expect(panel).toBeVisible({ timeout: 3000 });
    }
  }
  await page.locator('#navEventHistoryBtn').click({ force: true });
  await expect(page.locator('#eventHistoryView')).toBeVisible({ timeout: 5000 });
}

/** Call showEventHistoryView on the public controller to load and render records. */
async function refreshHistoryView(page) {
  await page.evaluate(function () {
    if (window.DSFeatureEventHistoryController &&
        typeof window.DSFeatureEventHistoryController.showEventHistoryView === 'function') {
      window.DSFeatureEventHistoryController.showEventHistoryView();
    }
  });
  await page.waitForTimeout(500);
}

/** Wait for app-init.js to instantiate window._eventHistoryController. */
async function waitForHistoryController(page) {
  await page.waitForFunction(
    function () { return typeof window._eventHistoryController !== 'undefined'; },
    { timeout: 8000 }
  );
}

/** Select two players for Team A, click Generate, and dismiss the download modal. */
async function generateTeamA(page) {
  const btns = page.locator('#playersTableBody .team-a-btn');
  await expect(btns.first()).toBeVisible({ timeout: 5000 });
  await btns.first().click();
  await btns.nth(1).click();
  await expect(page.locator('#generateBtnA')).toBeEnabled({ timeout: 3000 });
  await page.locator('#generateBtnA').click();
  await expect(page.locator('#downloadModalOverlay')).toBeVisible({ timeout: 5000 });
  await page.locator('#downloadModalCloseBtn').click();
  await expect(page.locator('#downloadModalOverlay')).toBeHidden({ timeout: 3000 });
}

/** Select two players for Team B, click Generate, and dismiss the download modal. */
async function generateTeamB(page) {
  const btns = page.locator('#playersTableBody .team-b-btn');
  await expect(btns.first()).toBeVisible({ timeout: 5000 });
  await btns.first().click();
  await btns.nth(1).click();
  await expect(page.locator('#generateBtnB')).toBeEnabled({ timeout: 3000 });
  await page.locator('#generateBtnB').click();
  await expect(page.locator('#downloadModalOverlay')).toBeVisible({ timeout: 5000 });
  await page.locator('#downloadModalCloseBtn').click();
  await expect(page.locator('#downloadModalOverlay')).toBeHidden({ timeout: 3000 });
}

// ---------------------------------------------------------------------------
// Desktop tests
// ---------------------------------------------------------------------------

test.describe('Event History (desktop)', () => {
  test.skip(({ isMobile }) => isMobile, 'Desktop-only suite');

  // 1. Auto-save on Generate -------------------------------------------------

  test('@smoke @event-history auto-save: Team A generate saves a history entry', async ({ page }) => {
    await setupWithHistoryMock(page);
    await loadApp(page);
    await waitForMainApp(page);
    await waitForHistoryController(page);

    await generateTeamA(page);
    await page.waitForTimeout(400);

    const storeLen = await page.evaluate(() => (window.__E2E_HISTORY_STORE || []).length);
    expect(storeLen).toBeGreaterThanOrEqual(1);

    const savedTeam = await page.evaluate(() => {
      const s = window.__E2E_HISTORY_STORE || [];
      return s.length > 0 ? s[0].team : null;
    });
    expect(savedTeam).toBe('A');
  });

  test('@regression @event-history auto-save: Team B generate saves a Team B record', async ({ page }) => {
    await setupWithHistoryMock(page);
    await loadApp(page);
    await waitForMainApp(page);
    await waitForHistoryController(page);

    await generateTeamB(page);
    await page.waitForTimeout(400);

    const savedTeam = await page.evaluate(() => {
      const s = window.__E2E_HISTORY_STORE || [];
      return s.length > 0 ? s[0].team : null;
    });
    expect(savedTeam).toBe('B');
  });

  test('@regression @event-history auto-save: entry name follows {EventName}-Team A-{dd.mm.yyyy}', async ({ page }) => {
    await setupWithHistoryMock(page);
    await loadApp(page);
    await waitForMainApp(page);
    await waitForHistoryController(page);

    await generateTeamA(page);
    await page.waitForTimeout(400);

    const eventName = await page.evaluate(() => {
      const s = window.__E2E_HISTORY_STORE || [];
      return s.length > 0 ? s[0].eventName : null;
    });

    expect(eventName).toBeTruthy();
    expect(eventName).toMatch(/Team A/);
    expect(eventName).toMatch(/\d{2}\.\d{2}\.\d{4}/);
  });

  // 2. Entry display ---------------------------------------------------------

  test('@smoke @event-history entry display: history view shows auto-saved entry', async ({ page }) => {
    await setupWithHistoryMock(page);
    await loadApp(page);
    await waitForMainApp(page);
    await waitForHistoryController(page);

    await generateTeamA(page);
    await page.waitForTimeout(400);

    await navigateToEventHistory(page);
    await refreshHistoryView(page);

    await expect(page.locator('#eventHistoryContainer')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#eventHistoryContainer .event-history-item')).toHaveCount(1, { timeout: 4000 });
  });

  test('@regression @event-history entry display: shows correct team badge', async ({ page }) => {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const seedRecord = {
      id: 'hist_badge_a',
      team: 'A',
      eventTypeId: 'desert_storm',
      eventName: 'Desert Storm-Team A-' + dd + '.' + mm + '.' + yyyy,
      active: true, finalized: false, createdAt: now,
      players: [{ playerName: 'Alpha', role: 'starter' }],
    };

    await setupWithHistoryMock(page, { initialRecords: [seedRecord] });
    await loadApp(page);
    await waitForMainApp(page);
    await waitForHistoryController(page);

    await navigateToEventHistory(page);
    await refreshHistoryView(page);

    const badge = page.locator('#eventHistoryContainer .event-history-team-badge[data-team="A"]').first();
    await expect(badge).toBeVisible({ timeout: 4000 });
    await expect(badge).toHaveText('A');
  });

  test('@regression @event-history entry display: shows event name', async ({ page }) => {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const displayName = 'Desert Storm-Team A-' + dd + '.' + mm + '.' + yyyy;
    const seedRecord = {
      id: 'hist_name_display',
      team: 'A',
      eventTypeId: 'desert_storm',
      eventName: displayName,
      active: true, finalized: false, createdAt: now, players: [],
    };

    await setupWithHistoryMock(page, { initialRecords: [seedRecord] });
    await loadApp(page);
    await waitForMainApp(page);
    await waitForHistoryController(page);

    await navigateToEventHistory(page);
    await refreshHistoryView(page);

    await expect(page.locator('#eventHistoryContainer')).toContainText(displayName, { timeout: 4000 });
  });

  test('@regression @event-history entry display: shows correct player count', async ({ page }) => {
    const seedRecord = {
      id: 'hist_count',
      team: 'A',
      eventTypeId: 'desert_storm',
      eventName: 'Desert Storm-Team A-01.01.2026',
      active: true, finalized: false, createdAt: new Date('2026-01-01T12:00:00Z'),
      players: [
        { playerName: 'Alpha', role: 'starter' },
        { playerName: 'Bravo', role: 'starter' },
        { playerName: 'Charlie', role: 'substitute' },
      ],
    };

    await setupWithHistoryMock(page, { initialRecords: [seedRecord] });
    await loadApp(page);
    await waitForMainApp(page);
    await waitForHistoryController(page);

    await navigateToEventHistory(page);
    await refreshHistoryView(page);

    const countEl = page.locator('#eventHistoryContainer .event-history-item-players').first();
    await expect(countEl).toBeVisible({ timeout: 4000 });
    const countText = await countEl.textContent();
    expect(countText).toMatch(/^3/);
  });

  test('@regression @event-history entry display: attendance button present for non-finalized record', async ({ page }) => {
    const seedRecord = {
      id: 'hist_btn_present',
      team: 'A',
      eventTypeId: 'desert_storm',
      eventName: 'Desert Storm-Team A-15.02.2026',
      active: true, finalized: false, createdAt: new Date('2026-02-15T12:00:00Z'),
      players: [{ playerName: 'Alpha', role: 'starter' }],
    };

    await setupWithHistoryMock(page, { initialRecords: [seedRecord] });
    await loadApp(page);
    await waitForMainApp(page);
    await waitForHistoryController(page);

    await navigateToEventHistory(page);
    await refreshHistoryView(page);

    const btn = page.locator(
      '#eventHistoryContainer [data-action="open-attendance"][data-history-id="hist_btn_present"]'
    );
    await expect(btn).toBeVisible({ timeout: 4000 });
  });

  // 3. Ordering: newest first ------------------------------------------------

  test('@regression @event-history ordering: entries shown newest-first', async ({ page }) => {
    const older = {
      id: 'hist_order_old', team: 'A', eventTypeId: 'desert_storm',
      eventName: 'Desert Storm-Team A-01.01.2026',
      active: true, finalized: false, createdAt: new Date('2026-01-01T12:00:00Z'), players: [],
    };
    const newer = {
      id: 'hist_order_new', team: 'B', eventTypeId: 'desert_storm',
      eventName: 'Desert Storm-Team B-15.02.2026',
      active: true, finalized: false, createdAt: new Date('2026-02-15T12:00:00Z'), players: [],
    };

    await setupWithHistoryMock(page, { initialRecords: [older, newer] });
    await loadApp(page);
    await waitForMainApp(page);
    await waitForHistoryController(page);

    await navigateToEventHistory(page);
    await refreshHistoryView(page);

    const items = page.locator('#eventHistoryContainer .event-history-item');
    await expect(items).toHaveCount(2, { timeout: 4000 });
    await expect(items.first().locator('.event-history-team-badge')).toHaveText('B');
    await expect(items.nth(1).locator('.event-history-team-badge')).toHaveText('A');
  });

  // 4. Filter by event type --------------------------------------------------

  test('@regression @event-history filter: filter dropdown present on event history view', async ({ page }) => {
    await setupWithHistoryMock(page);
    await loadApp(page);
    await waitForMainApp(page);
    await waitForHistoryController(page);

    await navigateToEventHistory(page);

    await expect(page.locator('#eventHistoryFilterEventType')).toBeVisible({ timeout: 4000 });
  });

  test('@regression @event-history filter: selecting event type shows only matching records', async ({ page }) => {
    const desertRecord = {
      id: 'hist_filter_desert', team: 'A', eventTypeId: 'desert_storm',
      eventName: 'Desert Storm-Team A-01.02.2026',
      active: true, finalized: false, createdAt: new Date('2026-02-01T12:00:00Z'), players: [],
    };
    const canyonRecord = {
      id: 'hist_filter_canyon', team: 'B', eventTypeId: 'canyon_storm',
      eventName: 'Canyon Storm-Team B-02.02.2026',
      active: true, finalized: false, createdAt: new Date('2026-02-02T12:00:00Z'), players: [],
    };

    await setupWithHistoryMock(page, { initialRecords: [desertRecord, canyonRecord] });
    await loadApp(page);
    await waitForMainApp(page);
    await waitForHistoryController(page);

    await navigateToEventHistory(page);
    await refreshHistoryView(page);

    await expect(page.locator('#eventHistoryContainer .event-history-item')).toHaveCount(2, { timeout: 4000 });

    await page.evaluate(function () {
      var select = document.getElementById('eventHistoryFilterEventType');
      if (!select) return;
      if (!Array.from(select.options).find(function (o) { return o.value === 'desert_storm'; })) {
        var opt = document.createElement('option');
        opt.value = 'desert_storm'; opt.textContent = 'Desert Storm';
        select.appendChild(opt);
      }
      select.value = 'desert_storm';
      select.dispatchEvent(new Event('change'));
    });

    await page.waitForTimeout(500);

    await expect(page.locator('#eventHistoryContainer .event-history-item')).toHaveCount(1, { timeout: 4000 });
    await expect(
      page.locator('#eventHistoryContainer .event-history-item-name').first()
    ).toContainText('Desert Storm', { timeout: 3000 });
  });

  // 5. Attendance panel ------------------------------------------------------

  test('@smoke @event-history attendance: clicking button opens the attendance modal', async ({ page }) => {
    const histId = 'hist_open_modal';
    const seedRecord = {
      id: histId, team: 'A', eventTypeId: 'desert_storm',
      eventName: 'Desert Storm-Team A-15.02.2026',
      active: true, finalized: false, createdAt: new Date('2026-02-15T12:00:00Z'),
      players: [
        { playerName: 'Alpha', role: 'starter' },
        { playerName: 'Bravo', role: 'starter' },
      ],
    };

    await setupWithHistoryMock(page, { initialRecords: [seedRecord] });
    await loadApp(page);
    await waitForMainApp(page);
    await waitForHistoryController(page);

    await navigateToEventHistory(page);
    await refreshHistoryView(page);

    const openBtn = page.locator(
      `#eventHistoryContainer [data-action="open-attendance"][data-history-id="${histId}"]`
    );
    await expect(openBtn).toBeVisible({ timeout: 4000 });
    await openBtn.click({ force: true });

    await expect(page.locator('#attendancePanelModal')).toBeVisible({ timeout: 5000 });
  });

  test('@regression @event-history attendance: modal shows all player names', async ({ page }) => {
    const histId = 'hist_player_names';
    const seedRecord = {
      id: histId, team: 'A', eventTypeId: 'desert_storm',
      eventName: 'Desert Storm-Team A-15.02.2026',
      active: true, finalized: false, createdAt: new Date('2026-02-15T12:00:00Z'),
      players: [
        { playerName: 'Alpha', role: 'starter' },
        { playerName: 'Bravo', role: 'starter' },
        { playerName: 'Charlie', role: 'substitute' },
      ],
    };

    await setupWithHistoryMock(page, { initialRecords: [seedRecord] });
    await loadApp(page);
    await waitForMainApp(page);
    await waitForHistoryController(page);

    await navigateToEventHistory(page);
    await refreshHistoryView(page);

    await page.locator(
      `#eventHistoryContainer [data-action="open-attendance"][data-history-id="${histId}"]`
    ).click({ force: true });
    await expect(page.locator('#attendancePanelModal')).toBeVisible({ timeout: 5000 });

    const body = page.locator('#attendancePanelBody');
    await expect(body).toContainText('Alpha', { timeout: 3000 });
    await expect(body).toContainText('Bravo');
    await expect(body).toContainText('Charlie');
  });

  // 6. Attendance toggle cycles ----------------------------------------------

  test('@regression @event-history attendance-toggle: status cycles attended->no_show->excused->attended', async ({ page }) => {
    const histId = 'hist_cycle_status';
    const seedRecord = {
      id: histId, team: 'A', eventTypeId: 'desert_storm',
      eventName: 'Desert Storm-Team A-15.02.2026',
      active: true, finalized: false, createdAt: new Date('2026-02-15T12:00:00Z'),
      players: [{ playerName: 'Alpha', role: 'starter' }],
    };

    await setupWithHistoryMock(page, { initialRecords: [seedRecord] });
    await loadApp(page);
    await waitForMainApp(page);
    await waitForHistoryController(page);

    await navigateToEventHistory(page);
    await refreshHistoryView(page);

    await page.locator(
      `#eventHistoryContainer [data-action="open-attendance"][data-history-id="${histId}"]`
    ).click({ force: true });
    await expect(page.locator('#attendancePanelModal')).toBeVisible({ timeout: 5000 });

    const toggle = page.locator(
      '#attendancePanelBody [data-player-name="Alpha"][data-action="cycle-attendance-status"]'
    );
    await expect(toggle).toBeVisible({ timeout: 3000 });
    await expect(toggle).toHaveAttribute('data-current-status', 'attended');

    // Click 1: attended -> no_show
    await toggle.click({ force: true });
    await page.waitForTimeout(300);
    await expect(toggle).toHaveAttribute('data-current-status', 'no_show', { timeout: 3000 });

    // Click 2: no_show -> excused
    await toggle.click({ force: true });
    await page.waitForTimeout(300);
    await expect(toggle).toHaveAttribute('data-current-status', 'excused', { timeout: 3000 });

    // Click 3: excused -> attended (full cycle)
    await toggle.click({ force: true });
    await page.waitForTimeout(300);
    await expect(toggle).toHaveAttribute('data-current-status', 'attended', { timeout: 3000 });
  });

  test('@regression @event-history attendance-toggle: status change persists via updateAttendanceStatus', async ({ page }) => {
    const histId = 'hist_persist';
    const seedRecord = {
      id: histId, team: 'A', eventTypeId: 'desert_storm',
      eventName: 'Desert Storm-Team A-15.02.2026',
      active: true, finalized: false, createdAt: new Date('2026-02-15T12:00:00Z'),
      players: [{ playerName: 'Alpha', role: 'starter' }],
    };

    await setupWithHistoryMock(page, { initialRecords: [seedRecord] });
    await loadApp(page);
    await waitForMainApp(page);
    await waitForHistoryController(page);

    await navigateToEventHistory(page);
    await refreshHistoryView(page);

    await page.locator(
      `#eventHistoryContainer [data-action="open-attendance"][data-history-id="${histId}"]`
    ).click({ force: true });
    await expect(page.locator('#attendancePanelModal')).toBeVisible({ timeout: 5000 });

    const toggle = page.locator(
      '#attendancePanelBody [data-player-name="Alpha"][data-action="cycle-attendance-status"]'
    );
    await expect(toggle).toBeVisible({ timeout: 3000 });

    await toggle.click({ force: true });
    await page.waitForTimeout(400);

    const updateCalls = await page.evaluate(() => window.__E2E_ATTENDANCE_UPDATE_CALLS || []);
    expect(updateCalls.length).toBeGreaterThanOrEqual(1);
    expect(updateCalls[0].historyId).toBe(histId);
    expect(updateCalls[0].status).toBe('no_show');
  });

  // 7. Max 10 entries per event type -----------------------------------------

  test('@regression @event-history limit: enforceEventHistoryLimit called after auto-save', async ({ page }) => {
    await setupWithHistoryMock(page);
    await loadApp(page);
    await waitForMainApp(page);
    await waitForHistoryController(page);

    await generateTeamA(page);
    await page.waitForTimeout(600);

    const limitCalls = await page.evaluate(() => window.__E2E_ENFORCE_LIMIT_CALLS || []);
    expect(limitCalls.length).toBeGreaterThanOrEqual(1);
    expect(limitCalls[0].limit).toBe(10);
  });

  test('@regression @event-history limit: soft-deleted entries not shown in history view', async ({ page }) => {
    const records = Array.from({ length: 11 }, (_, i) => ({
      id: 'hist_lim_' + i,
      team: i % 2 === 0 ? 'A' : 'B',
      eventTypeId: 'desert_storm',
      eventName: 'Desert Storm-Team ' + (i % 2 === 0 ? 'A' : 'B') + '-' +
                 String(i + 1).padStart(2, '0') + '.01.2026',
      active: true,
      finalized: false,
      createdAt: new Date('2026-01-' + String(i + 1).padStart(2, '0') + 'T12:00:00Z'),
      players: [],
    }));

    await setupWithHistoryMock(page, { initialRecords: records });
    await loadApp(page);
    await waitForMainApp(page);
    await waitForHistoryController(page);

    await page.evaluate(function () {
      return window.FirebaseManager.enforceEventHistoryLimit(null, 'desert_storm', 10);
    });

    await navigateToEventHistory(page);
    await refreshHistoryView(page);

    const items = page.locator('#eventHistoryContainer .event-history-item');
    await expect(items).toHaveCount(10, { timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Mobile smoke
// ---------------------------------------------------------------------------

test.describe('Event History (mobile smoke)', () => {
  test.skip(({ isMobile }) => !isMobile, 'Mobile-only suite');

  test('@smoke @event-history @mobile navigation to event history view works', async ({ page }) => {
    await setupWithHistoryMock(page);
    await loadApp(page);
    await waitForMainApp(page);
    await waitForHistoryController(page);

    const menuBtn = page.locator('#navMenuBtn');
    if (await menuBtn.isVisible().catch(() => false)) {
      await menuBtn.click({ force: true });
    }
    await page.locator('#navEventHistoryBtn').click({ force: true });
    await expect(page.locator('#eventHistoryView')).toBeVisible({ timeout: 5000 });
  });

  test('@regression @event-history @mobile auto-saved entry appears in history view', async ({ page }) => {
    await setupWithHistoryMock(page);
    await loadApp(page);
    await waitForMainApp(page);
    await waitForHistoryController(page);

    await generateTeamA(page);
    await page.waitForTimeout(400);

    const menuBtn = page.locator('#navMenuBtn');
    if (await menuBtn.isVisible().catch(() => false)) {
      await menuBtn.click({ force: true });
    }
    await page.locator('#navEventHistoryBtn').click({ force: true });
    await expect(page.locator('#eventHistoryView')).toBeVisible({ timeout: 5000 });

    await refreshHistoryView(page);

    await expect(page.locator('#eventHistoryContainer .event-history-item')).toHaveCount(1, { timeout: 5000 });
  });
});
