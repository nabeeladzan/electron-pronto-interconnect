const test = require('node:test');
const assert = require('node:assert/strict');

const {stubElectron} = require('./helpers.cjs');

stubElectron();
const {phaseSyncAPI} = require('../dist/preload.js');

test('bridges the channels owned by this library', async () => {
    assert.deepEqual(await phaseSyncAPI.invoke('ipc-get-theme', 'arg'), {
        channel: 'ipc-get-theme',
        args: ['arg'],
    });
    assert.doesNotThrow(() => phaseSyncAPI.send('ipc-set-theme', 'dark'));
    assert.doesNotThrow(() => phaseSyncAPI.on('ipc-update-theme', () => {}));
});

test('rejects channels it does not own', () => {
    for (const channel of ['my-app-secret', 'ipc-unknown', 'ipc-errand']) {
        assert.throws(() => phaseSyncAPI.send(channel), /Refusing channel/);
        assert.throws(() => phaseSyncAPI.invoke(channel), /Refusing channel/);
        assert.throws(() => phaseSyncAPI.on(channel, () => {}), /Refusing channel/);
    }
});
