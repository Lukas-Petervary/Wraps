/**
 * THIS IS DEPRECATED AND IS BEING PHASED OUT !!!
 */

import { getParam, parseTrackInput, formatTime, renderQueueItem } from '../js/util.js';
import Player from "../js/wrappers/Player.js";
import { Track } from "../js/wrappers/AbstractWrapper.js"
import { Lobby, User } from "../js/P2PLobby.js";

const roomId = getParam('host') || getParam('join') || getParam('room') || '';
const isHost = !!getParam('host');

const roleLabel = document.getElementById('roleLabel');
roleLabel.textContent = isHost ? 'Host' : 'Client';
document.getElementById('roomIdLabel').textContent = roomId ? `Room: ${roomId}` : '';

const currentTrackLabel = document.getElementById('currentTrack');
const currentArtistLabel = document.getElementById('currentArtist');
const queueListEl = document.getElementById('queueList');
const queueCount = document.getElementById('queueCount');

const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const seekBar = document.getElementById('seekBar');
const currentTimeLabel = document.getElementById('currentTime');
const durationLabel = document.getElementById('duration');
const bufferInfo = document.getElementById('bufferInfo');
const volumeControl = document.getElementById('volume');

const addInput = document.getElementById('addInput');
const addBtn = document.getElementById('addBtn');
const dropZone = document.getElementById('dropZone');
const addMessage = document.getElementById('addMessage');

let player = null;
let network = null;
let STRICT_MODE = false; // determines if users can modify queue vs host exclusive
const PLAYBACK_SYNC_THRESHOLD = 2; // number of seconds of allowable drift

function _renderQueue() {
    queueListEl.innerHTML = '';
    player.queue.forEach((track, idx) => {
        const li = renderQueueItem(track, idx, {
            onPlay: (track, idx) => {
                if (isHost)
                    player.moveQueue(idx, -1);
                else network.sendPacket({
                    type: 'queue:move',
                    idx,
                    destination: -1
                });
            },
            onRemove: (track, idx) => {
                if (isHost) player.removeQueue(idx);
                else network.sendPacket({
                    type: 'queue:remove',
                    idx
                });
            }
        });
        queueListEl.appendChild(li);
    });
    queueCount.textContent = String(player.queue.length);
}

function updateCurrentUI(track) {
    if (!track) {
        currentTrackLabel.textContent = 'No track';
        currentArtistLabel.textContent = '';
        durationLabel.textContent = '0:00';
        return;
    }
    currentTrackLabel.textContent = track.title || track.uri;
    currentArtistLabel.textContent = track.artist || '';
    if (track.duration) durationLabel.textContent = formatTime(track.duration);
}

async function setupUI() {
    playBtn.addEventListener('click', async () => {
        if (isHost) {
            player.play();
            _renderQueue();
            _sendQueueSync();
            _sendPlaybackSync()
        } else network.sendPacket({
            type: 'playback:play',
        });
    });

    pauseBtn.addEventListener('click', async () => {
        if (isHost) player.pause();
        network.sendPacket({ type: 'playback:pause' });
    });

    seekBar.addEventListener('input', async (e) => {
        const pct = parseFloat(e.target.value);
        const dur = await player.getDuration();
        if (!dur) return;
        const newPos = (pct / 100) * dur;
        currentTimeLabel.textContent = formatTime(newPos);
    });

    seekBar.addEventListener('change', async (e) => {
        const pct = parseFloat(e.target.value);
        const dur = await player.getDuration();
        if (!dur) return;
        const newPos = (pct / 100) * dur;
        await player.seek(newPos);
        if (isHost && network && network.emit) network.emit('seek', { position: newPos });
    });

    // Add button
    addBtn.addEventListener('click', async () => {
        const raw = addInput.value && addInput.value.trim();
        if (!raw) return;
        const parsed = parseTrackInput(raw);
        if (!parsed) {
            addMessage.textContent = 'Could not parse track. Use YouTube/Spotify link or ID.';
            return;
        }
        player.addQueue(parsed);

        addInput.value = '';
        addMessage.textContent = '';
    });

    // Drag-and-drop
    ;['dragenter','dragover'].forEach(evt => {
        dropZone.addEventListener(evt, (e) => {
            e.preventDefault();
            dropZone.classList.add('border-indigo-500', 'bg-slate-700/60');
        });
    });
    ;['dragleave','drop'].forEach(evt => {
        dropZone.addEventListener(evt, (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-indigo-500', 'bg-slate-700/60');
        });
    });

    dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        const data = e.dataTransfer;
        const text = (data.getData('text') || data.getData('text/uri-list') || '').trim();
        if (!text) {
            addMessage.textContent = 'No URL/text found in drop';
            return;
        }
        const parts = text.split(/\s+/);
        for (const p of parts) {
            const parsed = parseTrackInput(p);
            if (!parsed) continue;
            player.addQueue(parsed);
        }
        addMessage.textContent = '';
    });

    // keyboard Enter
    addInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addBtn.click();
    });
}

