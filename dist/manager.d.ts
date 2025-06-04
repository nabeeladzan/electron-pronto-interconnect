/**
 * Exposes a variable from the main process to be used in renderer processes.
 * @param variableName The unique name for this variable.
 * @param initialValue The initial value of the variable.
 * @param mainProcessSetter A callback function that updates the variable in the main process's scope.
 */
export declare function expose<T>(variableName: string, initialValue: T, mainProcessSetter: (value: T) => void): void;
/**
 * Allows the main process to programmatically update an exposed variable
 * and notify all listening renderers.
 * @param variableName The name of the variable to update.
 * @param newValue The new value for the variable.
 */
export declare function updateAndNotify<T>(variableName: string, newValue: T): void;
