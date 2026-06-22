# Live Wallpaper for VSCode

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/live-wallpaper.live-wallpaper?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=live-wallpaper.live-wallpaper)
[![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/live-wallpaper.live-wallpaper?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=live-wallpaper.live-wallpaper)
[![License](https://img.shields.io/github/license/budicuy/live-wallpaper?style=flat-square)](https://github.com/budicuy/live-wallpaper/blob/main/LICENSE)

Bring your VSCode window to life by setting an MP4 video as your editor background wallpaper. 

Choose your favorite live wallpapers, loop them, adjust their opacity, and enjoy an immersive coding atmosphere. Works seamlessly on **Windows**, **macOS**, and **Linux**!

---

## 📸 Preview

*Add your preview image or GIF here to wow users in the Marketplace!*
> Example markdown:
> `![Live Wallpaper Preview](https://raw.githubusercontent.com/username/live-wallpaper/main/images/preview.gif)`
xx
---

## ✨ Features

- 🎥 **MP4 Video Backgrounds**: Supports local MP4 video files (H.264 encoded).
- 🎛️ **Adjustable Opacity**: Modify opacity from `0.1` (mostly transparent) to `1.0` (fully visible) to fit your syntax theme.
- 📐 **Sizing Modes**: Configure video rendering size (`cover`, `contain`, `fill`, or `auto`).
- 🔁 **Continuous Loop**: Toggle video looping on or off.
- 🐧 **Cross-Platform Support**: Fully compatible with VSCode installations on Linux, Windows, and macOS.
- 🧼 **Clean Uninstall**: Automatically restores VSCode's original files when disabling or uninstalling the extension.

---

## 🚀 Getting Started

### 1. Configure the Video Path
Open your VSCode User Settings (`settings.json`) by pressing `Ctrl + Shift + P` (or `Cmd + Shift + P` on macOS), selecting **Preferences: Open User Settings (JSON)**, and adding your configuration:

```json
{
  "liveWallpaper.videoPath": "/absolute/path/to/your/wallpaper.mp4",
  "liveWallpaper.opacity": 0.3,
  "liveWallpaper.size": "cover",
  "liveWallpaper.enabled": true,
  "liveWallpaper.loop": true
}
```

### 2. Apply and Reload
1. Press `Ctrl + Shift + P` (or `Cmd + Shift + P` on macOS) to open the Command Palette.
2. Select **`Live Wallpaper: Apply and Reload`**.
3. **Note (Linux & macOS)**: Because VSCode installation files are protected, you will be prompted with an Administrator/Sudo authorization dialog. Click **Retry with Admin / Sudo** and enter your password to grant permission.
4. VSCode will prompt you to reload the window. Click **Reload** to see your wallpaper.

---

## 🛠️ Configuration Settings

| Setting | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `liveWallpaper.videoPath` | `string` | `""` | Absolute file path to the MP4 (H.264) video. |
| `liveWallpaper.opacity` | `number` | `0.3` | Opacity of the background video (range: `0.1` to `1.0`). |
| `liveWallpaper.size` | `string` | `"cover"` | Sizing mode relative to the window (`cover`, `contain`, `fill`, `auto`). |
| `liveWallpaper.enabled` | `boolean` | `true` | Quickly toggle the video background on or off. |
| `liveWallpaper.loop` | `boolean` | `true` | Determines whether the video loops continuously. |

---

## ⌨️ Command Palette Actions

You can trigger all extension features directly from the Command Palette (`Ctrl + Shift + P` / `Cmd + Shift + P`):

* **`Live Wallpaper: Apply and Reload`** — Applies current settings and updates the wallpaper.
* **`Live Wallpaper: Disable and Reload`** — Disables the wallpaper and restores your VSCode interface to default.
* **`Live Wallpaper: Reset to Defaults`** — Resets configuration values to default settings.
* **`Live Wallpaper: Uninstall Extension`** — Safely removes the injected background codes and uninstalls the extension.

---

## ❓ FAQ & Troubleshooting

### Why does VSCode say "Your installation is corrupt"?
Because this extension patches VSCode's core HTML file (`workbench.html`), VSCode detects a change in its installation integrity. 
* **Do not worry!** This is completely safe and only changes the background styling.
* This extension automatically injects styles that suppress the default warning popup to keep your workflow clean.

### What video formats are supported?
Only **MP4 (H.264 codec)** is supported. High-efficiency formats like H.265/HEVC or WebM may not render correctly due to VSCode's built-in Chromium rendering limitations.

### How do I uninstall the extension manually?
If you ever want to revert all changes, simply run the **`Live Wallpaper: Disable and Reload`** command before uninstalling the extension. Alternatively, you can uninstall it directly, and the extension's post-uninstall hook will automatically revert your files.

---

## 📄 License

This extension is licensed under the MIT License.
