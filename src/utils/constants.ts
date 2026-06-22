import path from 'node:path';

import pkg from '../../package.json';

/** Version number */
export const VERSION: string = pkg.version;

/** Patch marker identifier used to detect if workbench.html has been patched */
export const LW_VER = 'live-wallpaper.ver';

/** File encoding */
export const ENCODING = 'utf-8' as const;

/** Publisher */
export const PUBLISHER: string = pkg.publisher;

/** Extension name */
export const EXTENSION_NAME: string = pkg.name;

/** Configuration section key */
export const CONFIG_SECTION = 'liveWallpaper';

/** Extension ID (publisher.name) */
export const EXTENSION_ID = `${PUBLISHER}.${EXTENSION_NAME}`;

/**
 * Touch file path — stores the path to workbench.html and marks first-install.
 * Stored next to compiled output so it persists across reloads.
 */
export const TOUCH_FILE_PATH = path.join(
    __dirname,
    `../../lwb.${VERSION}.touch`,
);
