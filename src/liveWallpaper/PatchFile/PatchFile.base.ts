import { randomUUID } from 'node:crypto';
import fs, { constants as fsConstants } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { _ } from '../../utils';
import { ENCODING, LW_VER, VERSION } from '../../utils/constants';
import { vsc } from '../../utils/vsc';

/** Describes the current patch state of a file */
export enum EFilePatchType {
    /** File has not been patched */
    None,
    /** File was patched by an older version */
    Legacy,
    /** File is patched by the current version */
    Latest,
}

/**
 * Abstract base class for patching VSCode workbench files.
 * Handles reading, writing (with sudo fallback), and version detection.
 */
export abstract class AbsPatchFile {
    constructor(public readonly filePath: string) {}

    /**
     * Returns true if the file has been patched (any version).
     */
    public async hasPatched(): Promise<boolean> {
        const patchType = await this.getPatchType();
        return patchType !== EFilePatchType.None;
    }

    /**
     * Determine the current patch state of the file.
     * Returns EFilePatchType.None gracefully if the file cannot be read.
     */
    public async getPatchType(): Promise<EFilePatchType> {
        let content: string;
        try {
            content = await this.getContent();
        } catch {
            // File doesn't exist or can't be read — treat as unpatched
            return EFilePatchType.None;
        }

        // Patched by current version
        if (content.includes(`${LW_VER}.${VERSION}`)) {
            return EFilePatchType.Latest;
        }

        // Patched by an older version
        if (content.includes(LW_VER)) {
            return EFilePatchType.Legacy;
        }

        return EFilePatchType.None;
    }

    /** Read the file as UTF-8 text */
    protected getContent(): Promise<string> {
        return fs.promises.readFile(this.filePath, ENCODING);
    }

    /**
     * Write content to a file path.
     * On permission errors, prompts the user to retry with admin/sudo.
     */
    protected async saveContentTo(
        filePath: string,
        content: string,
    ): Promise<boolean> {
        try {
            if (fs.existsSync(filePath)) {
                await fs.promises.access(filePath, fsConstants.W_OK);
            }
            await fs.promises.writeFile(filePath, content, ENCODING);
            return true;
        } catch (e: any) {
            if (!vsc) {
                return false;
            }

            const retry = 'Retry with Admin / Sudo';
            const result = await vsc.window.showErrorMessage(
                `Live Wallpaper: Cannot write to file — ${e.message}`,
                retry,
            );

            if (result !== retry) {
                return false;
            }

            // Write content to a temp file then move it with sudo
            const tempFilePath = path.join(
                tmpdir(),
                `live-wallpaper-${randomUUID()}.temp`,
            );
            await fs.promises.writeFile(tempFilePath, content, ENCODING);

            try {
                const mvCmd =
                    process.platform === 'win32' ? 'move /Y' : 'mv -f';
                await _.sudoExec(`${mvCmd} "${tempFilePath}" "${filePath}"`, {
                    name: 'Live Wallpaper Extension',
                });
                return true;
            } catch (sudoErr: any) {
                vsc.window.showErrorMessage(
                    `Live Wallpaper: Sudo failed — ${sudoErr.message}`,
                );
                return false;
            } finally {
                await fs.promises.rm(tempFilePath, { force: true });
            }
        }
    }

    /** Write content to the target file */
    protected async write(content: string): Promise<boolean> {
        if (!content.trim().length) {
            return false;
        }
        return this.saveContentTo(this.filePath, content);
    }

    /**
     * Apply patch content to the file.
     * Must include the `${LW_VER}.${VERSION}` marker so future runs can detect it.
     */
    public abstract applyPatches(patch: string): Promise<boolean>;

    /**
     * Return file content with all live-wallpaper patches removed.
     */
    protected abstract cleanPatches(content: string): string;

    /**
     * Restore the file to its original (unpatched) state.
     */
    public async restore(): Promise<boolean> {
        try {
            const curContent = await this.getContent();
            const cleaned = this.cleanPatches(curContent);

            // Nothing changed — already clean
            if (curContent === cleaned) {
                return true;
            }

            return await this.write(cleaned);
        } catch {
            return false;
        }
    }
}
