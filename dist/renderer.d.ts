import { PhaseSync } from "./preload";
declare global {
    interface Window {
        phaseSync: PhaseSync;
    }
}
/**
 * A React hook to synchronize state with an Electron main process variable.
 * @param variableName The unique name of the variable exposed in the main process.
 * @param initialClientValue An optional initial value for the client-side state before the main process value is fetched.
 * @returns A state tuple [value, setValue], similar to useState.
 */
export declare function useIPC<T>(variableName: string, initialClientValue?: T): [T | undefined, (newValue: T) => void];
/**
 * A stricter version of useIPC that requires an initial default value
 * and guarantees the returned state is always of type T (not T | undefined).
 */
export declare function useIPCState<T>(variableName: string, defaultAndInitialValue: T): [T, (newValue: T) => void];
