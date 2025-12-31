import SpotifyWrapper from "../js/wrappers/Spotify.js";
import YouTubeWrapper from "../js/wrappers/Youtube.js";
import { getParam } from "../js/util.js";

class Model {
    constructor() {
        /** @type {{spotify: SpotifyWrapper, youtube: YouTubeWrapper}} */
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

        this.addCallbacks({});
    }

    /**
     * Adds a list of callbacks to the model
     * @param {{function}} callbacks first class function values for callbacks
     */
    addCallbacks(callbacks) {
        /** @param {Track} track */
        const _ = (track) => {};
        this.events = Object.assign(this.events ?? {
            onLoad: _,
            onPlay: _,
            onPause: _,
            onSeek: (track, time) => {},
            onSkip: _,
            onAddQueue: _,
            onRemoveQueue: _,
            onMoveQueue: _,
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

class View {
    constructor() {
        this.trackDisplay = {
            trackLabel: document.getElementById('currentTrack'),
            artistLabel: document.getElementById('currentArtist'),

            currentTime: document.getElementById('currentTime'),
            duration: document.getElementById('duration'),
            buffer: document.getElementById('bufferInfo'),
        };

        this.queueDisplay = {
            queueCount: document.getElementById('queueCount'),
            queueList: document.getElementById('queueList'),

            addTextfield: document.getElementById('addInput'),
            addButton: document.getElementById('addBtn'),
            addDropBox: document.getElementById('dropZone'),
        };

        this.playerControls = {
            playButton: document.getElementById('playBtn'),
            pauseButton: document.getElementById('pauseBtn'),
            seekBar: document.getElementById('seekBar'),
            volumeBar: document.getElementById('volume'),
        };

        this.hostControls = {
            strictMode: document.getElementById('perm-strictMode'),
            lockRoom: document.getElementById('perm-lockRoom'),
            addQueue: document.getElementById('perm-addQueue'),
            removeQueue: document.getElementById('perm-removeQueue'),
            rearrangeQueue: document.getElementById('perm-rearrangeQueue'),
            pausePlay: document.getElementById('perm-pausePlaySong'),
            skip: document.getElementById('perm-skipSong'),
        }

        this.addCallbacks({});
        this.init();
    }

    init() {
        // set dynamic page assets on load
        const roomId = getParam('host') || getParam('join') || getParam('room') || '';
        const isHost = !!getParam('host');

        const roleLabel = document.getElementById('roleLabel');
        roleLabel.textContent = isHost ? 'Host' : 'Client';
        document.getElementById('roomIdLabel').textContent = roomId ? `Room: ${roomId}` : '';

        if (isHost) {
            document.getElementById('hostPanel').classList.remove('hidden');
        }

        // TODO: Fix event types for user interaction
        // bind user input event listeners to widgets through events object
        const _reg = (a,b,c) => a.addEventListener(b, (event) => c(event));
        _reg(this.playerControls.playButton, 'click', this.events.playButtonClick);
        _reg(this.playerControls.pauseButton, 'click', this.events.pauseButtonClick);
        _reg(this.playerControls.seekBar, 'click', this.events.seekBarInteract);
        _reg(this.playerControls.volumeBar, 'click', this.events.volumeBarInteract);

        _reg(this.queueDisplay.addTextfield, 'click', this.events.queueTextField);
        _reg(this.queueDisplay.addButton, 'click', this.events.queueAddButton);
        _reg(this.queueDisplay.addDropBox, 'click', this.events.queueDropBox);

        _reg(this.hostControls.strictMode, 'click', this.events.strictModeClick);
        _reg(this.hostControls.lockRoom, 'click', this.events.lockRoomClick);
        _reg(this.hostControls.addQueue, 'click', this.events.addQueueClick);
        _reg(this.hostControls.removeQueue, 'click', this.events.removeQueueClick);
        _reg(this.hostControls.rearrangeQueue, 'click', this.events.rearrangeQueueClick);
        _reg(this.hostControls.pausePlay, 'click', this.events.pausePlayClick);
        _reg(this.hostControls.skip, 'click', this.events.skipSongClick);

        // other stuff to do ...
    }

    /**
     * Adds a list of callbacks for UI events
     * @param {{function}} callbacks first class function values for callbacks
     */
    addCallbacks(callbacks) {
        /** @param {Event} event */
        const _ = (event) => {};
        this.events = Object.assign(this.events ?? {
            playButtonClick: _,
            pauseButtonClick: _,
            seekBarInteract: _,
            volumeBarInteract: _,

            queueTextField: _,
            queueAddButton: _,
            queueDropBox: _,

            strictModeClick: _,
            lockRoomClick: _,
            addQueueClick: _,
            removeQueueClick: _,
            rearrangeQueueClick: _,
            pausePlayClick: _,
            skipSongClick: _,
        }, callbacks);
    }

    /**
     * Displays a track on the "currently playing" fields. If `null` or
     * `undefined` is provided, then it resets the display to default
     * @param {Track} track the track to display
     */
    displayTrack(track) {
        this.trackDisplay.currentTime.textContent = '0:00';
        this.trackDisplay.duration.textContent = '0:00';
        this.playerControls.seekBar.value = 0;

        if (!track) {
            this.trackDisplay.trackLabel.textContent = 'No track';
            this.trackDisplay.artistLabel.textContent = '';
            this.playerControls.seekBar.max = 0;
        } else {
            this.trackDisplay.trackLabel.textContent = track.title;
            this.trackDisplay.artistLabel.textContent = track.author;
            this.playerControls.seekBar.max = track.duration;
        }
    }

    /**
     * Sets the seek bar time to a specific number of seconds
     * @param {Number} time
     */
    displayTime(time) {}

    /**
     * Returns an html object for a queue entry representing the provided track
     * @param {Track} track the track to create a queue entry for
     */
    createQueueEntry(track) {

    }

    /**
     * Renders a list of tracks to the UI
     * @param {[Track]} trackList
     */
    renderQueue(trackList) {}
}

class Controller {
    constructor(model, view) {

    }
}

window.addEventListener("DOMContentLoaded", () => {
    const MODEL = new Model();
    const VIEW = new View();
    const CONTROLLER = new Controller(MODEL, VIEW);

    MODEL.addCallbacks({});

    window._wraps = {MODEL, VIEW, CONTROLLER};
    console.log("SETUP COMPLETE");
});