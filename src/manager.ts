import {ipcMain} from 'electron';

// A simple logger to control verbosity. Errors are always logged.
const logger = {
    info: (verbose: boolean, message: string, ...args: unknown[]) => {
        if (verbose) {
            console.log(message, ...args);
        }
    },
    warn: (verbose: boolean, message: string, ...args: unknown[]) => {
        if (verbose) {
            console.warn(message, ...args);
        }
    },
    error: (message: string, ...args: unknown[]) => {
        console.error(message, ...args);
    },
};

interface ExposedVariable<T> {
    value: T; // The synchronized value
    mainProcessSetter: (newValue: T) => void; // Function to update the variable in main.ts scope
    listeners: Set<Electron.WebContents>; // Renderer windows listening for updates
    verbose: boolean; // Optional verbosity flag for logging
}

interface RegisteredFunction {
    handler: (...args: any[]) => any;
    verbose: boolean; // <-- Add verbose flag
}

const exposedState = new Map<string, ExposedVariable<any>>();
const registeredFunctions = new Map<string, RegisteredFunction>();

// Windows that already have a 'destroyed' listener. One listener per window is
// enough; attaching one per (window, variable) pair triggers
// MaxListenersExceededWarning in apps with many exposed variables.
const monitoredWindows = new Set<Electron.WebContents>();

function handleWindowDestroyed(webContents: Electron.WebContents): void {
    monitoredWindows.delete(webContents);
    // Drop the window from every exposed variable's listener set.
    exposedState.forEach((variableEntry) => {
        variableEntry.listeners.delete(webContents);
    });
}

/**
 * Exposes a variable from the main process to be used in renderer processes.
 * @param variableName The unique name for this variable.
 * @param initialValue The initial value of the variable.
 * @param mainProcessSetter A callback function that updates the variable in the main process's scope.
 * @param options Optional settings for the exposed variable, such as verbosity.
 */
export function expose<T>(
    variableName: string,
    initialValue: T,
    mainProcessSetter: (value: T) => void,
    options?: { verbose?: boolean } // Optional verbosity flag
): void {
    const verbose = options?.verbose ?? false;

    if (exposedState.has(variableName)) {
        logger.warn(true, `[IPC State] Variable "${variableName}" is already exposed. Replacing the previous registration.`);
        // Replace the previous handlers; re-registering would make ipcMain.handle
        // throw "Attempted to register a second handler". This happens in practice
        // when a window is recreated (e.g. macOS 'activate' or a dev-server reload).
        ipcMain.removeHandler(`ipc-get-${variableName}`);
        ipcMain.removeAllListeners(`ipc-set-${variableName}`);
    }

    const previousEntry = exposedState.get(variableName);

    const variableEntry: ExposedVariable<T> = {
        value: initialValue,
        mainProcessSetter,
        // Keep existing subscribers across a re-expose so open windows keep
        // receiving updates without having to GET again.
        listeners: previousEntry?.listeners ?? new Set(),
        verbose, // Store the verbosity flag
    };
    exposedState.set(variableName, variableEntry);

    // Handler for renderer to get the current/initial value
    ipcMain.handle(`ipc-get-${variableName}`, (event) => {
        const entry = exposedState.get(variableName);
        if (entry) {
            logger.info(entry.verbose, `[IPC State] GET request for "${variableName}".`);
            const senderWebContents = event.sender;
            entry.listeners.add(senderWebContents);
            // Attach the cleanup listener at most once per window.
            if (!monitoredWindows.has(senderWebContents)) {
                monitoredWindows.add(senderWebContents);
                senderWebContents.once('destroyed', () => {
                    handleWindowDestroyed(senderWebContents);
                });
            }
            return entry.value;
        }
        logger.warn(true, `[IPC State] GET request for unexposed variable "${variableName}".`);
        return undefined;
    });

    // Handler for renderer to set the value
    ipcMain.on(`ipc-set-${variableName}`, (_event, newValue: T) => {
        const entry = exposedState.get(variableName);
        if (entry) {
            try {
                entry.mainProcessSetter(newValue); // Update variable in main.ts scope
                entry.value = newValue; // Update the synchronized value in our manager

                // Broadcast the change to all listening renderers
                entry.listeners.forEach(listenerWebContents => {
                    if (!listenerWebContents.isDestroyed()) {
                        listenerWebContents.send(`ipc-update-${variableName}`, entry.value);
                    }
                });
            } catch (error) {
                logger.error(`[IPC State] Error in mainProcessSetter for "${variableName}":`, error);
            }
        } else {
            logger.warn(true,`[IPC State] SET request for unexposed variable "${variableName}".`);
        }
    });

    logger.info(verbose, `[IPC State] Variable "${variableName}" exposed.`);
}

/**
 * Allows the main process to programmatically update an exposed variable
 * and notify all listening renderers.
 * @param variableName The name of the variable to update.
 * @param newValue The new value for the variable.
 */
export function updateAndNotify<T>(variableName: string, newValue: T): void {
    const entry = exposedState.get(variableName);
    if (entry) {
        try {
            entry.mainProcessSetter(newValue); // Update variable in main.ts scope
            entry.value = newValue; // Update the synchronized value

            entry.listeners.forEach(listenerWebContents => {
                if (!listenerWebContents.isDestroyed()) {
                    listenerWebContents.send(`ipc-update-${variableName}`, entry.value);
                }
            });
        } catch (error) {
            logger.error(`[IPC State] Error in mainProcessSetter during updateAndNotify for "${variableName}":`, error);
        }
    } else {
        logger.warn(true,`[IPC State] updateAndNotify called for unexposed variable "${variableName}". You might need to expose it first.`);
    }
}

/**
 * Registers a function from the main process that can be invoked from renderer processes.
 * @param functionName The unique name for this function.
 * @param handler The async or sync function to execute when called from a renderer.
 * @param options Optional settings for the registered function, such as verbosity.
 */
export function register(
    functionName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: (...args: any[]) => any,
    options?: { verbose?: boolean } // Optional verbosity flag
): void {
    const channel = `ipc-errand-${functionName}`; // Channel name updated for clarity
    const verbose = options?.verbose ?? false; // Default verbosity to false if not provided

    if (registeredFunctions.has(functionName)) {
        logger.warn(true, `[IPC Errand] Function "${functionName}" is already registered. Overwriting handler.`);
        // To truly overwrite, we must remove the old handler first.
        ipcMain.removeHandler(channel);
    }

    registeredFunctions.set(functionName, {
        handler,
        verbose, // Store the verbosity flag
    });

    ipcMain.handle(channel, async (_event, ...args) => {
        logger.info(verbose, `[IPC Errand] Received errand for "${functionName}" with args:`, args);
        try {
            // Await the handler in case it's async. If it's sync, it will resolve immediately.
            return await handler(...args);
        } catch (error) {
            logger.error(`[IPC Errand] Error executing function "${functionName}":`, error);
            // It's important to re-throw or return an error object so the renderer's promise rejects.
            throw error;
        }
    });

    logger.info(verbose, `[IPC Errand] Function "${functionName}" registered on channel "${channel}".`);
}