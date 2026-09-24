// Temporary diagnostic: inspect env + initializeTestEnvironment inside node --test.
const test = require('node:test');
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const fs = require('node:fs');
const path = require('node:path');

test.before(async () => {
    console.log('PROBE-TEST: FIRESTORE_EMULATOR_HOST =', process.env.FIRESTORE_EMULATOR_HOST);
    console.log('PROBE-TEST: FIREBASE_EMULATOR_HUB =', process.env.FIREBASE_EMULATOR_HUB);
    try {
        await initializeTestEnvironment({
            projectId: 'demo-desert-storm-generator',
            firestore: { rules: fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8') },
        });
        console.log('PROBE-TEST: initializeTestEnvironment OK');
    } catch (err) {
        console.error('PROBE-TEST FAILED:', err && err.stack ? err.stack : err);
    }
});

test('dummy probe', () => {});
