import SpotifyWrapper from "../js/wrappers/Spotify.js";
import YouTubeWrapper from "../js/wrappers/Youtube.js";
import { formatTime, getParam, parseTrackInput } from "../js/util.js";
import { Track } from "../js/wrappers/AbstractWrapper.js";
import { Lobby, User } from "../js/P2PLobby.js";

class Model {
    constructor() {
        /** @type {{string: AbstractWrapper}} */
        this.wrappers = {}

        this.registerWrapper(new SpotifyWrapper());
        this.registerWrapper(new YouTubeWrapper());

        /** @typedef {AbstractWrapper} */
        this.currentWrapper = null;
        /** @typedef {Track} */
        this.currentTrack = null;
        /** @typedef {[Track]} */
        this.queue = [];

        this.paused = true;

        this.addCallbacks({});
    }

    /**
     * Registers a provided wrapper with the model
     * @param {AbstractWrapper} wrapper provided instance wrapper object
     */
    registerWrapper(wrapper) {
        this.wrappers[wrapper.getType()] = wrapper;
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
            onSetQueue: _,
        }, callbacks);
    }

    /**
     * Loads the provided track for playback
     * @param {Track} track the track to play
     */
    async load(track) {
        if (!track) return;

        this.currentTrack = track;
        this.currentWrapper = this.wrappers[this.currentTrack.source];
        await this.currentWrapper.playUri(this.currentTrack.uri)
        this.paused = false;

        this.events.onLoad(track);
    }

    /**
     * Resumes current track if available, otherwise plays next track in queue
     */
    async resume() {
        if (this.currentTrack !== null)
            this.currentWrapper.resume();
        else if (this.queue.length > 0)
            await this.load(this.queue.shift());
        else return;
        this.paused = false;
        await this.events.onPlay(this.currentTrack);
    }

    /**
     * Pauses current track, otherwise defaults to unpaused
     */
    async pause() {
        await this.currentWrapper?.pause();
        this.paused = true;
        await this.events.onPause(this.currentTrack);
    }

    /**
     * Sets playback time of current track
     * @param {Number} time time (in seconds) to set the current song to
     */
    async seek(time) {
        if (this.currentTrack !== null)
            await this.currentWrapper.seek(time);
        await this.events.onSeek(this.currentTrack, time);
    }

    /**
     * Skips the song currently playing, and automatically plays the next in queue
     */
    async skip() {
        if (this.queue.length === 0) {
            this.currentWrapper?.pause();
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
        if (!track) return null;
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

        if (destination >= 0) this.events.onMoveQueue(track);
        else this.load(this.queue.shift()).then(() => this.events.onMoveQueue(track));

        return track;
    }

    /**
     * Overwrite the current queue with another track list
     * @param {[Track]} queue queue to replace current track list
     */
    setQueue(queue) {
        this.queue = queue;
        this.events.onSetQueue(queue);
    }

    /**
     * Sets the volume of all wrappers
     * @param {Number} volume volume normalized 0...100 for the current wrapper
     */
    setVolume(volume) {
        Object.values(this.wrappers).forEach(w => w.setVolume(volume));
    }
}

