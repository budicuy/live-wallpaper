import fs from 'node:fs';
import path from 'node:path';

import { _ } from './index';
import { vsc } from './vsc';

/**
 * Resolve the base "out" directory of the running VSCode instance.
 *
 * Strategy (in order of preference):
 *  1. `require.main?.filename` — available in some VSCode setups
 *  2. `vscode.env.appRoot` — always available in the extension host; points to
 *     the app root (one level above "out")
 *
 * On desktop: …/resources/app/out
 * On code-server: …/vscode/out
 */
const base = (() => {
    // 1. In extension host, vsc.env.appRoot is the official, guaranteed path (points to resources/app)
    const appRoot = vsc?.env.appRoot;
    if (appRoot) {
        return path.join(appRoot, 'out');
    }
    // 2. Fallback when vsc is not available (e.g. uninstall script running in standalone Node)
    const mainFilename = require.main?.filename;
    if (mainFilename?.length) {
        const normalized = mainFilename.replace(/\\/g, '/');
        const outIdx = normalized.lastIndexOf('/out');
        if (outIdx !== -1) {
            return mainFilename.substring(0, outIdx + 4);
        }
        return path.dirname(mainFilename);
    }
    return '';
})();

/**
 * Candidates for workbench.html path on desktop VSCode.
 *
 * VSCode has used different sub-paths across versions:
 *  - electron-browser  (older / current stable)
 *  - electron-sandbox  (newer builds)
 *
 * We probe both and return the first one that exists.
 */
function resolveDesktopHtmlPath(outDir: string): string {
    const candidates = [
        path.join(outDir, 'vs/code/electron-browser/workbench/workbench.html'),
        path.join(outDir, 'vs/code/electron-sandbox/workbench/workbench.html'),
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    // Return the first candidate as fallback (error will surface later with a clear message)
    return candidates[0];
}

const workbenchHtmlPath = (() => {
    if (_.isDesktop) {
        return resolveDesktopHtmlPath(base);
    }
    // code-server / browser
    return path.join(base, 'vs/code/browser/workbench/workbench.html');
})();

export const vscodePath = {
    /** Base "out" directory of the VSCode installation */
    base,

    /** Root directory of this extension */
    extRoot: path.join(__dirname, '../../'),

    /** Path to workbench.html */
    workbenchHtmlPath,
};