function _sendQueueSync() {
    network.sendPacket({
        type: 'queue:sync',
        queue: player.queue.map(t => t.toJSON())
    });
    console.log('[Lobby] Sent queue sync packet!');
}

function _sendPlaybackSync() {
    network.sendPacket({
        type: 'playback:sync',
        track: player?.currentTrack?.toJSON(),
        paused: player.paused
    });
}

// Network wiring
async function initNetwork() {
    if (isHost) {
        network = new Lobby(roomId);

        await network.initLobby({
            onStart: (id) => console.log(`[Lobby] Lobby started with id ${id}`),
            onConnection: (conn) => console.log(`[Lobby] Connection started with ${conn.peer.id}`),
            onOpen: (conn) => console.log(`[Lobby] Connection opened with ${conn.peer.id}`),
            onClose: (conn) => console.log(`[Lobby] Connection closed with ${conn.peer.id}`),
            onData: (data) => console.log(`[Lobby] Data received:`, data),
        });

        network.onPacket('queue:add', async (data, sender) => {
            if (STRICT_MODE) return;
            data.addedBy = sender;
            player.addQueue(Track.fromJSON(data.track));
        });
        network.onPacket('queue:remove', async (data, sender) => {
            if (STRICT_MODE) return;
            player.removeQueue(data.idx);
        });
        network.onPacket('queue:skip', async (data, sender) => {
            if (STRICT_MODE) return;
            await player.skip();
            network.sendPacket({type: 'queue:skip'});
        });
        network.onPacket('queue:move', async (data, sender) => {
            if (STRICT_MODE) return;
            player.moveQueue(data.idx, data.destination);
            if (data.destination < 0)
                _sendPlaybackSync();
            _sendQueueSync();
        });

        network.onPacket('playback:pause', async (payload, sender) => {
            if (STRICT_MODE) return;
            player.pause();
            network.sendPacket({type: 'playback:pause'});
        });
        network.onPacket('playback:play', async (payload, sender) => {
            if (STRICT_MODE) return;
            player.play();
            network.sendPacket({type: 'playback:play'});
        });
        network.onPacket('playback:seek', async (payload, sender) => {
            if (STRICT_MODE) return;
            player.seek(payload.time);
            network.sendPacket({type: 'playback:seek', time: payload.time});
        });

        network.PLAYBACK_SYNC_INTERVAL = setInterval(_sendPlaybackSync, 500);
        network.QUEUE_SYNC_INTERVAL = setInterval(_sendQueueSync, 10_000);
    } else {
        network = new User();

        await network.initUser({
            onStart: (id) => console.log(`[User] User started with id ${id}`),
            onConnection: (conn) => console.log(`[User] Connection started with ${conn.peer.id}`),
            onOpen: (conn) => console.log(`[User] Connection opened with ${conn.peer.id}`),
            onClose: (conn) => console.log(`[User] Connection closed with ${conn.peer.id}`),
            onData: (data) => console.log(`[User] Data received:`, data),
        });

        await network.joinLobby(roomId);

        network.onPacket('queue:sync', async (packet, sender) => {
            player.queue = packet.queue.map(jTrack => Track.fromJSON(jTrack));
            _renderQueue();
        });

        network.onPacket('playback:play', async (_) => player.play());
        network.onPacket('playback:pause', async (_) => player.pause());
        network.onPacket('playback:seek', async (packet) => player.seek(packet.time));
        network.onPacket('playback:sync', async (packet) => {
            if (!packet.track) return;
            const track = Track.fromJSON(packet.track);
            const latency = packet.receivedTimestamp - packet.sentTimestamp;

            if (track.uuid !== player.currentTrack?.uuid)
                player.load(track);
            else if (track.time - player.currentTrack.time - latency > PLAYBACK_SYNC_THRESHOLD)
                player.seek(track.time);

            if (packet.paused && !player.paused)
                player.pause();
            else if (!packet.paused && player.paused)
                player.play();
        });
    }
}

async function main() {
    const _p = (event) => (t, _) => console.log(`[MediaPlayer] ${event} triggered`)
    player = new Player({
        onLoad: _p("onLoad"),
        onPlay: () => {
            if (isHost) network.sendPacket({
                type: 'playback:play'
            });
        },
        onPause: () => {
            if (isHost) network.sendPacket({
                type: 'playback:pause'
            });
        },
        onSeek: (track, time) => {
            if (isHost) network.sendPacket({
                type: 'playback:seek',
                time
            });
        },
        onSkip: _p("onSkip"),
        onAddQueue: (track) => {
            if (isHost) _sendQueueSync()
            else network.sendPacket({
                type: 'queue:add',
                track: track.toJSON(),
            });
            _renderQueue();
        },
        onRemoveQueue: (track) => {
            if (isHost) _sendQueueSync()
            else network.sendPacket({
                type: 'queue:remove',
                track: track.toJSON(),
            });
            _renderQueue();
        },
        onMoveQueue: (track) => {
            if (isHost)
                _sendPlaybackSync();
            _renderQueue();
        },
    });

    await setupUI();
    await initNetwork();

    window._wraps = { player, network };
}

await main();