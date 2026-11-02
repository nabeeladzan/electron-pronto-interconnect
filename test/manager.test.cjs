const test = require('node:test');
const assert = require('node:assert/strict');

const {stubElectron} = require('./helpers.cjs');

const electron = stubElectron();
const {expose, updateAndNotify, register} = require('../dist/manager.js');

function makeWebContents() {
    const sent = [];
    return {
        sent,
        isDestroyed: () => false,
        send: (channel, value) => sent.push([channel, value]),
        once: () => {},
    };
}

test('expose registers one GET handler and one SET listener', () => {
    expose('expose-once', 'light', () => {});

    assert.equal(typeof electron.ipcMain.handlers.get('ipc-get-expose-once'), 'function');
    assert.equal(electron.ipcMain.listeners.get('ipc-set-expose-once').length, 1);
});

test('GET returns the current value and subscribes the renderer', () => {
    const webContents = makeWebContents();
    expose('get-value', 42, () => {});

    assert.equal(electron.ipcMain.handlers.get('ipc-get-get-value')({sender: webContents}), 42);
});

test('re-expose replaces the handlers instead of throwing, subscribers survive', () => {
    const webContents = makeWebContents();
    const setters = [];

    expose('re-expose', 'light', (value) => setters.push(['first', value]));
    // A renderer subscribes by doing a GET.
    electron.ipcMain.handlers.get('ipc-get-re-expose')({sender: webContents});

    // This used to throw "Attempted to register a second handler".
    assert.doesNotThrow(() => expose('re-expose', 'light', (value) => setters.push(['second', value])));

    const setHandlers = electron.ipcMain.listeners.get('ipc-set-re-expose');
    assert.equal(setHandlers.length, 1, 'exactly one SET listener after re-expose');
    setHandlers[0]({}, 'dark');

    assert.deepEqual(setters.at(-1), ['second', 'dark']);
    assert.deepEqual(webContents.sent.at(-1), ['ipc-update-re-expose', 'dark']);
});

test('SET from a renderer runs the setter and broadcasts the new value', () => {
    const webContents = makeWebContents();
    const setters = [];

    expose('set-value', 'light', (value) => setters.push(value));
    electron.ipcMain.handlers.get('ipc-get-set-value')({sender: webContents});
    electron.ipcMain.listeners.get('ipc-set-set-value')[0]({}, 'dark');

    assert.deepEqual(setters, ['dark']);
    assert.deepEqual(webContents.sent.at(-1), ['ipc-update-set-value', 'dark']);
});

test('updateAndNotify pushes to subscribed renderers', () => {
    const webContents = makeWebContents();

    expose('notify-value', 1, () => {});
    electron.ipcMain.handlers.get('ipc-get-notify-value')({sender: webContents});
    updateAndNotify('notify-value', 2);

    assert.deepEqual(webContents.sent.at(-1), ['ipc-update-notify-value', 2]);
});

test('register replaces an existing errand handler', async () => {
    register('ping', () => 'first');
    register('ping', () => 'second');

    const handler = electron.ipcMain.handlers.get('ipc-errand-ping');
    assert.equal(await handler({}), 'second');
});
