import uglifyjs from 'uglify-js';

import { _ } from '../utils';

/** Configuration for the live wallpaper */
export interface LiveWallpaperConfig {
    /** Normalized vscode-file:// URL to the MP4 video */
    videoPath: string;
    /** Opacity of the video overlay (0.1 – 1.0) */
    opacity: number;
    /** CSS object-fit value for the video sizing */
    size: 'cover' | 'contain' | 'fill' | 'auto';
    /** Whether the video should loop */
    loop: boolean;
}

/**
 * Generates the JavaScript that is injected into workbench.html.
 *
 * The script:
 *  1. Creates a <video> element positioned as a fixed, full-screen overlay
 *  2. Applies the configured opacity, object-fit, and loop settings
 *  3. Hides the VSCode checksum-corruption notification toast
 *  4. Waits for the DOM to be ready before inserting the video
 */
export class PatchGenerator {
    /**
     * Generate minified JavaScript to inject into workbench.html.
     *
     * @param config  Wallpaper configuration (with normalized video path)
     * @returns Minified JS string ready for injection into a <script> tag
     */
    public static create(config: LiveWallpaperConfig): string {
        const raw = PatchGenerator.buildScript(config);
        const result = uglifyjs.minify(raw);

        if (result.error) {
            // Fallback to unminified if uglify fails (shouldn't happen)
            return raw;
        }

        return result.code;
    }

    private static buildScript(config: LiveWallpaperConfig): string {
        const { videoPath, opacity, size, loop } = config;

        // Corruption-warning suppression translations (same approach as vscode-background)
        const corruptionMessages = [
            'installation appears to be corrupt',
            'Installation ist offenbar beschädigt',
            'parece estar dañada',
            'semble être endommagée',
            'sembra danneggiata',
            'インストールが壊れている',
            '설치가 손상된 것 같습니다',
            'installatie lijkt beschadigd',
            'parece estar corrompida',
            '安装似乎损坏',
            '安裝似乎已損毀',
            'повреждена',
            'yüklemeniz bozuk',
        ];

        const suppressCSS = corruptionMessages
            .map(
                msg =>
                    `.notification-toast-container:has([aria-label*="${msg}"]){display:none!important;}`
            )
            .join('');

        const videoScript = `
            var LW_VIDEO_ID = 'live-wallpaper-bg-video';
            var LW_STYLE_ID = 'live-wallpaper-bg-style';

            var config = {
                videoPath: ${JSON.stringify(videoPath)},
                opacity: ${opacity},
                size: ${JSON.stringify(size)},
                loop: ${loop}
            };

            function injectStyle() {
                var existing = document.getElementById(LW_STYLE_ID);
                if (existing) { existing.remove(); }

                var style = document.createElement('style');
                style.id = LW_STYLE_ID;
                style.textContent = ${JSON.stringify(suppressCSS)};
                document.head.appendChild(style);
            }

            function injectVideo() {
                // Remove any previously injected video (handles hot-reload / re-apply)
                var existing = document.getElementById(LW_VIDEO_ID);
                if (existing) { existing.remove(); }

                if (!config.videoPath) { return; }

                var video = document.createElement('video');
                video.id = LW_VIDEO_ID;
                video.src = config.videoPath;
                video.autoplay = true;
                video.loop = config.loop;
                video.muted = true;
                video.playsInline = true;

                // Suppress autoplay policy errors silently
                video.onerror = function() {};

                // Fixed full-screen overlay, behind UI but above the base background
                video.style.cssText = [
                    'position: fixed',
                    'top: 0',
                    'left: 0',
                    'width: 100vw',
                    'height: 100vh',
                    'object-fit: ' + config.size,
                    'opacity: ' + config.opacity,
                    'z-index: 999',
                    'pointer-events: none',
                    'display: block'
                ].join(';');

                document.body.appendChild(video);

                // Ensure playback starts even if the element was inserted before
                // the browser had a chance to start autoplay
                video.play().catch(function() {});
            }

            function init() {
                injectStyle();
                injectVideo();
            }

            // VSCode loads its workbench asynchronously. We wait for the body
            // to appear before injecting our overlay.
            if (document.body) {
                init();
            } else {
                document.addEventListener('DOMContentLoaded', init);
            }
        `;

        return _.withIIFE(videoScript);
    }
}
