import { pathToFileURL } from 'url';

import vscode from 'vscode';

class ReloadOptions {
    /** Notification message shown to the user */
    message = '';
    /** Text on the reload button */
    btnReload = 'Reload VSCode';
    /** Async action to run before the window reloads */
    beforeReload?: () => Promise<any> | any;
}

export const vsHelp = {
    /**
     * Prompt the user to reload VSCode, optionally running a pre-reload action.
     */
    async reload(options: Partial<ReloadOptions> = {}): Promise<void> {
        const opts = { ...new ReloadOptions(), ...options };

        if (opts.message) {
            const confirmed = await vscode.window.showInformationMessage(opts.message, {
                title: opts.btnReload
            });
            if (!confirmed) {
                return;
            }
            await opts.beforeReload?.();
        }

        return vscode.commands.executeCommand('workbench.action.reloadWindow');
    },

    /**
     * Normalize a user-supplied video path to the `vscode-file://` protocol
     * required by the VSCode sandbox (enforced since v1.51.1).
     *
     * Supports:
     *   - Absolute paths  (/home/user/video.mp4, C:\Users\user\video.mp4)
     *   - file:// URLs    (file:///home/user/video.mp4)
     *   - Already vscode-file:// URLs (returned as-is)
     *
     * Result format:
     *   vscode-file://vscode-app/<absolute-path>
     */
    normalizeVideoPath(rawPath: string): string {
        if (!rawPath || !rawPath.trim()) {
            return '';
        }

        const trimmed = rawPath.trim();

        // Already using vscode-file:// → return as-is
        if (trimmed.startsWith('vscode-file://')) {
            return trimmed;
        }

        try {
            let fileUrl: string;

            if (trimmed.startsWith('file://')) {
                fileUrl = trimmed;
            } else {
                // Convert absolute path (Linux, macOS, Windows) to file:// URL
                fileUrl = pathToFileURL(trimmed).href;
            }

            // Convert file:// → vscode-file://vscode-app
            // file:///home/user/video.mp4  →  vscode-file://vscode-app/home/user/video.mp4
            // file:///C:/Users/user/video.mp4  →  vscode-file://vscode-app/C:/Users/user/video.mp4
            const vsCodeFileUrl = fileUrl.replace(/^file:\/\//, 'vscode-file://vscode-app');
            return vscode.Uri.parse(vsCodeFileUrl).toString();
        } catch {
            return '';
        }
    }
};
