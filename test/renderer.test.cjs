const test = require('node:test');
const assert = require('node:assert/strict');

global.IS_REACT_ACT_ENVIRONMENT = true;

const React = require('react');
const TestRenderer = require('react-test-renderer');
const {act} = TestRenderer;

const {useIPC, useIPCState, errand} = require('../dist/renderer.js');

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Replaces window.phaseSync with a bridge whose GET responses are resolved
 * manually, so tests can control ordering (late responses, pushes, clicks).
 */
function installBridge() {
    const calls = {invoke: [], send: [], on: []};
    const handlers = new Map();
    const deferred = [];

    globalThis.window = {
        phaseSync: {
            invoke(channel, ...args) {
                calls.invoke.push([channel, ...args]);
                return new Promise((resolve) => deferred.push(resolve));
            },
            send(channel, ...args) {
                calls.send.push([channel, ...args]);
            },
            on(channel, listener) {
                calls.on.push(channel);
                handlers.set(channel, listener);
                return () => handlers.delete(channel);
            },
        },
    };

    return {calls, handlers, deferred};
}

async function render(Component) {
    let renderer;
    await act(async () => {
        renderer = TestRenderer.create(React.createElement(Component));
    });
    return renderer;
}

test('useIPCState shows the default, then hydrates from the main process', async () => {
    const {calls, deferred} = installBridge();
    let latest;
    function Comp() {
        latest = useIPCState('hydrate', 'light');
        return null;
    }

    await render(Comp);
    assert.equal(latest[0], 'light');
    assert.equal(calls.invoke.length, 1);

    await act(async () => {
        deferred[0]('dark');
        await flush();
    });
    assert.equal(latest[0], 'dark');
});

test('a local set is not reverted by a late initial GET', async () => {
    const {calls, deferred} = installBridge();
    let latest;
    function Comp() {
        latest = useIPCState('race', 'light');
        return null;
    }

    await render(Comp);

    // The user clicks while the GET is still in flight.
    await act(async () => {
        latest[1]('dark');
    });

    // The response to the earlier GET arrives afterwards.
    await act(async () => {
        deferred[0]('light');
        await flush();
    });

    assert.equal(latest[0], 'dark');
    assert.deepEqual(calls.send.at(-1), ['ipc-set-race', 'dark']);
});

test('a pushed update is not overwritten by a late initial GET', async () => {
    const {deferred, handlers} = installBridge();
    let latest;
    function Comp() {
        latest = useIPCState('push', 'light');
        return null;
    }

    await render(Comp);

    await act(async () => {
        handlers.get('ipc-update-push')('blue');
    });
    await act(async () => {
        deferred[0]('light');
        await flush();
    });

    assert.equal(latest[0], 'blue');
});

test('an inline object default does not trigger repeated fetches', async () => {
    const {calls} = installBridge();
    function Prefs() {
        useIPCState('prefs', {theme: 'light'});
        return null;
    }

    let renderer;
    await act(async () => {
        renderer = TestRenderer.create(React.createElement(Prefs));
    });
    await act(async () => {
        renderer.update(React.createElement(Prefs));
    });
    await act(async () => {
        renderer.update(React.createElement(Prefs));
    });

    assert.equal(calls.invoke.length, 1);
});

test('useIPC uses initialClientValue until the main process answers', async () => {
    const {deferred} = installBridge();
    let latest;
    function Comp() {
        latest = useIPC('seed', 'fallback');
        return null;
    }

    await render(Comp);
    assert.equal(latest[0], 'fallback');

    await act(async () => {
        deferred[0]('main');
        await flush();
    });
    assert.equal(latest[0], 'main');
});

test('errand invokes the function channel and resolves with its result', async () => {
    const {calls, deferred} = installBridge();

    const promise = errand('open-file', 'arg');
    assert.deepEqual(calls.invoke[0], ['ipc-errand-open-file', 'arg']);

    deferred[0]('file.txt');
    assert.equal(await promise, 'file.txt');
});
