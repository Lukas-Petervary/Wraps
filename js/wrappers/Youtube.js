import AbstractWrapper from "./AbstractWrapper.js";

export default class YouTubeWrapper extends AbstractWrapper {
    constructor() {
        super();

        this.player = null;
        this.apiReady = false;
        this.playerReady = false;
        this.currentUri = null;
        this._playerReadyResolve = null;
        this._playerReadyPromise = new Promise(resolve => { this._playerReadyResolve = resolve; });

        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            document.head.appendChild(tag);
        }

        window.onYouTubeIframeAPIReady = () => {
            this.apiReady = true;
        };
    }

    getType() { return 'youtube'; }

    async _waitForApiReady(timeoutMs = 10000) {
        const start = Date.now();
        while (!this.apiReady) {
            if (Date.now() - start > timeoutMs) throw new Error('YouTube API ready timeout');
            await new Promise(r => setTimeout(r, 100));
        }
    }

    async _ensurePlayer(videoId) {
        await this._waitForApiReady();

        // If player already exists but different video id, we'll load it later via loadVideoById
        if (this.player) return this.player;

        // create hidden container
        let div = document.getElementById('yt-player');
        if (!div) {
            div = document.createElement('div');
            div.id = 'yt-player';
            div.style.width = '1px';
            div.style.height = '1px';
            div.style.position = 'absolute';
            div.style.left = '-9999px';
            document.body.appendChild(div);
        }

        // create player and wait for onReady
        this.player = new YT.Player('yt-player', {
            height: '0',
            width: '0',
            videoId: videoId || '',
            playerVars: {
                autoplay: 0,
                enablejsapi: 1,
                origin: window.location.origin,
                controls: 0,
                modestbranding: 1,
            },
            events: {
                onReady: (event) => {
                    this.playerReady = true;
                    if (this._playerReadyResolve) this._playerReadyResolve();
                },
                onStateChange: () => { /* optional: could map to events */ },
            }
        });

        // wait for ready (the above resolves it)
        await this._playerReadyPromise;
        return this.player;
    }

    extractVideoId(url) {
        if (!url) return null;
        const ytMatch = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        if (ytMatch) return ytMatch[1];
        // fallback: if user passed just an id
        if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
        return null;
    }

    async fetchUri(uri) {
        const videoId = this.extractVideoId(uri);
        if (!videoId) {
            throw new Error('[YouTubeWrapper] Invalid YouTube URI');
        }

        const oembedUrl =
            `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;

        let title, author;
        try {
            const res = await fetch(oembedUrl);
            if (!res.ok) throw new Error('oEmbed fetch failed');
            const data = await res.json();
            title = data.title;
            author = data.author_name;
        } catch (err) {
            console.error('[YouTubeWrapper] oEmbed error', err);
            throw err;
        }

        await this._ensurePlayer(videoId);

        let duration = -1;
        try {
            this.player.cueVideoById(videoId);
            await new Promise(r => setTimeout(r, 200));
            duration = this.player.getDuration();
        } catch (err) {
            console.warn('[YouTubeWrapper] duration fetch failed', err);
        }

        return { title, author, duration };
    }

    async playUri(uri) {
        const videoId = this.extractVideoId(uri);
        if (!videoId) {
            console.warn('[YouTubeWrapper] Could not extract video id from', uri);
            return;
        }

        this.currentUri = uri;

        // ensure player exists
        await this._ensurePlayer(videoId);

        // load and play
        try {
            // if same video, use playVideo; otherwise load by id
            const currentId = (this.player && this.player.getVideoData) ? this.player.getVideoData().video_id : null;
            if (currentId === videoId) {
                // play from start
                this.player.playVideo();
            } else {
                this.player.loadVideoById(videoId);
            }
            // attempt autoplay; note: browsers may require user gesture.
        } catch (err) {
            console.error('[YouTubeWrapper] playUri error', err);
            throw err;
        }
    }

    async pause() {
        if (this.player && typeof this.player.pauseVideo === 'function') {
            try { this.player.pauseVideo(); } catch (e) { console.warn(e); }
        }
    }

    async resume() {
        if (this.player && typeof this.player.playVideo === 'function') {
            try { this.player.playVideo(); } catch (e) { console.warn(e); }
        }
    }

    async getState() {
        if (!this.player || !this.player.getPlayerState) return {};
        const raw = this.player.getPlayerState();
        const map = { 0: 'ended', 1: 'playing', 2: 'paused', 3: 'buffering', 5: 'cued' };
        return { state: map[raw] || 'unknown' };
    }

    // return seconds (number)
    async getCurrentTime() {
        if (!this.player || typeof this.player.getCurrentTime !== 'function') return 0;
        try {
            return this.player.getCurrentTime();
        } catch (e) {
            console.warn('[YouTubeWrapper] getCurrentTime failed', e);
            return 0;
        }
    }

    async seek(seconds) {
        if (!this.player || typeof this.player.seekTo !== 'function') return;
        try {
            // second parameter "allowSeekAhead" set true
            this.player.seekTo(seconds, true);
        } catch (e) {
            console.warn('[YouTubeWrapper] seek failed', e);
        }
    }

    async setVolume(v) {
        if (!this.player || typeof this.player.setVolume !== 'function') return;
        try {
            // YouTube volume range 0..100
            const pct = Math.round(Math.max(0, Math.min(1, v)) * 100);
            this.player.setVolume(pct);
        } catch (e) {
            console.warn('[YouTubeWrapper] setVolume failed', e);
        }
    }
}
