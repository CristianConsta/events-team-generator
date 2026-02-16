const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const modulePath = path.resolve(__dirname, '../js/shell/navigation/navigation-controller.js');

function reset() {
  delete require.cache[require.resolve(modulePath)];
}

function createClassList(initial = []) {
  const classes = new Set(initial);
  return {
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

function createNode() {
  const attrs = {};
  return {
    classList: createClassList(),
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
  delete global.DSShellNavigationController;
  reset();
  require(modulePath);
}

test('navigation controller normalizes views and applies page visibility', () => {
  setup();

  assert.equal(global.DSShellNavigationController.normalizeView('players'), 'players');
  assert.equal(global.DSShellNavigationController.normalizeView('unknown'), 'generator');

  const pages = {
    generator: createNode(),
    configuration: createNode(),
    players: createNode(),
  };

  const view = global.DSShellNavigationController.applyPageVisibility({
    currentView: 'players',
    pages,
  });

  assert.equal(view, 'players');
  assert.equal(pages.generator.classList.contains('hidden'), true);
  assert.equal(pages.configuration.classList.contains('hidden'), true);
  assert.equal(pages.players.classList.contains('hidden'), false);
});

test('navigation controller syncs menu and button active state', () => {
  setup();

  const panel = createNode();
  const menuButton = createNode();
  let panelOpen = null;

  global.DSShellNavigationController.syncMenuVisibility({
    panel,
    menuButton,
    open: true,
    setPanelVisibility(_panel, open) {
      panelOpen = open;
    },
  });

  assert.equal(panelOpen, true);
  assert.equal(menuButton.getAttribute('aria-expanded'), 'true');

  const generatorButton = createNode();
  const playersButton = createNode();

  global.DSShellNavigationController.syncNavigationButtons({
    currentView: 'players',
    entries: [
      { view: 'generator', button: generatorButton },
      { view: 'players', button: playersButton },
    ],
  });

  assert.equal(generatorButton.classList.contains('active'), false);
  assert.equal(playersButton.classList.contains('active'), true);
  assert.equal(playersButton.getAttribute('aria-current'), 'page');
});
