import {ipcRenderer, type IpcRendererEvent} from 'electron'

export interface PhaseSync {
    invoke: <T>(channel: string, ...args: any[]) => Promise<T>;
    send: (channel: string, ...args: any[]) => void;
    on: <T = any>(channel: string, listener: (value: T) => void) => () => void; // Returns a cleanup function
}

export const phaseSyncAPI: PhaseSync = {
    invoke: <T>(channel: string, ...args: any[]): Promise<T> =>
        ipcRenderer.invoke(channel, ...args),

    send: (channel: string, ...args: any[]): void =>
        ipcRenderer.send(channel, ...args),

    on: <T = any>(channel: string, listener: (value: T) => void): (() => void) => {
        const eventListener = (_event: IpcRendererEvent, value: T) => listener(value);
        ipcRenderer.on(channel, eventListener);
        // Return a function to remove the listener
        return () => {
            ipcRenderer.removeListener(channel, eventListener);
        };
    },
};