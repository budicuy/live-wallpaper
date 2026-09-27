import vscode from 'vscode';
import type { LiveWallpaper } from '../liveWallpaper';
import { CONFIG_SECTION } from '../utils/constants';
import { vsHelp } from '../utils/vsHelp';

interface WallpaperSettings {
    videoPath: string;
    opacity: number;
    size: 'cover' | 'contain' | 'fill' | 'auto';
    enabled: boolean;
    loop: boolean;
}

const DEFAULT_SETTINGS: WallpaperSettings = {
    videoPath: '',
    opacity: 0.1,
    size: 'cover',
    enabled: true,
    loop: true,
};

/**
 * Provides the sidebar Webview View for configuring Live Wallpaper.
 */
export class LiveWallpaperViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'liveWallpaper.settingsView';

    private view?: vscode.WebviewView;

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly wallpaper: LiveWallpaper,
    ) {
        // Listen for configuration changes made externally (e.g. settings.json or command palette)
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration(CONFIG_SECTION)) {
                this.sendState();
            }
        });
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ): void {
        this.view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri],
        };

        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

        this.setWebviewMessageListener(webviewView);
    }

    /** Read configuration directly from VS Code workspace */
    private getSettings(): WallpaperSettings {
        const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
        return {
            videoPath:
                config.get<string>('videoPath') ?? DEFAULT_SETTINGS.videoPath,
            opacity: config.get<number>('opacity') ?? DEFAULT_SETTINGS.opacity,
            size:
                config.get<WallpaperSettings['size']>('size') ??
                DEFAULT_SETTINGS.size,
            enabled: config.get<boolean>('enabled') ?? DEFAULT_SETTINGS.enabled,
            loop: config.get<boolean>('loop') ?? DEFAULT_SETTINGS.loop,
        };
    }

    /** Send updated state to the webview */
    private async sendState(): Promise<void> {
        if (!this.view) {
            return;
        }
        const settings = this.getSettings();
        const hasInstalled = await this.wallpaper.hasInstalled();

        this.view.webview.postMessage({
            type: 'state',
            settings,
            isPatched: hasInstalled,
        });
    }

    /** Handle incoming messages from the webview */
    private setWebviewMessageListener(webviewView: vscode.WebviewView): void {
        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'ready': {
                    await this.sendState();
                    break;
                }

                case 'browseVideo': {
                    const selected = await vscode.window.showOpenDialog({
                        canSelectFiles: true,
                        canSelectFolders: false,
                        canSelectMany: false,
                        filters: {
                            'Video Files (*.mp4, *.webm)': [
                                'mp4',
                                'webm',
                                'mov',
                                'mkv',
                            ],
                            'All Files': ['*'],
                        },
                        title: 'Select Live Wallpaper Video',
                        openLabel: 'Select Video',
                    });

                    if (selected?.[0]) {
                        const filePath = selected[0].fsPath;
                        webviewView.webview.postMessage({
                            type: 'videoSelected',
                            path: filePath,
                        });
                    }
                    break;
                }

                case 'apply': {
                    const settings: WallpaperSettings = message.settings;
                    await this.wallpaper.updateConfig({
                        videoPath: settings.videoPath,
                        opacity: settings.opacity,
                        size: settings.size,
                        enabled: settings.enabled,
                        loop: settings.loop,
                    });

                    if (!settings.enabled) {
                        await this.wallpaper.uninstall();
                        await vsHelp.reload({
                            message: 'Live Wallpaper disabled.',
                            btnReload: 'Reload VSCode',
                        });
                        return;
                    }

                    if (!settings.videoPath) {
                        vscode.window.showWarningMessage(
                            'Live Wallpaper: Please specify or browse for a video path first.',
                        );
                        return;
                    }

                    const ok = await this.wallpaper.applyPatch();
                    if (ok) {
                        await vsHelp.reload({
                            message: 'Live Wallpaper settings applied!',
                            btnReload: 'Reload to Activate',
                        });
                    }
                    break;
                }

                case 'disable': {
                    await this.wallpaper.updateConfig({ enabled: false });
                    await this.wallpaper.uninstall();
                    await vsHelp.reload({
                        message: 'Live Wallpaper has been disabled.',
                        btnReload: 'Reload Window',
                    });
                    break;
                }

                case 'reset': {
                    const confirm = await vscode.window.showWarningMessage(
                        'Live Wallpaper: Reset all settings to defaults and remove the wallpaper?',
                        { title: 'Reset and Reload' },
                        { title: 'Cancel' },
                    );

                    if (confirm?.title === 'Reset and Reload') {
                        await this.wallpaper.reset();
                        await vsHelp.reload();
                    }
                    break;
                }

                case 'openSettings': {
                    await vscode.commands.executeCommand(
                        'workbench.action.openSettingsJson',
                    );
                    break;
                }
            }
        });
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        const cspSource = webview.cspSource;
        const iconUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'icon.png'),
        );

        return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource}; style-src ${cspSource} 'unsafe-inline'; script-src 'unsafe-inline';">
    <title>Live Wallpaper Configuration</title>
    <style>
        :root {
            --lw-spacing: 12px;
            --lw-radius: 4px;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size, 13px);
            color: var(--vscode-foreground);
            background-color: transparent;
            padding: 14px;
            line-height: 1.4;
            user-select: none;
        }

        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border, rgba(128, 128, 128, 0.2));
        }

        .header-title {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--vscode-sideBarTitle-foreground, inherit);
        }

        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            font-size: 11px;
            padding: 2px 8px;
            border-radius: 12px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            font-weight: 600;
        }

        .status-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background-color: #888;
        }

        .status-dot.active {
            background-color: #4caf50;
            box-shadow: 0 0 6px #4caf50;
        }

        .form-group {
            margin-bottom: 16px;
        }

        label {
            display: block;
            margin-bottom: 6px;
            font-weight: 600;
            color: var(--vscode-foreground);
            font-size: 12px;
        }

        .hint {
            font-size: 11px;
            color: var(--vscode-descriptionForeground, #888);
            margin-top: 4px;
        }

        .input-group {
            display: flex;
            gap: 6px;
        }

        input[type="text"], select {
            width: 100%;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border, transparent);
            padding: 6px 8px;
            border-radius: var(--lw-radius);
            font-family: inherit;
            font-size: 12px;
            outline: none;
        }

        input[type="text"]:focus, select:focus {
            border-color: var(--vscode-focusBorder);
        }

        button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            cursor: pointer;
            border: none;
            padding: 6px 12px;
            border-radius: var(--lw-radius);
            font-size: 12px;
            font-family: inherit;
            font-weight: 500;
            transition: background 0.15s ease;
        }

        .btn-primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            width: 100%;
            padding: 8px 12px;
            font-weight: 600;
            margin-top: 4px;
        }

        .btn-primary:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .btn-secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            white-space: nowrap;
        }

        .btn-secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        .btn-danger {
            background-color: transparent;
            color: var(--vscode-errorForeground, #f48771);
            border: 1px solid currentColor;
            width: 100%;
            padding: 6px 10px;
            margin-top: 8px;
        }

        .btn-danger:hover {
            background-color: rgba(255, 0, 0, 0.1);
        }

        /* Toggle switch */
        .toggle-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 4px 0;
        }

        .toggle-label {
            font-weight: 600;
            font-size: 12px;
            cursor: pointer;
        }

        .switch {
            position: relative;
            display: inline-block;
            width: 38px;
            height: 20px;
        }

        .switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }

        .slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: var(--vscode-input-background, #3c3c3c);
            border: 1px solid var(--vscode-input-border, rgba(128,128,128,0.4));
            transition: .2s;
            border-radius: 20px;
        }

        .slider:before {
            position: absolute;
            content: "";
            height: 14px;
            width: 14px;
            left: 2px;
            bottom: 2px;
            background-color: var(--vscode-foreground, #ccc);
            transition: .2s;
            border-radius: 50%;
        }

        input:checked + .slider {
            background-color: var(--vscode-button-background);
        }

        input:checked + .slider:before {
            transform: translateX(18px);
            background-color: var(--vscode-button-foreground, #fff);
        }

        /* Range slider styling */
        .range-container {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        input[type="range"] {
            flex: 1;
            accent-color: var(--vscode-button-background);
            cursor: pointer;
        }

        .range-value {
            min-width: 42px;
            text-align: right;
            font-variant-numeric: tabular-nums;
            font-weight: 600;
            font-size: 12px;
        }

        .actions-section {
            margin-top: 22px;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .footer-links {
            margin-top: 18px;
            display: flex;
            justify-content: space-between;
            font-size: 11px;
        }

        .footer-links a {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
            cursor: pointer;
        }

        .footer-links a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="header">
        <div style="display: flex; align-items: center; gap: 8px;">
            <img src="${iconUri}" width="18" height="18" alt="Logo" style="border-radius: 50%; display: block;" />
            <span class="header-title">Settings</span>
        </div>
        <span class="status-badge" id="statusBadge">
            <span class="status-dot" id="statusDot"></span>
            <span id="statusText">Checking...</span>
        </span>
    </div>

    <!-- Master Enable Switch -->
    <div class="form-group">
        <div class="toggle-row">
            <label class="toggle-label" for="enabledToggle">Enable Wallpaper</label>
            <label class="switch">
                <input type="checkbox" id="enabledToggle" checked>
                <span class="slider"></span>
            </label>
        </div>
        <div class="hint">Toggle video wallpaper on or off</div>
    </div>

    <!-- Video Path & File Picker -->
    <div class="form-group">
        <label for="videoPath">Video Path / URL</label>
        <div class="input-group">
            <input type="text" id="videoPath" placeholder="Choose a video or enter file path..." spellcheck="false" />
            <button class="btn-secondary" id="browseBtn" title="Choose local video file">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M1.5 2A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h13a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 14.5 4H7.414l-1.707-1.707A1 1 0 0 0 5 2H1.5z"/>
                </svg>
                Pilih Video
            </button>
        </div>
        <div class="hint">Supports .mp4 (H.264) and .webm</div>
    </div>

    <!-- Opacity Slider -->
    <div class="form-group">
        <label for="opacitySlider">Opacity (Transparansi)</label>
        <div class="range-container">
            <input type="range" id="opacitySlider" min="0.1" max="1.0" step="0.05" value="0.1">
            <span class="range-value" id="opacityValue">10%</span>
        </div>
        <div class="hint">Scaled internally to max 80% to keep code readable</div>
    </div>

    <!-- Sizing Mode -->
    <div class="form-group">
        <label for="sizeSelect">Sizing Mode</label>
        <select id="sizeSelect">
            <option value="cover">Cover (Fill screen, crop edges)</option>
            <option value="contain">Contain (Fit screen, letterbox)</option>
            <option value="fill">Fill (Stretch to window)</option>
            <option value="auto">Auto (Natural size)</option>
        </select>
        <div class="hint">How video adapts to the VSCode window size</div>
    </div>

    <!-- Loop Continuous Toggle -->
    <div class="form-group">
        <div class="toggle-row">
            <label class="toggle-label" for="loopToggle">Loop Video</label>
            <label class="switch">
                <input type="checkbox" id="loopToggle" checked>
                <span class="slider"></span>
            </label>
        </div>
        <div class="hint">Replay video continuously</div>
    </div>

    <!-- Actions -->
    <div class="actions-section">
        <button class="btn-primary" id="applyBtn">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z"/>
                <path fill-rule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A4.985 4.985 0 0 1 8 2c2.166 0 4.034 1.374 4.75 3.32a.5.5 0 0 1-.942.335A3.985 3.985 0 0 0 8 3zm0 10a3.985 3.985 0 0 0 3.75-2.655.5.5 0 0 1 .942.335A4.985 4.985 0 0 1 8 14a4.985 4.985 0 0 1-4.75-3.32.5.5 0 0 1 .942-.335A3.985 3.985 0 0 0 8 13z"/>
            </svg>
            Apply &amp; Reload Window
        </button>

        <button class="btn-danger" id="disableBtn">
            Disable &amp; Remove Wallpaper
        </button>
    </div>

    <div class="footer-links">
        <a id="resetLink">Reset to Defaults</a>
        <a id="settingsJsonLink">Edit in settings.json</a>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        const videoPathInput = document.getElementById('videoPath');
        const browseBtn = document.getElementById('browseBtn');
        const opacitySlider = document.getElementById('opacitySlider');
        const opacityValue = document.getElementById('opacityValue');
        const sizeSelect = document.getElementById('sizeSelect');
        const enabledToggle = document.getElementById('enabledToggle');
        const loopToggle = document.getElementById('loopToggle');
        const applyBtn = document.getElementById('applyBtn');
        const disableBtn = document.getElementById('disableBtn');
        const resetLink = document.getElementById('resetLink');
        const settingsJsonLink = document.getElementById('settingsJsonLink');
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');

        function updateOpacityDisplay(val) {
            opacityValue.textContent = Math.round(val * 100) + '%';
        }

        opacitySlider.addEventListener('input', (e) => {
            updateOpacityDisplay(parseFloat(e.target.value));
        });

        browseBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'browseVideo' });
        });

        applyBtn.addEventListener('click', () => {
            vscode.postMessage({
                type: 'apply',
                settings: {
                    videoPath: videoPathInput.value.trim(),
                    opacity: parseFloat(opacitySlider.value),
                    size: sizeSelect.value,
                    enabled: enabledToggle.checked,
                    loop: loopToggle.checked
                }
            });
        });

        disableBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'disable' });
        });

        resetLink.addEventListener('click', () => {
            vscode.postMessage({ type: 'reset' });
        });

        settingsJsonLink.addEventListener('click', () => {
            vscode.postMessage({ type: 'openSettings' });
        });

        window.addEventListener('message', (event) => {
            const message = event.data;
            switch (message.type) {
                case 'state': {
                    const s = message.settings;
                    videoPathInput.value = s.videoPath || '';
                    opacitySlider.value = s.opacity ?? 0.1;
                    updateOpacityDisplay(s.opacity ?? 0.1);
                    sizeSelect.value = s.size || 'cover';
                    enabledToggle.checked = !!s.enabled;
                    loopToggle.checked = !!s.loop;

                    if (s.enabled && message.isPatched) {
                        statusDot.className = 'status-dot active';
                        statusText.textContent = 'Active';
                    } else if (s.enabled && !message.isPatched) {
                        statusDot.className = 'status-dot';
                        statusText.textContent = 'Needs Apply';
                    } else {
                        statusDot.className = 'status-dot';
                        statusText.textContent = 'Disabled';
                    }
                    break;
                }

                case 'videoSelected': {
                    videoPathInput.value = message.path;
                    break;
                }
            }
        });

        // Request initial state
        vscode.postMessage({ type: 'ready' });
    </script>
</body>
</html>`;
    }
}
