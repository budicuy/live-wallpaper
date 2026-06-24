# Changelog

All notable changes to the **Live Wallpaper** VSCode extension will be documented in this file.

---

## [1.0.8] - 2026-06-24

### Added
- Created GitHub Actions workflow (`.github/workflows/release.yml`) to automatically compile, package, and attach the `.vsix` file to GitHub Releases on tag pushes (e.g. `v*`).

### Changed
- **Extreme VSIX Size Reduction (Reduced by ~77%, from 424 KB to 98 KB)**:
  - Removed the heavy `uglify-js` (1.24 MB) runtime dependency and replaced it with a custom lightweight built-in minifier.
  - Compressed the extension icon (`icon.png`) using 256-color palette reduction (103 KB down to 49 KB) without loss of visual quality.
  - Excluded unnecessary configuration/lockfiles (`bun.lock`, `package-lock.json`, `biome.json`) in `.vscodeignore`.
- **Improved Opacity Defaults**: Changed the default opacity in the "Create Template Setup" command from `0.3` to `0.1` for better readability out-of-the-box.

### Fixed
- **Single Reload Logic**: Fixed double reload bug during enable/disable actions, ensuring it only requires a single reload to apply changes.
- **Disable Logic**: Corrected the `Disable and Reload` command logic to set `enabled: false` in configurations rather than completely removing the wallpaper script from `workbench.html`.

---

## [1.0.7] - 2026-06-23

### Changed
- Version bump in preparation for codebase cleanups and refactoring.

---

## [1.0.6] - 2026-06-23

### Added
- Integrated Biome (`biome.json`) for fast code formatting and linting.

### Changed
- Refactored codebase structure to improve readability, maintainability, and error handling consistency.
- Updated documentation styling and adjustable opacity description in the README.
- Cleaned up translations and reduced corruption error message complexity.

---

## [1.0.5] - 2026-06-23

### Added
- Added a "Bug Report" feedback section to the `README.md`.

### Changed
- Updated the GIF preview link to use an absolute URL path.
- Removed local `preview.mp4` asset to reduce git history weight.
- Centered the extension preview layout in `README.md`.

---

## [1.0.4] - 2026-06-22

### Changed
- Replaced WebM preview formats with high-quality MP4/GIF formats in README.
- Excluded local `img/` assets from packaging using `.vscodeignore`.

---

## [1.0.3] - 2026-06-22

### Added
- Added repository information to `package.json`.
- Created detailed `README.md` containing features, installation guide, and setup instructions.
- Added `liveWallpaper.createTemplate` ("Live Wallpaper: Create Template Setup") command to quickly generate settings templates in `settings.json`.

---

## [1.0.0] - 2026-06-22

### Added
- Initial release of **Live Wallpaper** extension.
- Core commands: `Apply and Reload`, `Disable and Reload`, `Reset to Defaults`, `Uninstall Extension`.
- Custom configurations: `videoPath`, `opacity`, `size`, `enabled`, and `loop`.
- Administrator backup restoration and file patching scripts.
