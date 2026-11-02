import {ipcRenderer, type IpcRendererEvent} from 'electron'

export interface PhaseSync {
    invoke: <T>(channel: string, ...args: any[]) => Promise<T>;
    send: (channel: string, ...args: any[]) => void;
    on: <T = any>(channel: string, listener: (value: T) => void) => () => void; // Returns a cleanup function
}

// Only channels owned by this library may cross the bridge. A generic
// invoke/send bridge handed to the renderer would let any script in the page
// reach every ipcMain handler in the app.
const ALLOWED_CHANNEL_PREFIXES = ['ipc-get-', 'ipc-set-', 'ipc-update-', 'ipc-errand-'];

function assertAllowedChannel(channel: string): void {
    if (!ALLOWED_CHANNEL_PREFIXES.some(prefix => channel.startsWith(prefix))) {
        throw new Error(
            `[pronto] Refusing channel "${channel}". phaseSync only bridges this library's channels ` +
            `(${ALLOWED_CHANNEL_PREFIXES.join(', ')}*). Expose your own API for anything else.`
        );
    }
}

export const phaseSyncAPI: PhaseSync = {
    invoke: <T>(channel: string, ...args: any[]): Promise<T> => {
        assertAllowedChannel(channel);
        return ipcRenderer.invoke(channel, ...args);
    },

    send: (channel: string, ...args: any[]): void => {
        assertAllowedChannel(channel);
        ipcRenderer.send(channel, ...args);
    },

    on: <T = any>(channel: string, listener: (value: T) => void): (() => void) => {
        assertAllowedChannel(channel);
        const eventListener = (_event: IpcRendererEvent, value: T) => listener(value);
        ipcRenderer.on(channel, eventListener);
        // Return a function to remove the listener
        return () => {
            ipcRenderer.removeListener(channel, eventListener);
        };
    },
};
