"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useIPC = useIPC;
exports.useIPCState = useIPCState;
const react_1 = require("react");
/**
 * A React hook to synchronize state with an Electron main process variable.
 * @param variableName The unique name of the variable exposed in the main process.
 * @param initialClientValue An optional initial value for the client-side state before the main process value is fetched.
 * @returns A state tuple [value, setValue], similar to useState.
 */
function useIPC(variableName, initialClientValue) {
    const [value, setValue] = (0, react_1.useState)(initialClientValue);
    (0, react_1.useEffect)(() => {
        let isMounted = true; // Prevent state updates on unmounted component
        // Fetch initial value from main process
        window.phaseSync.invoke(`ipc-get-${variableName}`)
            .then(mainValue => {
            if (isMounted) {
                setValue(mainValue);
            }
        })
            .catch(err => {
            console.error(`[useIPC] Error fetching initial value for "${variableName}":`, err);
            // Optionally, keep initialClientValue or set to an error state
        });
        // Listen for updates pushed from the main process
        const removeUpdateListener = window.phaseSync.on(`ipc-update-${variableName}`, (newValueFromMain) => {
            if (isMounted) {
                setValue(newValueFromMain);
            }
        });
        // Cleanup listener when the component unmounts
        return () => {
            isMounted = false;
            removeUpdateListener();
        };
    }, [variableName]); // Re-run effect if variableName changes
    const setIPCValue = (0, react_1.useCallback)((newValue) => {
        setValue(newValue); // Optimistic update in renderer
        window.phaseSync.send(`ipc-set-${variableName}`, newValue);
    }, [variableName]);
    return [value, setIPCValue];
}
/**
 * A stricter version of useIPC that requires an initial default value
 * and guarantees the returned state is always of type T (not T | undefined).
 */
function useIPCState(variableName, defaultAndInitialValue) {
    const [value, setValue] = (0, react_1.useState)(defaultAndInitialValue);
    (0, react_1.useEffect)(() => {
        let isMounted = true;
        window.phaseSync.invoke(`ipc-get-${variableName}`)
            .then(mainValue => {
            if (isMounted) {
                // If mainValue is undefined (e.g., not yet set in main or error),
                // it will keep the defaultAndInitialValue thanks to useState's initial value.
                // Only update if main process provides a non-undefined value different from initial.
                if (mainValue !== undefined) {
                    setValue(mainValue);
                }
            }
        })
            .catch(err => {
            console.error(`[useIPCState] Error fetching initial value for "${variableName}":`, err);
        });
        const removeUpdateListener = window.phaseSync.on(`ipc-update-${variableName}`, (newValueFromMain) => {
            if (isMounted) {
                setValue(newValueFromMain);
            }
        });
        return () => {
            isMounted = false;
            removeUpdateListener();
        };
    }, [variableName, defaultAndInitialValue]); // defaultAndInitialValue added to deps if it can change
    const setIPCValue = (0, react_1.useCallback)((newValue) => {
        setValue(newValue);
        window.phaseSync.send(`ipc-set-${variableName}`, newValue);
    }, [variableName]);
    return [value, setIPCValue];
}
//# sourceMappingURL=renderer.js.map