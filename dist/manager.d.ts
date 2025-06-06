/**
 * Exposes a variable from the main process to be used in renderer processes.
 * @param variableName The unique name for this variable.
 * @param initialValue The initial value of the variable.
 * @param mainProcessSetter A callback function that updates the variable in the main process's scope.
 * @param options Optional settings for the exposed variable, such as verbosity.
 */
export declare function expose<T>(variableName: string, initialValue: T, mainProcessSetter: (value: T) => void, options?: {
    verbose?: boolean;
}): void;
/**
 * Allows the main process to programmatically update an exposed variable
 * and notify all listening renderers.
 * @param variableName The name of the variable to update.
 * @param newValue The new value for the variable.
 */
export declare function updateAndNotify<T>(variableName: string, newValue: T): void;
/**
 * Registers a function from the main process that can be invoked from renderer processes.
 * @param functionName The unique name for this function.
 * @param handler The async or sync function to execute when called from a renderer.
 * @param options Optional settings for the registered function, such as verbosity.
 */
export declare function register(functionName: string, handler: (...args: any[]) => any, options?: {
    verbose?: boolean;
}): void;
