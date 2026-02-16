const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const shellContractsPath = path.resolve(__dirname, '../js/shell/bootstrap/app-shell-contracts.js');
const stateContractPath = path.resolve(__dirname, '../js/shared/state/state-store-contract.js');
const dataContractPath = path.resolve(__dirname, '../js/shared/data/data-gateway-contract.js');

function reset(modulePath) {
  delete require.cache[require.resolve(modulePath)];
}

function setupWindow() {
  global.window = global;
}

test('shell contracts create feature controller lifecycle defaults', () => {
  setupWindow();
  delete global.DSAppShellContracts;
  reset(shellContractsPath);
  require(shellContractsPath);

  const controller = global.DSAppShellContracts.createFeatureController({
    init() {
      return 'ok';
    },
  });

  assert.equal(typeof controller.init, 'function');
  assert.equal(typeof controller.bind, 'function');
  assert.equal(typeof controller.render, 'function');
  assert.equal(typeof controller.dispose, 'function');
  assert.equal(controller.init(), 'ok');
  assert.doesNotThrow(() => controller.bind());
  assert.doesNotThrow(() => controller.render());
  assert.doesNotThrow(() => controller.dispose());
});

test('state store contract wraps missing methods safely', () => {
  setupWindow();
  delete global.DSStateStoreContract;
  reset(stateContractPath);
  require(stateContractPath);

  const contract = global.DSStateStoreContract.createStateStoreContract({
    getState() {
      return { value: 1 };
    },
  });

  assert.deepEqual(contract.getState(), { value: 1 });
  assert.doesNotThrow(() => contract.setState({ value: 2 }));
  const unsubscribe = contract.subscribe(() => {});
  assert.equal(typeof unsubscribe, 'function');
});

test('data gateway contract validates required method surface', () => {
  setupWindow();
  delete global.DSDataGatewayContract;
  reset(dataContractPath);
  require(dataContractPath);

  const incomplete = global.DSDataGatewayContract.validateDataGatewayShape({
    isAvailable() {},
    isSignedIn() {},
  });
  assert.equal(incomplete.ok, false);
  assert.equal(incomplete.missing.length > 0, true);

  const fullGateway = {};
  Object.values(global.DSDataGatewayContract.DATA_GATEWAY_METHODS).forEach((methods) => {
    methods.forEach((methodName) => {
      fullGateway[methodName] = function noop() {};
    });
  });

  const complete = global.DSDataGatewayContract.validateDataGatewayShape(fullGateway);
  assert.deepEqual(complete, { ok: true, missing: [] });
});
