import {useCallback, useEffect, useRef, useState} from 'react';
import {PhaseSync} from "./preload";

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
export function useIPC<T>(
    variableName: string,
    initialClientValue?: T
): [T | undefined, (newValue: T) => void] {
    const [value, setValue] = useState<T | undefined>(initialClientValue);
    // Counts value changes applied since mount. A GET issued before such a
    // change is stale by definition and must not overwrite the newer value.
    const appliedUpdates = useRef(0);

    useEffect(() => {
        let isMounted = true; // Prevent state updates on unmounted component
        const updatesAtRequest = appliedUpdates.current;

        // Fetch initial value from main process
        window.phaseSync.invoke<T>(`ipc-get-${variableName}`)
            .then(mainValue => {
                if (!isMounted || appliedUpdates.current !== updatesAtRequest) {
                    return; // A local set or a pushed update landed first.
                }
                setValue(mainValue);
            })
            .catch(err => {
                console.error(`[useIPC] Error fetching initial value for "${variableName}":`, err);
                // Optionally, keep initialClientValue or set to an error state
            });

        // Listen for updates pushed from the main process
        const removeUpdateListener = window.phaseSync.on<T>(
            `ipc-update-${variableName}`,
            (newValueFromMain) => {
                if (isMounted) {
                    appliedUpdates.current += 1;
                    setValue(newValueFromMain);
                }
            }
        );

        // Cleanup listener when the component unmounts
        return () => {
            isMounted = false;
            removeUpdateListener();
        };
    }, [variableName]); // Re-run effect if variableName changes

    const setIPCValue = useCallback((newValue: T) => {
        appliedUpdates.current += 1; // Invalidate a GET that is still in flight.
        setValue(newValue); // Optimistic update in renderer
        window.phaseSync.send(`ipc-set-${variableName}`, newValue);
    }, [variableName]);

    return [value, setIPCValue];
}

/**
 * A stricter version of useIPC that requires an initial default value
 * and guarantees the returned state is always of type T (not T | undefined).
 */
export function useIPCState<T>(
    variableName: string,
    defaultAndInitialValue: T
): [T, (newValue: T) => void] {
    const [value, setValue] = useState<T>(defaultAndInitialValue);
    const appliedUpdates = useRef(0);

    useEffect(() => {
        let isMounted = true;
        const updatesAtRequest = appliedUpdates.current;

        window.phaseSync.invoke<T>(`ipc-get-${variableName}`)
            .then(mainValue => {
                if (!isMounted || appliedUpdates.current !== updatesAtRequest) {
                    return; // A local set or a pushed update landed first.
                }
                // If mainValue is undefined (e.g., not yet set in main or error),
                // it will keep the defaultAndInitialValue thanks to useState's initial value.
                // Only update if main process provides a non-undefined value different from initial.
                if (mainValue !== undefined) {
                    setValue(mainValue);
                }
            })
            .catch(err => {
                console.error(`[useIPCState] Error fetching initial value for "${variableName}":`, err);
            });

        const removeUpdateListener = window.phaseSync.on<T>(
            `ipc-update-${variableName}`,
            (newValueFromMain) => {
                if (isMounted) {
                    appliedUpdates.current += 1;
                    setValue(newValueFromMain);
                }
            }
        );

        return () => {
            isMounted = false;
            removeUpdateListener();
        };
    }, [variableName]); // defaultAndInitialValue is only the initial state, so it is not a dependency

    const setIPCValue = useCallback((newValue: T) => {
        appliedUpdates.current += 1; // Invalidate a GET that is still in flight.
        setValue(newValue);
        window.phaseSync.send(`ipc-set-${variableName}`, newValue);
    }, [variableName]);

    return [value, setIPCValue];
}

/**
 * Runs a registered function (an "errand") in the main process and returns its result.
 * @param functionName The unique name of the function registered in the main process.
 * @param args Any arguments to pass to the main process function.
 * @returns A Promise that resolves with the return value from the main process function.
 */
export function errand<T>(functionName: string, ...args: unknown[]): Promise<T> {
    const channel = `ipc-errand-${functionName}`; // Use the matching channel prefix
    return window.phaseSync.invoke<T>(channel, ...args);
}