import vscode from 'vscode';

import { LiveWallpaper } from './liveWallpaper';
import { EXTENSION_ID } from './utils/constants';
import { vsHelp } from './utils/vsHelp';

/**
 * Create and show the status bar item that provides quick access to commands.
 */
function createStatusBar(): vscode.StatusBarItem {
    const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    item.command = 'liveWallpaper.showCommands';
    item.name = 'Live Wallpaper';
    item.text = '$(play-circle) Live Wallpaper';
    item.tooltip = 'Show Live Wallpaper commands';
    item.show();
    return item;
}

/**
 * Extension activation entry point.
 * Called once when VSCode starts (onStartupFinished).
 *
 * IMPORTANT: Commands are registered FIRST before any async work,
 * so they are always available even if setup() encounters an error.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const wallpaper = new LiveWallpaper();
    context.subscriptions.push(wallpaper);

    // ── Commands — registered immediately so they are always available ─────

    /** Apply the wallpaper patch and reload */
    context.subscriptions.push(
        vscode.commands.registerCommand('liveWallpaper.apply', async () => {
            await wallpaper.config.update('enabled', true, vscode.ConfigurationTarget.Global);
            const ok = await wallpaper.applyPatch();
            if (ok) {
                await vsHelp.reload();
            }
        })
    );

    /** Disable the wallpaper and reload */
    context.subscriptions.push(
        vscode.commands.registerCommand('liveWallpaper.disable', async () => {
            await wallpaper.config.update('enabled', false, vscode.ConfigurationTarget.Global);
            await wallpaper.uninstall();
            await vsHelp.reload();
        })
    );

    /** Reset all settings to defaults, remove patch, and reload */
    context.subscriptions.push(
        vscode.commands.registerCommand('liveWallpaper.reset', async () => {
            const confirm = await vscode.window.showWarningMessage(
                'Live Wallpaper: Reset all settings to defaults and remove the wallpaper?',
                { title: 'Reset and Reload' },
                { title: 'Cancel' }
            );

            if (confirm?.title === 'Reset and Reload') {
                await wallpaper.reset();
                await vsHelp.reload();
            }
        })
    );

    /** Uninstall the extension entirely */
    context.subscriptions.push(
        vscode.commands.registerCommand('liveWallpaper.uninstall', async () => {
            const confirm = await vscode.window.showWarningMessage(
                'Live Wallpaper: Uninstall extension? The wallpaper patch will be removed.',
                { title: 'Uninstall' },
                { title: 'Cancel' }
            );

            if (confirm?.title === 'Uninstall') {
                await wallpaper.uninstall();
                await vscode.commands.executeCommand(
                    'workbench.extensions.uninstallExtension',
                    EXTENSION_ID
                );
                vsHelp.reload({ message: 'Live Wallpaper has been uninstalled. Goodbye! 👋' });
            }
        })
    );

    /** Open quick-pick with all Live Wallpaper commands */
    const statusBar = createStatusBar();
    context.subscriptions.push(statusBar);
    context.subscriptions.push(
        vscode.commands.registerCommand('liveWallpaper.showCommands', () => {
            vscode.commands.executeCommand('workbench.action.quickOpen', '>Live Wallpaper: ');
        })
    );

    /** Create Template Setup */
    context.subscriptions.push(
        vscode.commands.registerCommand('liveWallpaper.createTemplate', async () => {
            const cfg = vscode.workspace.getConfiguration();
            await cfg.update(
                'liveWallpaper',
                {
                    videoPath: '/absolute/path/to/your/wallpaper.mp4',
                    opacity: 0.3,
                    size: 'cover',
                    enabled: true,
                    loop: true
                },
                vscode.ConfigurationTarget.Global
            );
            await vscode.commands.executeCommand('workbench.action.openSettingsJson');
            vscode.window.showInformationMessage(
                'Live Wallpaper: Setup template created in settings.json! Please update the videoPath.'
            );
        })
    );

    // ── Setup — runs after commands are registered ─────────────────────────
    // Wrap in try-catch so a setup error never prevents commands from working.
    try {
        await wallpaper.setup();
    } catch (err: any) {
        vscode.window.showErrorMessage(
            `Live Wallpaper: Failed to initialize — ${err?.message ?? err}. ` +
            `You can still use the Apply / Disable commands manually.`
        );
    }
}

/** Called when the extension is deactivated */
export function deactivate(): void {}