// TODO:
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
        this.roomId = getParam('host') || getParam('join') || getParam('room') || '';
        this.isHost = !!getParam('host');

        const roleLabel = document.getElementById('roleLabel');
        roleLabel.textContent = this.isHost ? 'Host' : 'Client';
        document.getElementById('roomIdLabel').textContent = this.roomId ? `Room: ${this.roomId}` : '';

        if (this.isHost) {
            document.getElementById('hostPanel').classList.remove('hidden');
        }

        // bind user input event listeners to widgets through events object
        const _reg = (a,b,c) => a.addEventListener(b, c);
        _reg(this.playerControls.playButton, 'click', async e => await this.events.playButtonClick(e));
        _reg(this.playerControls.pauseButton, 'click', async e => await this.events.pauseButtonClick(e));
        _reg(this.playerControls.seekBar, 'click', async e => await this.events.seekBarInteract(e));
        _reg(this.playerControls.volumeBar, 'click', e => this.events.volumeBarInteract(e));

        _reg(document.getElementById('queueAddForm'), 'submit', e => e.preventDefault());
        _reg(this.queueDisplay.addTextfield, 'click', e => this.events.queueTextField(e));
        _reg(this.queueDisplay.addButton, 'click', e => this.events.queueAddButton(e));

        if (this.isHost) {
            _reg(this.hostControls.lockRoom, 'change', e => this.events.lockRoomClick(e));
            _reg(this.hostControls.addQueue, 'change', e => this.events.addQueueClick(e));
            _reg(this.hostControls.removeQueue, 'change', e => this.events.removeQueueClick(e));
            _reg(this.hostControls.rearrangeQueue, 'change', e => this.events.rearrangeQueueClick(e));
            _reg(this.hostControls.pausePlay, 'change', e => this.events.pausePlayClick(e));
            _reg(this.hostControls.skip, 'change', e => this.events.skipSongClick(e));

            _reg(this.hostControls.strictMode, 'change', (event) => {
                ;[
                    this.hostControls.addQueue,
                    this.hostControls.removeQueue,
                    this.hostControls.rearrangeQueue,
                    this.hostControls.pausePlay,
                    this.hostControls.skip
                ].forEach((widget) => {
                    if (event.target.checked) {
                        if (widget.checked)
                            widget.click();
                        widget.disabled = true;
                    } else {
                        widget.disabled = false;
                    }
                });
            });
        } else {
            document.getElementById('hostPanel').remove();
        }

        let draggedItem = null;
        let dragStartIdx = null;
        _reg(this.queueDisplay.queueList, 'dragstart', (event) => {
            draggedItem = event.target;
            dragStartIdx = [...this.queueDisplay.queueList.children].indexOf(draggedItem);
            event.target.classList.add('dragging');
        });
        _reg(this.queueDisplay.queueList, 'dragend', (event) => {
            event.target.classList.remove("dragging");
            const dragEndIdx = [...this.queueDisplay.queueList.children].indexOf(draggedItem);
            if (dragEndIdx !== dragStartIdx)
                this.events.queueReorder(dragStartIdx, dragEndIdx);
            draggedItem = dragStartIdx = null;
        });
        _reg(this.queueDisplay.queueList, 'dragover', (event) => {
            event.preventDefault();

            const afterElement = getDragAfterElement(this.queueDisplay.queueList, event.clientY);
            if (afterElement == null) {
                this.queueDisplay.queueList.appendChild(draggedItem);
            } else if (afterElement !== draggedItem) {
                this.queueDisplay.queueList.insertBefore(draggedItem, afterElement);
            }
        });

        function getDragAfterElement(queue, y) {
            const draggableElements = [...queue.querySelectorAll("li:not(.dragging)")];

            return draggableElements.reduce((closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;

                if (offset < 0 && offset > closest.offset) {
                    return { offset, element: child };
                } else {
                    return closest;
                }
            }, { offset: Number.NEGATIVE_INFINITY }).element;
        }
    }

    /**
     * Adds a list of callbacks for UI events
     * @param {{function}} callbacks first class function values for callbacks
     */
    addCallbacks(callbacks) {
        /** @param {Event} event */
        const _ = (event) => console.log(event.target.id, event);
        this.events = Object.assign(this.events ?? {
            playButtonClick: _,
            pauseButtonClick: _,
            seekBarInteract: _,
            volumeBarInteract: _,

            queueTextField: _,
            queueAddButton: _,
            queueReorder: (startIdx, endIdx) => console.log(startIdx, endIdx),

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
        if (!track) {
            this.trackDisplay.trackLabel.textContent = 'No track';
            this.trackDisplay.artistLabel.textContent = '';
            this.trackDisplay.currentTime.textContent = '0:00';
            this.trackDisplay.duration.textContent = '0:00';
            this.playerControls.seekBar.max = 0;
            this.playerControls.seekBar.value = 0;
        } else {
            this.trackDisplay.trackLabel.textContent = track.title;
            this.trackDisplay.artistLabel.textContent = track.author;
            this.trackDisplay.currentTime.textContent = formatTime(track.time);
            this.trackDisplay.duration.textContent = formatTime(track.duration);
            this.playerControls.seekBar.max = track.duration;
            this.playerControls.seekBar.value = track.time;
        }
    }

    /**
     * Sets the seek bar time to a specific number of seconds
     * @param {Number} time
     */
    setSeekBarTime(time) {
        this.playerControls.seekBar.value = time;
    }

    /**
     * Returns an html string for a queue entry representing the provided track
     * @param {Track} track the track to create a queue entry for
     * @return {string} the formatted queue display element for a provided track
     */
    createQueueEntry(track) {
        return `
<li draggable="true" data-uuid="${track.uuid}">
    <static-partial 
        src="/assets/partials/queueElement.html" 
        params='{
            "title":"${track.title}",
            "author":"${track.author}",
            "duration":"${formatTime(track.duration)}"
        }'
        class="
            queue-item
            group
            flex items-center gap-3
            px-3 py-2
            rounded-lg
            bg-theme3
            hover:bg-zinc-800
            active:bg-zinc-700
            transition-colors
            cursor-grab
            select-none
        "
    ></static-partial>
</li>
`
    }

    /**
     * Renders a list of tracks to the UI
     * @param {[Track]} trackList
     */
    renderQueue(trackList) {
        this.queueDisplay.queueCount.innerHTML = trackList.length;
        this.queueDisplay.queueList.innerHTML = trackList
            .map(this.createQueueEntry)
            .join('');
    }
}

// TODO:
class Controller {
    /**
     * @param {Model} model
     * @param {View} view
     */
    constructor(model, view) {
        this.model = model;
        this.view = view;
        this.network = view.isHost ? new Lobby(view.roomId) : new User();
        this.DESYNC_THRESHOLD = 2;
    }

    /**
     * Parses and returns track from textfield UI element
     * @return {Track | null} returns the track from the textfield UI
     */
    async getTrackFromURI() {
        const input = this.view.queueDisplay.addTextfield.value;
        let track = parseTrackInput(input);
        if (!track) {
            console.error('No track found', input);
            return null;
        }

        const wrapper = this.model.wrappers[track.source];
        const {title, author, duration} = await wrapper.fetchUri(track.uri);

        track.title = title;
        track.author = author;
        track.duration = duration;
        return track;
    }

    /**
     * main entrypoint for wiring all events to model and view
     */
    async init() {
        // wire networking events
        if (this.view.isHost)   await this._hostNetworking();
        else                    await this._clientNetworking();

        // update+sync track and display time on pause&play
        let updateInterval = null;
        const _setVisualTime = time => {
            if (this.model.currentTrack) this.model.currentTrack.time = time;
            this.view.playerControls.seekBar.value = time;
            this.view.trackDisplay.currentTime.textContent = formatTime(time);
        };
        const _rerender = () => {
            this.view.renderQueue(this.model.queue);
            this.view.displayTrack(this.model.currentTrack);
        };
        this.model.addCallbacks({
            onPlay: async () => {
                this.view.playerControls.playButton.disabled = true;
                this.view.playerControls.pauseButton.disabled = false;

                const curTime = await this.model.currentWrapper?.getCurrentTime();
                _setVisualTime(curTime);
                updateInterval = setInterval(async () => {
                    _setVisualTime(this.model.currentTrack.time + 1);
                }, 1000);
                _rerender();
            },
            onPause: async () => {
                this.view.playerControls.playButton.disabled = false;
                this.view.playerControls.pauseButton.disabled = true;

                const curTime = await this.model.currentWrapper?.getCurrentTime();
                _setVisualTime(curTime);
                clearInterval(updateInterval);
            },
        });

        // redraw UI on model changes
        this.model.addCallbacks({
            onSeek: (track, time) => _setVisualTime(time),
            onSkip: _rerender,
            onLoad: _rerender,
            onAddQueue: _rerender,
            onRemoveQueue: _rerender,
            onMoveQueue: _rerender,
            onSetQueue: _rerender,
        });

        const _packet = (t, data = {}) => {
            if (this.view.isHost) {
                this.network.sendPacket({
                    type: 'queue:sync',
                    queue: this.model.queue.map(t => t.toJSON())
                });
                this.network.sendPacket({
                    type: 'playback:sync',
                    track: this.model.currentTrack?.toJSON(),
                    paused: this.model.paused,
                });
            } else this.network.sendPacket({type: t, ...data});
        };

        this.view.addCallbacks({
            playButtonClick: async _ => {
                if (this.view.isHost)
                    await this.model.resume();
                _packet('playback:play');
            },
            pauseButtonClick: async _ => {
                if (this.view.isHost)
                    await this.model.pause();
                _packet('playback:pause');
            },
            seekBarInteract: async e => {
                if (this.view.isHost)
                    await this.model.seek(e.target.value);
                _packet('playback:seek', {time: e.target.value});
            },
            volumeBarInteract: e => this.model.setVolume(e.target.value),

            queueReorder: (a, b) => {
                if (this.view.isHost)
                    this.model.moveQueue(a, b);
                _packet('queue:move', {idx: a, dest: b});
            },
            queueAddButton: async _ => {
                const track = await this.getTrackFromURI();
                this.view.queueDisplay.addTextfield.value = '';
                if (!track) return;

                if (this.view.isHost)
                    this.model.addQueue(track);
                _packet('queue:add', {track: track.toJSON()});
            },
        });
    }

    /**
     * initializes host connection and registers packet behavior
     */
    async _hostNetworking() {
        // initialize lobby
        await this.network.initLobby({
            onStart: (id) => console.debug(`[Lobby] Lobby started with id ${id}`),
            onConnection: (conn) => console.debug(`[Lobby] Connection started with ${conn.peer.id}`),
            onOpen: (conn) => console.debug(`[Lobby] Connection opened with ${conn.peer.id}`),
            onClose: (conn) => console.debug(`[Lobby] Connection closed with ${conn.peer.id}`),
            onData: (data) => console.debug(`[Lobby] Data received:`, data),
        });

        // register packet callbacks
        const _queueSync = () => this.network.sendPacket({
            type: 'queue:sync',
            queue: this.model.queue.map(t => t.toJSON())
        });
        const _playbackSync = () => this.network.sendPacket({
            type: 'playback:sync',
            track: this.model.currentTrack?.toJSON(),
            paused: this.model.paused,
        });

        // this._hostSyncInterval = setInterval(() => _playbackSync(), this.DESYNC_THRESHOLD * 1000);

        this.network.onPacket('queue:add', (data, sender) => {
            if (this.view.hostControls.addQueue.checked) {
                data.addedBy = sender;
                this.model.addQueue(Track.fromJSON(data.track));
                console.debug('[Lobby] queue:add', sender);
            }
            _queueSync();
        });
        this.network.onPacket('queue:remove', (data, sender) => {
            if (this.view.hostControls.addQueue.checked) {
                this.model.removeQueue(data.idx);
                console.debug('[Lobby] queue:remove', sender);
            }
            _queueSync();
        });
        this.network.onPacket('queue:move', (data, sender) => {
            if (this.view.hostControls.rearrangeQueue.checked) {
                this.model.moveQueue(data.idx, data.dest);
                console.debug('[Lobby] queue:move', sender);
            }
            _queueSync();
            _playbackSync();
        });

        this.network.onPacket('playback:play', async (data, sender) => {
            if (this.view.hostControls.pausePlay.checked) {
                await this.model.resume();
                console.debug('[Lobby] playback:play', sender);
            }
            _queueSync();
            _playbackSync();
        });
        this.network.onPacket('playback:pause', (data, sender) => {
            if (this.view.hostControls.pausePlay.checked) {
                this.model.pause();
                console.debug('[Lobby] playback:play', sender);
            }
            _playbackSync();
        });
        this.network.onPacket('playback:skip', async (data, sender) => {
            if (this.view.hostControls.skip.checked) {
                await this.model.skip();
                console.debug('[Lobby] playback:skip', sender);
            }
            _queueSync();
            _playbackSync();
        });
        this.network.onPacket('playback:seek', async (data, sender) => {
            if (this.view.hostControls.skip.checked) {
                await this.model.seek(data.time);
                console.debug('[Lobby] playback:seek', sender);
            }
            _queueSync();
            _playbackSync();
        });
    }

    /**
     * initializes client connection, automatically joins room and registers packet behavior
     */
    async _clientNetworking() {
        // initialize client and join room
        await this.network.initUser({
            onStart: (id) => console.debug(`[User] User started with id ${id}`),
            onConnection: (conn) => console.debug(`[User] Connection started with ${conn.peer.id}`),
            onOpen: (conn) => console.debug(`[User] Connection opened with ${conn.peer.id}`),
            onClose: (conn) => console.debug(`[User] Connection closed with ${conn.peer.id}`),
            onData: (data) => console.debug(`[User] Data received:`, data),
        });

        await this.network.joinLobby(this.view.roomId);

        // register packet callbacks
        this.network.onPacket('queue:sync', (data, sender) => {
            const recQueue = data.queue.map(Track.fromJSON);
            this.model.setQueue(recQueue);
        });
        this.network.onPacket('playback:sync', async (data, sender) => {
            const paused = data.paused;
            if (paused) {
                await this.model.pause();
                console.debug('Paused from playback:sync');
            } else {
                await this.model.resume();
                console.debug('Played from playback:sync');
            }

            if (!data.track) {
                this.view.displayTrack(null);
                return console.debug('no track in playback');
            }

            const track = Track.fromJSON(data.track);

            if (track.uuid !== this.model.currentTrack?.uuid)
                await this.model.load(track);

            const deltaTime = Date.now() - data.sentTimestamp;
            const uTime = track.time + (paused ? 0 : deltaTime)/1000.0;
            const dif = Math.abs(this.model.currentTrack.time - uTime);
            if (dif > this.DESYNC_THRESHOLD) {
                await this.model.seek(uTime);
                console.debug(`Re-syncing playback! Caught ${dif}s lag`);
            }
        });
    }
}

window.addEventListener("DOMContentLoaded", async () => {
    const MODEL = new Model();
    const VIEW = new View();
    const CONTROLLER = new Controller(MODEL, VIEW);

    await CONTROLLER.init();

    window._wraps = {MODEL, VIEW, CONTROLLER};
    console.log("SETUP COMPLETE");
});
