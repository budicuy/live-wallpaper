/**
 * Uninstall hook — runs when the extension is fully uninstalled.
 *
 * IMPORTANT:
 *  - The vscode API is NOT available here (runs outside extension host)
 *  - This file must NOT import from files that use the vscode module
 *  - All VSCode API uses must go through the `vsc` safe accessor
 *
 * This hook restores workbench.html to its original state so the video
 * wallpaper is removed even when the extension host cannot run cleanup.
 *
 * References:
 *  https://github.com/microsoft/vscode/issues/155561
 *  https://code.visualstudio.com/api/references/extension-manifest#extension-uninstall-hook
 */

import * as fs from 'node:fs';

// Import directly from source files — avoid re-exports that pull in vscode module
import { HtmlPatchFile } from './liveWallpaper/PatchFile/PatchFile.html';
import { ENCODING, TOUCH_FILE_PATH } from './utils/constants';

async function uninstall(): Promise<void> {
    try {
        // The touch file stores the workbench.html path recorded at install time
        const htmlPath = (
            await fs.promises.readFile(TOUCH_FILE_PATH, ENCODING)
        ).trim();

        if (!htmlPath) {
            console.log(
                'Live Wallpaper: No touch file content found — skipping cleanup.',
            );
            return;
        }

        await new HtmlPatchFile(htmlPath).restore();
        console.log('Live Wallpaper: workbench.html restored successfully.');
    } catch (ex) {
        const msg = ex instanceof Error ? ex.message : String(ex);
        console.error('Live Wallpaper: Uninstall cleanup failed —', msg);
    }
}

uninstall();
