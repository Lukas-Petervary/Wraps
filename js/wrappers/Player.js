import SpotifyWrapper from "./Spotify.js";
import YouTubeWrapper from "./Youtube.js";

export default class Player {
    constructor(callbacks) {
        this.wrappers = {
            spotify: new SpotifyWrapper(),
            youtube: new YouTubeWrapper(),
        }

        /** @typedef {AbstractWrapper} */
        this.currentWrapper = null;
        /** @typedef {Track} */
        this.currentTrack = null;
        /** @typedef {[Track]} */
        this.queue = [];

        this.paused = false;

        this.events = Object.assign({
            onLoad: (track) => {},
            onPlay: (track) => {},
            onPause: (track) => {},
            onSeek: (track, time) => {},
            onSkip: (track) => {},
            onAddQueue: (track) => {},
            onRemoveQueue: (track) => {},
            onMoveQueue: (track) => {},
        }, callbacks);
    }

    /**
     * Loads the provided track for playback
     * @param {Track} track the track to play
     */
    async load(track) {
        this.currentTrack = track;
        this.currentWrapper = this.wrappers[this.currentTrack.source];
        await this.currentWrapper.playUri(this.currentTrack.uri)
        this.paused = false;
        this.events.onLoad(track);
    }

    /**
     * Resumes current track if available, otherwise plays next track in queue
     */
    async play() {
        if (!this.currentWrapper)
            return console.warn("attempted playback without active wrapper");
        if (this.currentTrack !== null)
            this.currentWrapper.resume();
        else await this.load(this.queue.shift());
        this.events.onPlay(this.currentTrack);
    }

    /**
     * Pauses current track, otherwise defaults to unpaused
     */
    pause() {
        if (this.currentTrack !== null) {
            this.currentWrapper.pause();
            this.paused = true;
        } else {
            this.paused = false;
        }
        this.events.onPause(this.currentTrack);
    }

    /**
     * Sets playback time of current track
     * @param {Number} time time (in seconds) to set the current song to
     */
    seek(time) {
        if (this.currentTrack !== null)
            this.currentWrapper.seek(time);
        this.events.onSeek(this.currentTrack, time);
    }

    /**
     * Skips the song currently playing, and automatically plays the next in queue
     */
    async skip() {
        if (this.queue.length === 0) {
            this.currentWrapper?.pause?.();
            this.currentTrack = null;
            return;
        }
        this.currentWrapper.pause();
        await this.load(this.queue.shift());
        this.events.onSkip(this.currentTrack);
    }

    /**
     * Adds a track to queue
     * @param {Track} track the track to append to queue
     * @return {Track} returns the track added to queue
     */
    addQueue(track) {
        this.queue.push(track);
        this.events.onAddQueue(track);
        return track;
    }

    /**
     * Removes the track at given index
     * @param {Number} idx the track to remove from queue
     * @return {Track} returns the track removed from queue
     */
    removeQueue(idx) {
        const [track] = this.queue.splice(idx, 1);
        this.events.onRemoveQueue(track);
        return track;
    }

    /**
     * Moves the track at 'idx' to 'destination' number in queue. If destination = -1, then it automatically plays the song at 'idx'
     * @param {Number} idx index of queue to shift
     * @param {Number} destination index to move track to
     * @returns {Track} the track moved in queue
     */
    moveQueue(idx, destination = -1) {
        const [track] = this.queue.splice(idx, 1);
        this.queue.splice(Math.max(destination, 0), 0, track);
        if (destination < 0) this.load(this.queue.shift());
        this.events.onMoveQueue(track);
        return track;
    }

    /**
     * Sets the volume of all wrappers
     * @param {Number} volume volume normalized 0...100 for the current wrapper
     */
    setVolume(volume) {
        Object.values(this.wrappers).forEach(w => w.setVolume(volume));
    }
}