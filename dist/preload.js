"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.phaseSyncAPI = void 0;
const electron_1 = require("electron");
exports.phaseSyncAPI = {
    invoke: (channel, ...args) => electron_1.ipcRenderer.invoke(channel, ...args),
    send: (channel, ...args) => electron_1.ipcRenderer.send(channel, ...args),
    on: (channel, listener) => {
        const eventListener = (_event, value) => listener(value);
        electron_1.ipcRenderer.on(channel, eventListener);
        // Return a function to remove the listener
        return () => {
            electron_1.ipcRenderer.removeListener(channel, eventListener);
        };
    },
};
//# sourceMappingURL=preload.js.map