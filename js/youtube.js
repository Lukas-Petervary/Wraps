// js/youtube.js
// Minimal YouTube player wrapper using IFrame API and oEmbed for metadata.

let ytApiLoaded = false;
export function loadYouTubeApi() {
    if (ytApiLoaded) return Promise.resolve();
    return new Promise((resolve) => {
        const s = document.createElement('script');
        s.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(s);
        window.onYouTubeIframeAPIReady = () => {
            ytApiLoaded = true;
            resolve();
        };
    });
}

export async function createYouTubePlayer(containerId, opts = {}) {
    await loadYouTubeApi();
    const player = new YT.Player(containerId, {
        height: '0',
        width: '0',
        playerVars: {
            origin: location.origin,
            playsinline: 1,
        },
        events: {
            onReady: (e) => opts.onReady && opts.onReady(),
            onStateChange: (e) => opts.onStateChange && opts.onStateChange(e),
        }
    });

    // unified wrapper
    return {
        playVideoById: (id) => player.loadVideoById(id),
        play: () => player.playVideo(),
        pause: () => player.pauseVideo(),
        seekSeconds: (s, allowSeekAhead=true) => player.seekTo(s, allowSeekAhead),
        getCurrentTime: () => player.getCurrentTime(),
        getVideoData: () => player.getVideoData(),
        // utility to play by uri or youtube link
        async playUri(uri) {
            const id = parseYouTubeId(uri);
            if (!id) throw new Error('Invalid YouTube id');
            this.playVideoById(id);
        }
    };
}

export function parseYouTubeId(urlOrId) {
    if (!urlOrId) return null;
    // if already an ID (11 chars common)
    if (/^[A-Za-z0-9_-]{11}$/.test(urlOrId)) return urlOrId;
    // common url formats
    const u = urlOrId;
    // youtu.be/ID
    let m = u.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
    if (m) return m[1];
    // v=ID
    m = u.match(/[?&]v=([A-Za-z0-9_-]{11})/);
    if (m) return m[1];
    // embed/ID
    m = u.match(/embed\/([A-Za-z0-9_-]{11})/);
    if (m) return m[1];
    return null;
}

// fetch metadata via oEmbed (no API key)
export async function fetchYouTubeMetadata(urlOrId) {
    const id = parseYouTubeId(urlOrId);
    if (!id) throw new Error('Invalid YouTube id');
    const url = `https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}&format=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('oEmbed fetch failed');
    // returned fields: title, author_name, thumbnail_url, etc
    return res.json();
}
