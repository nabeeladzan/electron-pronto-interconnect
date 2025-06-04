export interface PhaseSync {
    invoke: <T>(channel: string, ...args: any[]) => Promise<T>;
    send: (channel: string, ...args: any[]) => void;
    on: <T = any>(channel: string, listener: (value: T) => void) => () => void;
}
export declare const phaseSyncAPI: PhaseSync;
