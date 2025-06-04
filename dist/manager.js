"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expose = expose;
exports.updateAndNotify = updateAndNotify;
const electron_1 = require("electron");
const exposedState = new Map();
/**
 * Exposes a variable from the main process to be used in renderer processes.
 * @param variableName The unique name for this variable.
 * @param initialValue The initial value of the variable.
 * @param mainProcessSetter A callback function that updates the variable in the main process's scope.
 */
function expose(variableName, initialValue, mainProcessSetter) {
    if (exposedState.has(variableName)) {
        console.warn(`[IPC State] Variable "${variableName}" is already exposed. Overwriting.`);
    }
    const variableEntry = {
        value: initialValue,
        mainProcessSetter,
        listeners: new Set(),
    };
    exposedState.set(variableName, variableEntry);
    // Handler for renderer to get the current/initial value
    electron_1.ipcMain.handle(`ipc-get-${variableName}`, (event) => {
        const entry = exposedState.get(variableName);
        if (entry) {
            const senderWebContents = event.sender;
            entry.listeners.add(senderWebContents);
            // Clean up listener when the window is closed/destroyed
            senderWebContents.once('destroyed', () => {
                entry.listeners.delete(senderWebContents);
            });
            return entry.value;
        }
        console.warn(`[IPC State] GET request for unexposed variable "${variableName}".`);
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
                console.error(`[IPC State] Error in mainProcessSetter for "${variableName}":`, error);
            }
        }
        else {
            console.warn(`[IPC State] SET request for unexposed variable "${variableName}".`);
        }
    });
    console.log(`[IPC State] Variable "${variableName}" exposed.`);
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
            console.error(`[IPC State] Error in mainProcessSetter during updateAndNotify for "${variableName}":`, error);
        }
    }
    else {
        console.warn(`[IPC State] updateAndNotify called for unexposed variable "${variableName}". You might need to expose it first.`);
    }
}
//# sourceMappingURL=manager.js.map