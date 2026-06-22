import sudo from '@vscode/sudo-prompt';

import { vsc } from './vsc';

export namespace _ {
    /**
     * Detect if running in VSCode Desktop (as opposed to code-server / browser).
     * `desktop` → desktop app
     * `server-distro` → code-server
     */
    export const isDesktop = vsc?.env.appHost === 'desktop';

    /**
     * Execute a shell command with elevated privileges (sudo / UAC).
     *
     * @param cmd   Shell command to execute
     * @param options  Options passed to sudo-prompt (e.g. { name: 'My App' })
     */
    export function sudoExec(
        cmd: string,
        options: { name?: string } = {},
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            sudo.exec(cmd, options, (error?: Error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Wrap a JS string in an Immediately Invoked Function Expression (IIFE).
     *
     * @param source  JavaScript source code
     */
    export function withIIFE(source: string): string {
        return `;(function() { ${source} })();`;
    }
}
