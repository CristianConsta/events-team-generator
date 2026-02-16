const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const modalModulePath = path.resolve(__dirname, '../js/shell/overlays/modal-controller.js');
const sheetModulePath = path.resolve(__dirname, '../js/shell/overlays/notifications-sheet-controller.js');

function reset(pathname) {
  delete require.cache[require.resolve(pathname)];
}

function createClassList(initial = []) {
  const classes = new Set(initial);
  return {
    add(name) {
      classes.add(name);
    },
    remove(name) {
      classes.delete(name);
    },
    toggle(name, force) {
      if (force === true) {
        classes.add(name);
      } else if (force === false) {
        classes.delete(name);
      } else if (classes.has(name)) {
        classes.delete(name);
      } else {
        classes.add(name);
      }
      return classes.has(name);
    },
    contains(name) {
      return classes.has(name);
    },
  };
}

function createNode(initial = []) {
  const attrs = {};
  return {
    classList: createClassList(initial),
    setAttribute(name, value) {
      attrs[name] = value;
    },
    getAttribute(name) {
      return attrs[name];
    },
  };
}

function setup() {
  global.window = global;
  delete global.DSShellModalController;
  delete global.DSShellNotificationsSheetController;
  reset(modalModulePath);
  reset(sheetModulePath);
  require(modalModulePath);
  require(sheetModulePath);
}

test('modal controller opens and closes overlays with hooks', () => {
  setup();
  const overlay = createNode(['hidden']);

  let beforeOpen = 0;
  let afterOpen = 0;
  global.DSShellModalController.open({
    overlay,
    onBeforeOpen() { beforeOpen += 1; },
    onAfterOpen() { afterOpen += 1; },
  });

  assert.equal(beforeOpen, 1);
  assert.equal(afterOpen, 1);
  assert.equal(overlay.classList.contains('hidden'), false);

  let afterClose = 0;
  const closed = global.DSShellModalController.close({
    overlay,
    onAfterClose() { afterClose += 1; },
  });

  assert.equal(closed, true);
  assert.equal(afterClose, 1);
  assert.equal(overlay.classList.contains('hidden'), true);
});

test('notifications sheet controller sets panel, trigger and body states', () => {
  setup();

  const panel = createNode(['hidden']);
  const trigger = createNode();
  const body = createNode();

  let panelOpen = null;
  global.DSShellNotificationsSheetController.setSheetState({
    panel,
    triggerButton: trigger,
    body,
    isOpen: true,
    setPanelVisibility(_panel, open) {
      panelOpen = open;
    },
  });

  assert.equal(panelOpen, true);
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(body.classList.contains('notifications-sheet-open'), true);
});
