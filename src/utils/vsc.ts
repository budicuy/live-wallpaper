/**
 * Safe accessor for the vscode API.
 *
 * When the uninstall hook runs (`vscode:uninstall`), the vscode module is
 * unavailable because it runs outside the extension host. All other code
 * paths have access to vscode.
 */
let vsc: typeof import('vscode') | undefined;

try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    vsc = require('vscode');
} catch {
    vsc = undefined;
}

export { vsc };
