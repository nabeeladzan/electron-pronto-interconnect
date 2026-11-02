# Electron Pronto Interconnect

![Static Badge](https://img.shields.io/badge/GitHub-Repo-blue?logo=gutgyv&link=https%3A%2F%2Fgithub.com%2Fnabeeladzan%2Felectron-pronto-interconnect)
![NPM Downloads](https://img.shields.io/npm/dm/electron-pronto-interconnect)
[![npm version](https://img.shields.io/npm/v/electron-pronto-interconnect.svg)](https://www.npmjs.com/package/electron-pronto-interconnect)
[![License](https://img.shields.io/npm/l/electron-pronto-interconnect.svg)](LICENSE)

[//]: # (breakline)
Instant, synchronized React States for your Electron applications. Bridge the gap between your main process and renderer process with minimal setup and reactive state management.

## Why Electron Pronto Interconnect?

Managing state between Electron's main process and renderer process(es) can be cumbersome, often involving manual setup of IPC channels and boilerplate code. `electron-pronto-interconnect` simplifies this by providing:

* **Easy State Exposure**: Expose variables from your main process with a simple function call.
* **React Hooks**: Consume and update these variables in your React components using familiar hook patterns (`useState`-like).
* **Two-way Synchronization**: Changes in the renderer are reflected in the main process, and changes in the main process are broadcast to all listening renderers.
* **Promise-based RPC**: Securely expose main process functions and call them from the renderer with a clean async/await pattern.
* **Type Safety**: Written in TypeScript to provide strong typing for your synchronized state.
* **Minimal Boilerplate**: Focus on your application logic, not on IPC plumbing.

## Features

* Expose variables from the main process to multiple renderer windows.
* Update main process variables from renderer components.
* Programmatically update variables from the main process and notify all renderers.
* Expose main process functions to be called from the renderer, returning a Promise with the result.
* Customizable setter logic in the main process when a variable is updated.
* `useIPC` and `useIPCState` React hooks for seamless state integration in renderer processes.
* `errand` helper function for clean, `async/await` based function calls.
* Optional verbose logging on a per-state or per-function basis for easier debugging.
* Secure communication using Electron's `contextBridge` via a dedicated preload script.

## Prerequisites

This package is designed for use with Electron applications that utilize React. It requires:
* **Electron**: Version 24.0.0 or higher.
* **React**: Version 17.0.0 or higher.

## Installation
```bash
npm install electron-pronto-interconnect
```

## How it Works

This library provides two primary communication patterns:

1. *State Synchronization*: You expose a variable from your main process. The renderer uses the useIPCState hook, which communicates with the main process to get the initial state and listen for updates. When you update the state using the hook's setter, the new value is sent to the main process.
2. *Remote Procedure Call (RPC)*: You register a function in your main process. The renderer can then errand this function. This sends an invoke request to the main process and returns a Promise, allowing for a clean async/await workflow to get results back.

Both patterns rely on a Preload Script to securely expose the necessary IPC communication functions (phaseSyncAPI) to the renderer process using Electron's contextBridge.

1.  **Main Process**: You `expose` a variable from your Electron main process. This sets up IPC listeners for getting and setting this variable. You provide a setter function that dictates how the variable is updated in the main process's scope.
2.  **Preload Script**: The package provides a preload script that securely exposes IPC communication functions (`phaseSyncAPI`) to the renderer process using Electron's `contextBridge`.
3.  **Renderer Process**: In your React components, you use the `useIPC` or `useIPCState` hook. These hooks communicate with the main process via the exposed `phaseSyncAPI` to get the initial state and listen for updates. When you update the state using the hook's setter, the new value is sent to the main process.

## Usage

Here's how to set up and use `electron-pronto-interconnect`:

### 1. Main Process Setup

In your Electron main process file (e.g., `main.ts` or `main.js`):

```typescript
// main.ts
import { app, BrowserWindow, dialog } from 'electron';
import { expose, register, updateAndNotify } from 'electron-pronto-interconnect/manager';
import path from 'path';

// Example: Managing a global theme state
let currentTheme: 'light' | 'dark' = 'light';

// This function is called when the 'theme' variable is updated from any renderer
// or via updateAndNotify.
const mainProcessThemeSetter = (newTheme: 'light' | 'dark') => {
    console.log(`[Main Process] Theme changed from ${currentTheme} to ${newTheme}`);
    currentTheme = newTheme;
    // Add any other logic, like saving to a file or updating other main process state.
};

// --- RPC (Function Call) Example ---
const openFile = async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({});
    if (canceled || filePaths.length === 0) {
        return null; // Return null if the user cancels
    }
    return filePaths[0];
};

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            // Your own preload script, which exposes phaseSync (see "Preload Script Setup" below)
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true, // Recommended for security
            nodeIntegration: false,  // Recommended for security
        }
    });

    // Expose the 'theme' variable.
    // 'currentTheme' is its initial value.
    // 'mainProcessThemeSetter' is the callback to update it in the main process scope.
    expose<'light' | 'dark'>('theme', currentTheme, mainProcessThemeSetter);

    // Register the 'open-file' function so the renderer can call it.
    // This one will be silent by default.
    register('open-file', openFile);
    
    mainWindow.loadFile('index.html'); // Your renderer's HTML file

    // Example: Programmatically update the theme from the main process after 5 seconds
    setTimeout(() => {
        if (currentTheme !== 'dark') {
            console.log('[Main Process] Programmatically updating theme to dark.');
            updateAndNotify<'light' | 'dark'>('theme', 'dark');
        }
    }, 5000);
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});
```

**Important Note for the Preload Script:** `webPreferences.preload` must point at **your own compiled preload script**. The package's `dist/preload.js` only exports the bridge (`phaseSyncAPI`); it does not put anything on `window`. Exposing it yourself is also required under Electron's default `sandbox: true`, where a preload script cannot `require` local files unless your build bundles them.

### 2. Preload Script Setup

`electron-pronto-interconnect` lets you integrate its IPC bridge into your own custom Electron preload script. This gives you the flexibility to expose other APIs to your renderer process as needed.

**Steps:**

1. **Import `phaseSyncAPI` into Your Preload Script:**
    In your preload script, import the `phaseSyncAPI` object from `electron-pronto-interconnect`:

    ```typescript
    // In your project's preload.ts (e.g., src/preload.ts)
    import { contextBridge } from 'electron';
    import { phaseSyncAPI, type PhaseSync } from 'electron-pronto-interconnect/preload'; // Import from our package

    // You can define other APIs you want to expose here
    const myCustomAPI = {
        getAppVersion: () => '1.2.3',
        doSomethingElse: (data: any) => console.log('Custom API called with:', data),
    };

    // Expose the phaseSyncAPI for electron-pronto-interconnect
    contextBridge.exposeInMainWorld('phaseSync', phaseSyncAPI);

    // Expose your other custom APIs
    contextBridge.exposeInMainWorld('myCustomAPI', myCustomAPI);

    console.log('Preload script executed, phaseSync and myCustomAPI exposed.');
    ```
    *(The `PhaseSync` type describes the exposed object; use it to type `window.phaseSync` in the renderer, as shown in step 3.)*

2. **Configure Your `BrowserWindow`:**
    In your Electron main process file, ensure the `webPreferences.preload` option points to **your compiled preload script**.

    ```typescript
    // In your project's main.ts
    import { app, BrowserWindow } from 'electron';
    import path from 'path';

    function createWindow() {
        const mainWindow = new BrowserWindow({
            width: 800,
            height: 600,
            webPreferences: {
                // Point to YOUR OWN compiled preload script
                preload: path.join(__dirname, 'preload.js'), // Adjust path as needed
                contextIsolation: true,  // Crucial for contextBridge security
                nodeIntegration: false, // Recommended for renderer security
            }
        });
        // ...
        mainWindow.loadFile('index.html');
    }

    app.whenReady().then(createWindow);
    // ...
    ```
    Make sure that `path.join(__dirname, 'preload.js')` correctly resolves to the output location of your compiled preload script (e.g., if your `preload.ts` is in `src/`, and your `outDir` in `tsconfig.json` is `dist/`, then the path might be `path.join(__dirname, 'dist/preload.js')` relative to your compiled main process file).

**Why this approach?**

* **Flexibility:** You control what's exposed to your renderer and under what names.
* **Centralization:** All your `contextBridge` exposures are in one place (your preload script).
* **Security:** You maintain control over the security boundary between your main process and renderer.

Remember to have `contextIsolation: true` in your `webPreferences`, as `contextBridge` relies on it.

### 3. Renderer Process (React Component)

In your React components, use the `useIPC` or `useIPCState` hooks:

```tsx
// src/components/ThemeSwitcher.tsx
import React from 'react';
import { useIPCState } from 'electron-pronto-interconnect/renderer';

// Define the type for your shared state for clarity
type Theme = 'light' | 'dark';

function ThemeSwitcher(): JSX.Element {
    // 'theme' is the variableName you used in `expose` in the main process.
    // 'light' is the initial default value for the React state.
    // The hook will fetch the actual value from the main process.
    const [currentTheme, setCurrentTheme] = useIPCState<Theme>('theme', 'light');

    const toggleTheme = () => {
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        setCurrentTheme(newTheme); // This will update the main process via IPC
    };

    return (
        <div>
            <p>Current application theme: <strong>{currentTheme}</strong></p>
            <button onClick={toggleTheme}>
                Switch to {currentTheme === 'light' ? 'Dark' : 'Light'} Mode
            </button>
        </div>
    );
}

export default ThemeSwitcher;
```

And ensure your renderer declares the global `phaseSync` type (optional, but good for TypeScript):

```typescript
// src/renderer.d.ts or a global type definition file

// Import the PhaseSync interface from the package's preload types
import type { PhaseSync } from 'electron-pronto-interconnect/preload';

declare global {
    interface Window {
        phaseSync: PhaseSync;
    }
}
```

### 4. Using RPC (Remote Procedure Call)
In your renderer, you can call functions registered in the main process using the `errand` function:

```tsx
// src/components/FileManager.tsx
import React, { useState } from 'react';
import { errand } from 'electron-pronto-interconnect/renderer';

function FileManager(): JSX.Element {
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleOpenFile = async () => {
        try {
            setError(null);
            // Call the main process function and wait for the result
            const filePath = await errand<string | null>('open-file');
            
            if (filePath) {
                setSelectedFile(filePath);
            } else {
                // User cancelled the dialog
                setSelectedFile('User cancelled.');
            }
        } catch (err) {
            // This will catch errors if the function fails in the main process
            console.error('Failed to open file dialog:', err);
            setError('An error occurred while opening the file.');
        }
    };

    return (
        <div>
            <button onClick={handleOpenFile}>Open a File</button>
            {selectedFile && <p>Selected: <strong>{selectedFile}</strong></p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
    );
}

export default FileManager;
```

## API Reference

### Main Process (`electron-pronto-interconnect/manager`)

-   **`expose<T>(variableName: string, initialValue: T, mainProcessSetter: (value: T) => void, options?: { verbose?: boolean }): void`**

    Exposes a variable for synchronization.

    -   `variableName`: Unique string identifier for the state.
    -   `initialValue`: The starting value of the variable.
    -   `mainProcessSetter`: A callback function that's executed in the main process when the variable's value is changed from a renderer or by `updateAndNotify`. This function is responsible for actually updating the variable in the main process's scope.
    -   `options?`: Optional. If `verbose` is `true`, logs GET/SET events for this variable to the console. Defaults to `false`.

-   **`updateAndNotify<T>(variableName: string, newValue: T): void`**

    Allows the main process to programmatically update an exposed variable and notify all listening renderers. Logging for this action is controlled by the `verbose` option set during the initial `expose`.

-   **`register(functionName: string, handler: (...args: any[]) => any, options?: { verbose?: boolean }): void`**

    Registers a main process function so it can be called from a renderer.

    -   `functionName`: Unique string identifier for the function.
    -   `handler`: The `async` or `sync` function to execute. Its return value will be sent back to the renderer.
    -   `options?`: Optional. If `verbose` is `true`, logs when this function is called. Defaults to `false`.

### Preload (`electron-pronto-interconnect/preload`)

-   Exports `phaseSyncAPI` (type `PhaseSync`) for you to expose as `window.phaseSync`. It bridges only this library's channels — `ipc-get-*`, `ipc-set-*`, `ipc-update-*`, `ipc-errand-*` — and throws for any other channel, so exposing it does not open the rest of your IPC surface to the page.
    -   `invoke<T>(channel: string, ...args: any[]): Promise<T>`
    -   `send(channel: string, ...args: any[]): void`
    -   `on<T = any>(channel: string, listener: (value: T) => void): () => void` (returns a cleanup function to remove the listener)

### Renderer (`electron-pronto-interconnect/renderer`)

If the value was already changed locally, or pushed from the main process, while the initial `invoke` was still in flight, that response is discarded instead of overwriting the newer value.

-   **`useIPC<T>(variableName: string, initialClientValue?: T): [T | undefined, (newValue: T) => void]`**

    A React hook to synchronize with an Electron main process variable. Returns `undefined` until the value is fetched from the main process, or if `initialClientValue` is not provided. The setter function updates the state optimistically in the renderer and sends the new value to the main process.

-   **`useIPCState<T>(variableName: string, defaultAndInitialValue: T): [T, (newValue: T) => void]`**

    A stricter version of `useIPC`. Requires a `defaultAndInitialValue` which is used as the initial state and as a fallback if the main process value is `undefined`. Guarantees the returned state is always of type `T`.

-   **`errand<T>(functionName: string, ...args: unknown[]): Promise<T>`**

    Calls a function registered in the main process.

    -   `functionName`: The name of the function to call.
    -   `...args`: Any arguments to pass to the main process function.
    -   Returns: A `Promise` that resolves with the value returned by the handler in the main process, or rejects if an error occurs.

## Development

```bash
npm install
npm run build   # compile src/ -> dist/
npm test        # build, then run the test suite
```

The tests run the compiled output against a stubbed `electron` module, so no Electron runtime is needed.

## License

This project is licensed under the Apache-2.0 License - see the [LICENSE](LICENSE) file for details.

## Author

Muhammad Nabeel Adzan

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue.
(Consider adding more details here if you have specific contribution guidelines).

---

Keywords: electron, react, ipc, state management, react hooks, typescript, rpc, remote procedure call, main process, async