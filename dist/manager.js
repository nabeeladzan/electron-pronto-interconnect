"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expose = expose;
exports.updateAndNotify = updateAndNotify;
exports.register = register;
const electron_1 = require("electron");
// A simple logger to control verbosity. Errors are always logged.
const logger = {
    info: (verbose, message, ...args) => {
        if (verbose) {
            console.log(message, ...args);
        }
    },
    warn: (verbose, message, ...args) => {
        if (verbose) {
            console.warn(message, ...args);
        }
    },
    error: (message, ...args) => {
        console.error(message, ...args);
    },
};
const exposedState = new Map();
const registeredFunctions = new Map();
/**
 * Exposes a variable from the main process to be used in renderer processes.
 * @param variableName The unique name for this variable.
 * @param initialValue The initial value of the variable.
 * @param mainProcessSetter A callback function that updates the variable in the main process's scope.
 * @param options Optional settings for the exposed variable, such as verbosity.
 */
function expose(variableName, initialValue, mainProcessSetter, options // Optional verbosity flag
) {
    const verbose = options?.verbose ?? false;
    if (exposedState.has(variableName)) {
        logger.warn(true, `[IPC State] Variable "${variableName}" is already exposed. Overwriting.`);
    }
    const variableEntry = {
        value: initialValue,
        mainProcessSetter,
        listeners: new Set(),
        verbose, // Store the verbosity flag
    };
    exposedState.set(variableName, variableEntry);
    // Handler for renderer to get the current/initial value
    electron_1.ipcMain.handle(`ipc-get-${variableName}`, (event) => {
        const entry = exposedState.get(variableName);
        if (entry) {
            logger.info(entry.verbose, `[IPC State] GET request for "${variableName}".`);
            const senderWebContents = event.sender;
            entry.listeners.add(senderWebContents);
            // Clean up listener when the window is closed/destroyed
            senderWebContents.once('destroyed', () => {
                entry.listeners.delete(senderWebContents);
            });
            return entry.value;
        }
        logger.warn(true, `[IPC State] GET request for unexposed variable "${variableName}".`);
        return undefined;
    });
    // Handler for renderer to set the value
    electron_1.ipcMain.on(`ipc-set-${variableName}`, (_event, newValue) => {
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
            }
            catch (error) {
                logger.error(`[IPC State] Error in mainProcessSetter for "${variableName}":`, error);
            }
        }
        else {
            logger.warn(true, `[IPC State] SET request for unexposed variable "${variableName}".`);
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
function updateAndNotify(variableName, newValue) {
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
        }
        catch (error) {
            logger.error(`[IPC State] Error in mainProcessSetter during updateAndNotify for "${variableName}":`, error);
        }
    }
    else {
        logger.warn(true, `[IPC State] updateAndNotify called for unexposed variable "${variableName}". You might need to expose it first.`);
    }
}
/**
 * Registers a function from the main process that can be invoked from renderer processes.
 * @param functionName The unique name for this function.
 * @param handler The async or sync function to execute when called from a renderer.
 * @param options Optional settings for the registered function, such as verbosity.
 */
function register(functionName, 
// eslint-disable-next-line @typescript-eslint/no-explicit-any
handler, options // Optional verbosity flag
) {
    const channel = `ipc-errand-${functionName}`; // Channel name updated for clarity
    const verbose = options?.verbose ?? false; // Default verbosity to false if not provided
    if (registeredFunctions.has(functionName)) {
        logger.warn(true, `[IPC Errand] Function "${functionName}" is already registered. Overwriting handler.`);
        // To truly overwrite, we must remove the old handler first.
        electron_1.ipcMain.removeHandler(channel);
    }
    registeredFunctions.set(functionName, {
        handler,
        verbose, // Store the verbosity flag
    });
    electron_1.ipcMain.handle(channel, async (_event, ...args) => {
        logger.info(verbose, `[IPC Errand] Received errand for "${functionName}" with args:`, args);
        try {
            // Await the handler in case it's async. If it's sync, it will resolve immediately.
            return await handler(...args);
        }
        catch (error) {
            logger.error(`[IPC Errand] Error executing function "${functionName}":`, error);
            // It's important to re-throw or return an error object so the renderer's promise rejects.
            throw error;
        }
    });
    logger.info(verbose, `[IPC Errand] Function "${functionName}" registered on channel "${channel}".`);
}
//# sourceMappingURL=manager.js.map