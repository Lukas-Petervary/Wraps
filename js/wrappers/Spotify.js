import { loadToken } from '../auth.js';
import AbstractWrapper from "./AbstractWrapper.js";

export default class SpotifyWrapper extends AbstractWrapper {
    constructor() {
        super();

        this.player = null;
        this.deviceId = null;
        this.ready = false;
        this.isPremium = false;
        this.currentUri = null;
        this._readyResolve = null;
        this._readyPromise = new Promise(resolve => { this._readyResolve = resolve; });

        if (!window.Spotify) {
            const tag = document.createElement('script');
            tag.src = "https://sdk.scdn.co/spotify-player.js";
            document.head.appendChild(tag);
        }

        window.onSpotifyWebPlaybackSDKReady = () => {
            // init player asynchronously
            this.initPlayer().catch(err => console.warn('[SpotifyWrapper] init error', err));
        };
    }

    getType() {return 'spotify'}

    async _waitForReady(timeoutMs = 10000) {
        const start = Date.now();
        while (!this.ready) {
            if (Date.now() - start > timeoutMs) break;
            await new Promise(r => setTimeout(r, 100));
        }
        return this.ready;
    }

    async initPlayer() {
        const token = loadToken();
        if (!token) {
            console.warn('[SpotifyWrapper] No token found in initPlayer');
            this.ready = true; // still mark ready so we fall back to open-in-new-tab behaviour
            if (this._readyResolve) this._readyResolve();
            return;
        }

        try {
            const profileRes = await fetch('https://api.spotify.com/v1/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const profile = await profileRes.json();
            this.isPremium = profile.product === 'premium';
        } catch (e) {
            console.warn('[SpotifyWrapper] profile fetch failed', e);
            this.isPremium = false;
        }

        if (!this.isPremium) {
            // fallback behavior: treat as ready but use open-in-new-tab when playUri is requested
            this.ready = true;
            if (this._readyResolve) this._readyResolve();
            return;
        }

        // Premium: create SDK player
        this.player = new Spotify.Player({
            name: 'Wraps Player',
            getOAuthToken: cb => cb(token),
            volume: 0.8
        });

        this.player.addListener('ready', ({ device_id }) => {
            this.deviceId = device_id;
            this.ready = true;
            if (this._readyResolve) this._readyResolve();
            console.log('[SpotifyWrapper] ready, device id', device_id);
        });

        this.player.addListener('player_state_changed', state => {
            this.currentState = state;
        });

        try {
            await this.player.connect();
        } catch (e) {
            console.warn('[SpotifyWrapper] player.connect failed', e);
            this.ready = true;
            if (this._readyResolve) this._readyResolve();
        }
    }

    // Helper to ensure SDK is ready (or fallback isReady)
    async _ensureReady() {
        if (this.ready) return true;
        await this._waitForReady();
        return this.ready;
    }

    async playUri(uri) {
        this.currentUri = uri;
        const token = loadToken();

        // If not premium, fallback: open spotify track page (as before)
        if (!await this._ensureReady() || !this.isPremium || !this.deviceId) {
            // attempt to extract track id and open it
            const trackIdMatch = uri && uri.match(/(?:spotify:track:|track\/)([a-zA-Z0-9]+)/);
            if (trackIdMatch) {
                window.open(`https://open.spotify.com/track/${trackIdMatch[1]}`, '_blank');
            } else {
                console.warn('[SpotifyWrapper] cannot play non-premium or device not ready', uri);
            }
            return;
        }

        // call Web API to start playing on this device
        try {
            await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`, {
                method: 'PUT',
                body: JSON.stringify({ uris: [uri] }),
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
        } catch (e) {
            console.warn('[SpotifyWrapper] playUri fetch failed', e);
        }
    }

    async pause() {
        if (!this.player || !this.isPremium) return;
        try {
            await this.player.pause();
        } catch (e) {
            console.warn('[SpotifyWrapper] pause failed', e);
        }
    }

    async resume() {
        if (!this.player || !this.isPremium) return;
        try {
            await this.player.resume();
        } catch (e) {
            console.warn('[SpotifyWrapper] resume failed', e);
        }
    }

    // returns seconds
    async getCurrentTime() {
        if (!this.player || !this.isPremium) return 0;
        try {
            const state = await this.player.getCurrentState();
            if (!state) return 0;
            return state.position ? state.position / 1000 : 0;
        } catch (e) {
            console.warn('[SpotifyWrapper] getCurrentTime failed', e);
            return 0;
        }
    }

    async seek(seconds) {
        if (!this.player || !this.isPremium) return;
        try {
            await this.player.seek(Math.round(seconds * 1000));
        } catch (e) {
            console.warn('[SpotifyWrapper] seek failed', e);
        }
    }

    async setVolume(v) {
        if (!this.player || !this.isPremium) return;
        try {
            // Spotify.Player.setVolume expects 0..1
            await this.player.setVolume(Math.max(0, Math.min(1, v)));
        } catch (e) {
            console.warn('[SpotifyWrapper] setVolume failed', e);
        }
    }
}
