// Minimal Electron stand-in, used so the compiled package can be tested with
// plain Node. Only the surfaces this library touches are implemented.
const ipcMain = {
    handlers: new Map(),
    listeners: new Map(),

    handle(channel, handler) {
        if (this.handlers.has(channel)) {
            // Mirrors the real ipcMain behaviour that `expose` has to avoid.
            throw new Error(`Attempted to register a second handler for '${channel}'`);
        }
        this.handlers.set(channel, handler);
    },

    removeHandler(channel) {
        this.handlers.delete(channel);
    },

    on(channel, handler) {
        const handlers = this.listeners.get(channel) ?? [];
        handlers.push(handler);
        this.listeners.set(channel, handlers);
    },

    removeAllListeners(channel) {
        this.listeners.delete(channel);
    },
};

const ipcRenderer = {
    invoke: async (channel, ...args) => ({channel, args}),
    send() {},
    on() {},
    removeListener() {},
};

const contextBridge = {
    exposeInMainWorld() {},
};

module.exports = {ipcMain, ipcRenderer, contextBridge};
