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
    opacity: 0.1,
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

    /** Current user configuration — reads the whole flat object */
    private getRawConfig(): Record<string, unknown> {
        const cfg = vscode.workspace.getConfiguration();
        return cfg.get<Record<string, unknown>>(CONFIG_SECTION) ?? {};
    }

    /** Write the full config object back to settings.json */
    private async writeConfig(values: Record<string, unknown>): Promise<void> {
        const cfg = vscode.workspace.getConfiguration();
        await cfg.update(
            CONFIG_SECTION,
            values,
            vscode.ConfigurationTarget.Global,
        );
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
        const raw = this.getRawConfig();

        const rawPath = typeof raw.videoPath === 'string' ? raw.videoPath : '';
        const opacity =
            typeof raw.opacity === 'number' ? raw.opacity : DEFAULTS.opacity;
        const size =
            typeof raw.size === 'string' &&
            ['cover', 'contain', 'fill', 'auto'].includes(raw.size)
                ? (raw.size as LiveWallpaperConfig['size'])
                : DEFAULTS.size;
        const loop = typeof raw.loop === 'boolean' ? raw.loop : DEFAULTS.loop;
        const enabled =
            typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULTS.enabled;

        return {
            videoPath: vsHelp.normalizeVideoPath(rawPath),
            // Clamp user value to [0.1, 1.0] then scale to max 80% CSS opacity
            // so the UI stays readable even at the maximum setting.
            opacity:
                Math.round(Math.min(1.0, Math.max(0.1, opacity)) * 0.8 * 100) /
                100,
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
     *  2. If disabled but patch still exists → silently remove and reload
     *  3. If enabled and patch needs updating → prompt to apply
     *  4. Start listening for config changes
     */
    public async setup(): Promise<void> {
        await this.checkFirstLoad();

        const patchType = await this.htmlFile.getPatchType();
        const hasInstalled = await this.hasInstalled();
        const { enabled, videoPath } = this.buildConfig();

        // ── Safety net: patch is in workbench.html but enabled=false ──────────
        // Normally the disable command removes the patch before reloading.
        // This guard handles edge cases where the patch lingers (e.g. VSCode
        // self-update overwrites workbench.html and then restores it, or the
        // user manually set enabled=false in settings.json).
        // We silently remove it here — no extra reload needed because this
        // runs on the current boot before the UI is fully painted.
        if (!enabled && hasInstalled) {
            await this.uninstall();
            return;
        }

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
        await this.writeConfig(undefined as unknown as Record<string, unknown>);
        await this.uninstall();
    }

    /**
     * Merge a partial update into the existing flat config object.
     * Used by commands that only need to change one field (e.g. enabled).
     */
    public async updateConfig(
        patch: Partial<LiveWallpaperConfig & { enabled: boolean }>,
    ): Promise<void> {
        const current = this.getRawConfig();
        await this.writeConfig({ ...current, ...patch });
    }

    /** Release all subscriptions */
    public dispose(): void {
        this.disposables.forEach((d) => {
            d.dispose();
        });
    }
}
