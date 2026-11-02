const path = require('node:path');
const Module = require('node:module');

/**
 * Redirects `require('electron')` to the local stub, so `dist/*.js` can be
 * loaded in a plain Node process. Must be called before requiring `dist`.
 */
function stubElectron() {
    const stubPath = path.join(__dirname, 'stubs', 'electron.cjs');
    const originalResolveFilename = Module._resolveFilename;

    Module._resolveFilename = function (request, ...rest) {
        if (request === 'electron') {
            return stubPath;
        }
        return originalResolveFilename.call(this, request, ...rest);
    };

    return require(stubPath);
}

module.exports = {stubElectron};
