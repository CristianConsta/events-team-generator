const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const modulePath = path.resolve(__dirname, '../js/shell/bootstrap/app-shell-bootstrap.esm.mjs');

test('esm shell bootstrap boots app runtime initializer when available', async () => {
  global.window = global;
  let calls = 0;
  global.initializeApplicationUiRuntime = () => {
    calls += 1;
  };

  const mod = await import(`${pathToFileURL(modulePath).href}?test=${Date.now()}`);
  mod.bootApplication();

  assert.equal(calls, 1);
});

test('esm shell bootstrap tolerates missing initializer', async () => {
  global.window = global;
  delete global.initializeApplicationUiRuntime;

  const mod = await import(`${pathToFileURL(modulePath).href}?test=${Date.now()}-missing`);
  assert.doesNotThrow(() => mod.bootApplication());
});
