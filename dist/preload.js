"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.phaseSyncAPI = void 0;
const electron_1 = require("electron");
// Only channels owned by this library may cross the bridge. A generic
// invoke/send bridge handed to the renderer would let any script in the page
// reach every ipcMain handler in the app.
const ALLOWED_CHANNEL_PREFIXES = ['ipc-get-', 'ipc-set-', 'ipc-update-', 'ipc-errand-'];
function assertAllowedChannel(channel) {
    if (!ALLOWED_CHANNEL_PREFIXES.some(prefix => channel.startsWith(prefix))) {
        throw new Error(`[pronto] Refusing channel "${channel}". phaseSync only bridges this library's channels ` +
            `(${ALLOWED_CHANNEL_PREFIXES.join(', ')}*). Expose your own API for anything else.`);
    }
}
exports.phaseSyncAPI = {
    invoke: (channel, ...args) => {
        assertAllowedChannel(channel);
        return electron_1.ipcRenderer.invoke(channel, ...args);
    },
    send: (channel, ...args) => {
        assertAllowedChannel(channel);
        electron_1.ipcRenderer.send(channel, ...args);
    },
    on: (channel, listener) => {
        assertAllowedChannel(channel);
        const eventListener = (_event, value) => listener(value);
        electron_1.ipcRenderer.on(channel, eventListener);
        // Return a function to remove the listener
        return () => {
            electron_1.ipcRenderer.removeListener(channel, eventListener);
        };
    },
};
//# sourceMappingURL=preload.js.map