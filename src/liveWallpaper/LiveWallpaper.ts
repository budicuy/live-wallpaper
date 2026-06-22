import fs from 'node:fs';

import vscode, { type Disposable } from 'vscode';

import {
    CONFIG_SECTION,
    ENCODING,
    TOUCH_FILE_PATH,
    VERSION,
} from '../utils/constants';
import { vscodePath } from '../utils/vscodePath';
import { vsHelp } from '../utils/vsHelp';
import { EFilePatchType, HtmlPatchFile } from './PatchFile';
import { type LiveWallpaperConfig, PatchGenerator } from './PatchGenerator';

/** Default configuration values */
const DEFAULTS: Required<LiveWallpaperConfig> & { enabled: boolean } = {
    videoPath: '',
    opacity: 0.3,
    size: 'cover',
    loop: true,
    enabled: true,
};

/**
 * Main extension logic for Live Wallpaper.
 *
 * Manages the lifecycle of the video wallpaper patch applied to
 * VSCode's workbench.html file.
 */
export class LiveWallpaper implements Disposable {
    /** The HTML file we patch */
    public htmlFile = new HtmlPatchFile(vscodePath.workbenchHtmlPath);

    /** Subscriptions to dispose when extension deactivates */
    private disposables: Disposable[] = [];

    /** Current user configuration */
    public get config() {
        return vscode.workspace.getConfiguration(CONFIG_SECTION);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Write the touch file on first install.
     * The touch file records the workbench.html path so the uninstall hook
     * can clean up even when the VSCode API is unavailable.
     */
    private async checkFirstLoad(): Promise<boolean> {
        const firstLoad = !fs.existsSync(TOUCH_FILE_PATH);

        if (firstLoad) {
            await fs.promises.writeFile(
                TOUCH_FILE_PATH,
                vscodePath.workbenchHtmlPath,
                ENCODING,
            );
            return true;
        }

        return false;
    }

    /**
     * Build the LiveWallpaperConfig from current user settings,
     * normalizing the video path for the VSCode sandbox.
     */
    private buildConfig(): LiveWallpaperConfig & { enabled: boolean } {
        const cfg = this.config;

        const rawPath: string = cfg.get('videoPath') ?? '';
        const opacity: number = cfg.get('opacity') ?? DEFAULTS.opacity;
        const size: 'cover' | 'contain' | 'fill' | 'auto' =
            cfg.get('size') ?? DEFAULTS.size;
        const loop: boolean = cfg.get('loop') ?? DEFAULTS.loop;
        const enabled: boolean = cfg.get('enabled') ?? DEFAULTS.enabled;

        return {
            videoPath: vsHelp.normalizeVideoPath(rawPath),
            opacity: Math.min(0.5, Math.max(0.1, opacity)),
            size,
            loop,
            enabled,
        };
    }

    /**
     * Called when the user changes a setting in settings.json.
     * Prompts to apply the new config or disable.
     */
    private async onConfigChange(): Promise<void> {
        const hasInstalled = await this.hasInstalled();
        const { enabled } = this.buildConfig();

        if (!enabled) {
            if (hasInstalled) {
                vsHelp.reload({
                    message: 'Live Wallpaper will be disabled.',
                    btnReload: 'Disable and Reload',
                    beforeReload: () => this.uninstall(),
                });
            }
            return;
        }

        vsHelp.reload({
            message: 'Live Wallpaper: Configuration changed — click to apply.',
            btnReload: 'Apply and Reload',
            beforeReload: () => this.applyPatch(),
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Initialize the extension:
     *  1. Write touch file on first install
     *  2. Check if patch needs updating
     *  3. Start listening for config changes
     */
    public async setup(): Promise<void> {
        await this.checkFirstLoad();

        const patchType = await this.htmlFile.getPatchType();
        const { enabled, videoPath } = this.buildConfig();

        const needsUpdate = [
            EFilePatchType.Legacy,
            EFilePatchType.None,
        ].includes(patchType);

        if (enabled && videoPath && needsUpdate) {
            vscode.window
                .showInformationMessage(
                    `Live Wallpaper v${VERSION} is ready! Apply to activate the video background.`,
                    { title: 'Apply and Reload' },
                    { title: 'Skip' },
                )
                .then(async (choice) => {
                    if (choice?.title === 'Apply and Reload') {
                        await this.applyPatch();
                        await vscode.commands.executeCommand(
                            'workbench.action.reloadWindow',
                        );
                    }
                });
        }

        // Watch for configuration changes
        this.disposables.push(
            vscode.workspace.onDidChangeConfiguration((event) => {
                if (event.affectsConfiguration(CONFIG_SECTION)) {
                    this.onConfigChange();
                }
            }),
        );
    }

    /**
     * Apply the video wallpaper patch to workbench.html.
     * @returns true if the patch was written successfully
     */
    public async applyPatch(): Promise<boolean> {
        const config = this.buildConfig();

        if (!config.enabled) {
            return false;
        }

        if (!config.videoPath) {
            vscode.window.showWarningMessage(
                'Live Wallpaper: No video path set. Please configure `liveWallpaper.videoPath` in your settings.',
            );
            return false;
        }

        // Verify the workbench.html path is accessible
        const fs = await import('node:fs');
        if (!fs.existsSync(this.htmlFile.filePath)) {
            vscode.window.showErrorMessage(
                `Live Wallpaper: Cannot find VSCode workbench.html at:\n${this.htmlFile.filePath}\n\nPlease report this issue.`,
            );
            return false;
        }

        const script = PatchGenerator.create(config);
        return this.htmlFile.applyPatches(script);
    }

    /**
     * Check whether the patch is currently applied to workbench.html.
     */
    public hasInstalled(): Promise<boolean> {
        return this.htmlFile.hasPatched();
    }

    /**
     * Remove the wallpaper patch from workbench.html.
     * @returns true if the restore succeeded
     */
    public async uninstall(): Promise<boolean> {
        return this.htmlFile.restore();
    }

    /**
     * Reset all settings to their default values and remove the patch.
     */
    public async reset(): Promise<void> {
        const cfg = vscode.workspace.getConfiguration();
        await cfg.update(
            'liveWallpaper',
            undefined,
            vscode.ConfigurationTarget.Global,
        );
        await this.uninstall();
    }

    /** Release all subscriptions */
    public dispose(): void {
        this.disposables.forEach((d) => {
            d.dispose();
        });
    }
}
