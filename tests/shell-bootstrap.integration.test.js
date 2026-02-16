const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const modulePath = path.resolve(__dirname, '../js/shell/bootstrap/app-shell-bootstrap.js');

function resetModule() {
  delete require.cache[require.resolve(modulePath)];
}

function resetGlobals() {
  delete global.window;
  delete global.document;
  delete global.DSAppShellBootstrap;
  delete global.initializeApplicationUiRuntime;
}

test.afterEach(() => {
  resetModule();
  resetGlobals();
});

test('shell bootstrap registers DOMContentLoaded and invokes app runtime initializer', () => {
  global.window = global;

  let domContentLoadedHandler = null;
  global.document = {
    addEventListener(eventName, handler) {
      if (eventName === 'DOMContentLoaded') {
        domContentLoadedHandler = handler;
      }
    },
  };

  let initializeCalls = 0;
  global.initializeApplicationUiRuntime = () => {
    initializeCalls += 1;
  };

  require(modulePath);

  assert.equal(typeof global.DSAppShellBootstrap.boot, 'function');
  assert.equal(typeof domContentLoadedHandler, 'function');

  domContentLoadedHandler();
  assert.equal(initializeCalls, 1);

  global.DSAppShellBootstrap.boot();
  assert.equal(initializeCalls, 2);
});

test('shell bootstrap tolerates missing app runtime initializer', () => {
  global.window = global;
  global.document = {
    addEventListener() {},
  };

  require(modulePath);

  assert.doesNotThrow(() => {
    global.DSAppShellBootstrap.boot();
  });
});
