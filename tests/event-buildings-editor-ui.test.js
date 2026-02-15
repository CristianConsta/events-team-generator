const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const modulePath = path.resolve(__dirname, '../js/ui/event-buildings-editor-ui.js');

function loadModule() {
  global.window = global;
  delete global.DSEventBuildingsEditorUI;
  delete require.cache[require.resolve(modulePath)];
  require(modulePath);
  return global.DSEventBuildingsEditorUI;
}

function createClassList(initialClasses) {
  const values = new Set(Array.isArray(initialClasses) ? initialClasses : []);
  return {
    add(name) {
      values.add(name);
    },
    remove(name) {
      values.delete(name);
    },
    contains(name) {
      return values.has(name);
    },
    toArray() {
      return Array.from(values);
    },
  };
}

function createEditorRow(options) {
  const config = options || {};
  const nameInput = { value: config.name || '' };
  const slotsInput = { value: String(config.slots || 0) };
  const priorityInput = { value: String(config.priority || 1) };
  const showBuilding = config.showOnMap !== false;
  const showOnMapToggle = {
    querySelector(selector) {
      if (selector === '[data-display="building"].active' && showBuilding) {
        return {};
      }
      return null;
    },
  };

  return {
    querySelector(selector) {
      if (selector === 'input[data-field="name"]') return nameInput;
      if (selector === 'input[data-field="slots"]') return slotsInput;
      if (selector === 'input[data-field="priority"]') return priorityInput;
      if (selector === '[data-field="showOnMap"]') return showOnMapToggle;
      return null;
    },
  };
}

test.afterEach(() => {
  delete global.window;
  delete global.DSEventBuildingsEditorUI;
  delete require.cache[require.resolve(modulePath)];
});

test('renderEventBuildingsEditor uses provided buildings and createRow adapter', () => {
  const ui = loadModule();
  const appendedRows = [];
  const tbody = {
    innerHTML: 'stale',
    appendChild(node) {
      appendedRows.push(node);
    },
  };

  ui.renderEventBuildingsEditor({
    tbody,
    buildings: [{ name: 'HQ' }, { name: 'Airport' }],
    defaultRows: [{ name: 'Fallback' }],
    createRow(row) {
      return { row };
    },
  });

  assert.equal(tbody.innerHTML, '');
  assert.equal(appendedRows.length, 2);
  assert.equal(appendedRows[0].row.name, 'HQ');
  assert.equal(appendedRows[1].row.name, 'Airport');
});

test('addEventBuildingRow appends a default row when edit mode is allowed', () => {
  const ui = loadModule();
  const appendedRows = [];
  const tbody = {
    appendChild(node) {
      appendedRows.push(node);
    },
  };

  const appended = ui.addEventBuildingRow({
    tbody,
    canEdit: true,
    rowData: { name: 'New Building', slots: 3, priority: 2, showOnMap: false },
    createRow(row) {
      return { row };
    },
  });

  assert.equal(appended, true);
  assert.equal(appendedRows.length, 1);
  assert.equal(appendedRows[0].row.name, 'New Building');
  assert.equal(appendedRows[0].row.showOnMap, false);
});

test('readEventBuildingsEditor returns parsed rows with showOnMap state', () => {
  const ui = loadModule();
  const rows = [
    createEditorRow({ name: 'HQ', slots: 5.4, priority: 2.4, showOnMap: true }),
    createEditorRow({ name: 'Team Reserve', slots: 3, priority: 1, showOnMap: false }),
  ];
  const tbody = {
    querySelectorAll(selector) {
      return selector === 'tr' ? rows : [];
    },
  };

  const result = ui.readEventBuildingsEditor({
    tbody,
    translate: (key, params) => (params && params.name ? `${key}:${params.name}` : key),
    clampSlots: (value, fallback) => {
      if (!Number.isFinite(value)) return fallback;
      return Math.max(0, Math.min(50, Math.round(value)));
    },
    clampPriority: (value, fallback) => {
      if (!Number.isFinite(value)) return fallback;
      return Math.max(1, Math.min(6, Math.round(value)));
    },
  });

  assert.equal(result.error, null);
  assert.deepEqual(result.buildings, [
    { name: 'HQ', label: 'HQ', slots: 5, priority: 2, showOnMap: true },
    { name: 'Team Reserve', label: 'Team Reserve', slots: 3, priority: 1, showOnMap: false },
  ]);
});

test('readEventBuildingsEditor rejects duplicate building names case-insensitively', () => {
  const ui = loadModule();
  const rows = [
    createEditorRow({ name: 'HQ', slots: 5, priority: 2, showOnMap: true }),
    createEditorRow({ name: 'hq', slots: 3, priority: 1, showOnMap: false }),
  ];
  const tbody = {
    querySelectorAll(selector) {
      return selector === 'tr' ? rows : [];
    },
  };

  const result = ui.readEventBuildingsEditor({
    tbody,
    translate: (key, params) => `${key}:${params && params.name ? params.name : ''}`,
    clampSlots: (value) => value,
    clampPriority: (value) => value,
  });

  assert.equal(result.buildings.length, 0);
  assert.equal(result.error, 'events_manager_duplicate_building:hq');
});

test('bindEventEditorTableActions toggles display state and removes rows', () => {
  const ui = loadModule();
  const rows = [{ id: 'row1' }];
  let ensureCalled = 0;
  let clickHandler = null;

  const buildingBtn = {
    classList: createClassList(['display-toggle-btn', 'active']),
    setAttribute(name, value) {
      this[name] = value;
    },
  };
  const teamBtn = {
    classList: createClassList(['display-toggle-btn']),
    setAttribute(name, value) {
      this[name] = value;
    },
    closest(selector) {
      if (selector === '.display-toggle') {
        return toggle;
      }
      return null;
    },
  };
  const toggle = {
    querySelectorAll(selector) {
      return selector === '.display-toggle-btn' ? [buildingBtn, teamBtn] : [];
    },
  };

  const row = {
    remove() {
      rows.length = 0;
    },
  };
  const removeBtn = {
    closest(selector) {
      if (selector === 'tr') {
        return row;
      }
      return null;
    },
  };

  const tbody = {
    addEventListener(eventName, handler) {
      if (eventName === 'click') {
        clickHandler = handler;
      }
    },
    querySelectorAll(selector) {
      return selector === 'tr' ? rows : [];
    },
  };

  ui.bindEventEditorTableActions({
    tbody,
    canEdit: () => true,
    ensureAtLeastOneRow: () => {
      ensureCalled += 1;
    },
  });

  assert.equal(typeof clickHandler, 'function');

  clickHandler({
    target: {
      closest(selector) {
        if (selector === '.display-toggle-btn') return teamBtn;
        return null;
      },
    },
  });
  assert.equal(buildingBtn.classList.contains('active'), false);
  assert.equal(teamBtn.classList.contains('active'), true);
  assert.equal(buildingBtn['aria-checked'], 'false');
  assert.equal(teamBtn['aria-checked'], 'true');

  clickHandler({
    target: {
      closest(selector) {
        if (selector === '.display-toggle-btn') return null;
        if (selector === 'button[data-action="remove-row"]') return removeBtn;
        return null;
      },
    },
  });
  assert.equal(rows.length, 0);
  assert.equal(ensureCalled, 1);
});
