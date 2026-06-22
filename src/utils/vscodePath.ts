import fs from 'fs';
import path from 'path';

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
    const mainFilename = require.main?.filename;
    if (mainFilename?.length) {
        return path.dirname(mainFilename);
    }
    // appRoot = …/resources/app  →  base = …/resources/app/out
    const appRoot = vsc?.env.appRoot;
    if (appRoot) {
        return path.join(appRoot, 'out');
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
    workbenchHtmlPath
};
