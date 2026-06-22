import { LW_VER, VERSION } from '../../utils/constants';
import { AbsPatchFile } from './PatchFile.base';

/**
 * Manages patching of VSCode's workbench.html file.
 *
 * Injects an inline <script> block that creates a <video> element overlay.
 * The injection is wrapped with HTML comment markers so it can be detected
 * and removed cleanly.
 *
 * Marker format:
 *   <!-- live-wallpaper-start live-wallpaper.ver.X.X.X -->
 *   <script>...</script>
 *   <!-- live-wallpaper-end -->
 */
export class HtmlPatchFile extends AbsPatchFile {
    public async applyPatches(patchContent: string): Promise<boolean> {
        try {
            const curContent = await this.getContent();

            // Start from a clean slate to avoid duplicate patches
            let content = this.cleanPatches(curContent);

            // workbench.html's CSP blocks inline scripts by default.
            // We need to add 'unsafe-inline' to script-src so our injected
            // script can execute.
            content = content.replace(/(script-src)/, `$1 'unsafe-inline'`);

            // Inject our script just before </html>
            content = content.replace(
                '</html>',
                [
                    `<!-- live-wallpaper-start ${LW_VER}.${VERSION} -->`,
                    `<script>${patchContent}</script>`,
                    '<!-- live-wallpaper-end -->',
                    '</html>',
                ].join('\n'),
            );

            // No change needed (e.g. content was already up-to-date)
            if (curContent === content) {
                return true;
            }

            return await this.write(content);
        } catch {
            return false;
        }
    }

    protected cleanPatches(content: string): string {
        // Remove the 'unsafe-inline' we added (only the one we added, not others)
        content = content.replace(/(script-src) 'unsafe-inline'/, '$1');

        // Remove the injected script block between our markers
        content = content.replace(
            /<!-- live-wallpaper-start[\s\S]*?<!-- live-wallpaper-end -->\n?/g,
            '',
        );

        return content;
    }
}
