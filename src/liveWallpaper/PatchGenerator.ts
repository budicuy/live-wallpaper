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
        return PatchGenerator.minify(raw);
    }

    /**
     * Lightweight minifier — no external dependency needed.
     * Strips single-line comments, collapses whitespace and newlines.
     * Sufficient for the simple, self-contained script we inject.
     */
    private static minify(code: string): string {
        return (
            code
                // Remove single-line comments (but not URLs like https://)
                .replace(/(?<![:/])\/\/[^\n]*/g, '')
                // Collapse all whitespace sequences (spaces, tabs, newlines) to a single space
                .replace(/\s+/g, ' ')
                // Remove spaces around common operators and punctuation
                .replace(/\s*([{}();,=+\-*/<>!&|?:])\s*/g, '$1')
                .trim()
        );
    }

    private static buildScript(config: LiveWallpaperConfig): string {
        const { videoPath, opacity, size, loop } = config;

        // Corruption-warning suppression (English only)
        const corruptionMessages = ['installation appears to be corrupt'];

        const suppressCSS = corruptionMessages
            .map(
                (msg) =>
                    `.notification-toast-container:has([aria-label*="${msg}"]){display:none!important;}`,
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
                video.autoplay = true;
                video.loop = config.loop;
                video.muted = true;
                video.defaultMuted = true;
                video.playsInline = true;
                video.setAttribute('muted', '');
                video.setAttribute('autoplay', '');
                video.setAttribute('loop', '');
                video.setAttribute('playsinline', '');

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
                    'display: block !important',
                    'visibility: visible !important'
                ].join(';');

                document.body.appendChild(video);

                function startPlay(src) {
                    video.src = src;
                    function tryPlay() {
                        video.play().catch(function() {});
                    }
                    tryPlay();
                    video.addEventListener('canplay', tryPlay);
                    video.addEventListener('loadeddata', tryPlay);
                    window.addEventListener('click', tryPlay, { passive: true });
                    window.addEventListener('keydown', tryPlay, { passive: true });
                    window.addEventListener('pointerdown', tryPlay, { passive: true });
                }

                // Fetch to Blob URL first to ensure smooth playback and avoid Range-request restrictions
                fetch(config.videoPath)
                    .then(function(res) {
                        if (!res.ok) { throw new Error('HTTP ' + res.status); }
                        return res.blob();
                    })
                    .then(function(blob) {
                        var blobUrl = URL.createObjectURL(blob);
                        startPlay(blobUrl);
                    })
                    .catch(function() {
                        startPlay(config.videoPath);
                    });
            }

            function init() {
                injectStyle();
                injectVideo();

                // Periodic check to keep overlay intact if VS Code layout re-renders
                setInterval(function() {
                    if (document.body && !document.getElementById(LW_VIDEO_ID)) {
                        injectVideo();
                    }
                }, 4000);
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
