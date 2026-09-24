// Temporary diagnostic: reproduce initializeTestEnvironment and surface the exact error.
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const fs = require('node:fs');
const path = require('node:path');

const RULES_PATH = path.resolve(__dirname, '../../firestore.rules');

console.log('PROBE: env FIREBASE_EMULATOR_HUB =', process.env.FIREBASE_EMULATOR_HUB);
console.log('PROBE: env FIRESTORE_EMULATOR_HOST =', process.env.FIRESTORE_EMULATOR_HOST);

initializeTestEnvironment({
    projectId: 'demo-desert-storm-generator',
    firestore: {
        rules: fs.readFileSync(RULES_PATH, 'utf8'),
    },
})
    .then(async (env) => {
        console.log('PROBE: initializeTestEnvironment OK');
        await env.cleanup();
        process.exit(0);
    })
    .catch((err) => {
        console.error('PROBE FAILED:', err && err.stack ? err.stack : err);
        console.error('PROBE message:', err && err.message ? err.message : String(err));
        process.exit(1);
    });
