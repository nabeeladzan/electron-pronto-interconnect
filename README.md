# Electron Pronto Interconnect

[![npm version](https://img.shields.io/npm/v/electron-pronto-interconnect.svg)](https://www.npmjs.com/package/electron-pronto-interconnect)
[![License](https://img.shields.io/npm/l/electron-pronto-interconnect.svg)](LICENSE)
Instant, synchronized React States for your Electron applications. Bridge the gap between your main process and renderer process with minimal setup and reactive state management.

## Why Electron Pronto Interconnect?

Managing state between Electron's main process and renderer process(es) can be cumbersome, often involving manual setup of IPC channels and boilerplate code. `electron-pronto-interconnect` simplifies this by providing:

* **Easy State Exposure**: Expose variables from your main process with a simple function call.
* **React Hooks**: Consume and update these variables in your React components using familiar hook patterns (`useState`-like).
* **Two-way Synchronization**: Changes in the renderer are reflected in the main process, and changes in the main process are broadcast to all listening renderers.
* **Type Safety**: Written in TypeScript to provide strong typing for your synchronized state.
* **Minimal Boilerplate**: Focus on your application logic, not on IPC plumbing.

## Features

* Expose variables from the main process to multiple renderer windows.
* Update main process variables from renderer components.
* Programmatically update variables from the main process and notify all renderers.
* Customizable setter logic in the main process when a variable is updated.
* `useIPC` and `useIPCState` React hooks for seamless state integration in renderer processes.
* Secure communication using Electron's `contextBridge` via a dedicated preload script.

## Prerequisites

* Electron >= 25.3.0 (as per `package.json`, adjust if flexible)
* React >= 18.2.0

## Installation
```bash
npm install electron-pronto-interconnect
```

## How it Works

1.  **Main Process**: You `expose` a variable from your Electron main process. This sets up IPC listeners for getting and setting this variable. You provide a setter function that dictates how the variable is updated in the main process's scope.
2.  **Preload Script**: The package provides a preload script that securely exposes IPC communication functions (`phaseSyncAPI`) to the renderer process using Electron's `contextBridge`.
3.  **Renderer Process**: In your React components, you use the `useIPC` or `useIPCState` hook. These hooks communicate with the main process via the exposed `phaseSyncAPI` to get the initial state and listen for updates. When you update the state using the hook's setter, the new value is sent to the main process.

## Usage

Here's how to set up and use `electron-pronto-interconnect`:

### 1. Main Process Setup

In your Electron main process file (e.g., `main.ts` or `main.js`):

```typescript
// main.ts
import { app, BrowserWindow } from 'electron';
import { expose, updateAndNotify } from 'electron-pronto-interconnect/manager';
// If you only need 'expose', you can also use the default export:
// import { expose } from 'electron-pronto-interconnect';
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

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            // Crucial: Path to the preload script provided by this package
            preload: path.join(__dirname, 'node_modules/electron-pronto-interconnect/dist/preload.js'),
            contextIsolation: true, // Recommended for security
            nodeIntegration: false,  // Recommended for security
        }
    });

    // Expose the 'theme' variable.
    // 'currentTheme' is its initial value.
    // 'mainProcessThemeSetter' is the callback to update it in the main process scope.
    expose<'light' | 'dark'>('theme', currentTheme, mainProcessThemeSetter);

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

**Important Note for Preload Script:** Ensure the `preload` path in `webPreferences` correctly points to `node_modules/electron-pronto-interconnect/dist/preload.js`. You might need to adjust this path based on your project structure or if you're using a bundler that copies assets.

### 2. Preload Script Setup (User-Managed)

`electron-pronto-interconnect` allows you to integrate its IPC bridge into your own custom Electron preload script. This gives you the flexibility to expose other APIs to your renderer process as needed.

**Steps:**

1. **Import `phaseSyncAPI` into Your Preload Script:**
    In your preload script, import the `phaseSyncAPI` object from `electron-pronto-interconnect`:

    ```typescript
    // In your project's preload.ts (e.g., src/preload.ts)
    import { contextBridge } from 'electron';
    import { phaseSyncAPI, type PhaseSyncAPI } from 'electron-pronto-interconnect/preload'; // Import from our package

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
    *(Ensure `PhaseSyncAPI` type is also exported from your package's `preload.ts` if users want to type their `window.phaseSync` object accurately, or they can define it themselves based on the `phaseSyncAPI` structure.)*

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

## API Reference

### Main Process (`electron-pronto-interconnect/manager`)

* **`expose<T>(variableName: string, initialValue: T, mainProcessSetter: (value: T) => void): void`**
    * Exposes a variable for synchronization.
    * `variableName`: Unique string identifier for the state.
    * `initialValue`: The starting value of the variable.
    * `mainProcessSetter`: A callback function that's executed in the main process when the variable's value is changed from a renderer or by `updateAndNotify`. This function is responsible for actually updating the variable in the main process's scope.

* **`updateAndNotify<T>(variableName: string, newValue: T): void`**
    * Allows the main process to programmatically update an exposed variable and notify all listening renderers.
    * `variableName`: The name of the variable to update.
    * `newValue`: The new value for the variable. This will also trigger the `mainProcessSetter` defined during `expose`.

### Preload (`electron-pronto-interconnect/preload`)

* Exposes `window.phaseSync` to the renderer, with the following methods:
    * `invoke<T>(channel: string, ...args: any[]): Promise<T>`
    * `send(channel: string, ...args: any[]): void`
    * `on<T = any>(channel: string, listener: (value: T) => void): () => void` (returns a cleanup function to remove the listener)

### Renderer (`electron-pronto-interconnect/renderer`)

* **`useIPC<T>(variableName: string, initialClientValue?: T): [T | undefined, (newValue: T) => void]`**
    * A React hook to synchronize with an Electron main process variable.
    * Returns `undefined` until the value is fetched from the main process, or if `initialClientValue` is not provided.
    * The setter function updates the state optimistically in the renderer and sends the new value to the main process.

* **`useIPCState<T>(variableName: string, defaultAndInitialValue: T): [T, (newValue: T) => void]`**
    * A stricter version of `useIPC`.
    * Requires a `defaultAndInitialValue` which is used as the initial state and as a fallback if the main process value is `undefined`.
    * Guarantees the returned state is always of type `T`.

## License

This project is licensed under the Apache-2.0 License - see the [LICENSE](LICENSE) file for details.

## Author

Muhammad Nabeel Adzan

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue.
(Consider adding more details here if you have specific contribution guidelines).

---

Keywords: electron, react, ipc, state management, react hooks, typescript