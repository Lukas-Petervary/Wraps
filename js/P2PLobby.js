import {Peer} from "https://esm.sh/peerjs@1.5.5?bundle-deps"

export class Lobby {
    constructor(id = '') {
        this.id = id;
        this.peer = null;
        this.connections = {};
        this.handlers = {};
        this.pingInterval = null;
    }

    initLobby(callbacks) {
        this.events = Object.assign({
            onStart: (id) => {},
            onConnection: (conn) => {},
            onOpen: (conn) => {},
            onClose: (conn) => {},
            onData: (data) => {},
        }, callbacks);

        return new Promise((resolve, reject) => {
            try {
                this.peer = new Peer(this.id);
                this.peer.on("open", id => resolve(id));
            } catch (e) {
                this.peer = null;
                reject(e);
            }
        })
            .catch(e => {throw e})
            .then(id => {
                this.events.onStart(id);

                this.peer.on("connection", conn => {
                    this._registerConnection(conn);
                    this.events.onConnection(conn);
                });
            });
    }

    _registerConnection(conn) {
        this.connections[conn.peer] = conn;

        conn.on("open", () => this.events.onOpen(conn));
        conn.on("data", data => {
            this.events.onData(data);
            this._dispatch(data, conn.peer);
        });
        conn.on("close", () => {
            this.events.onClose(conn);
            delete this.connections[conn.peer];
        });
    }

    sendPacket(packet, peerId = null) {
        packet.sentTimestamp = Date.now();
        if (peerId === null) {
            for (const id in this.connections) {
                this.connections[id].send(packet);
            }
        }
        else if (this.connections[peerId]) {
            this.connections[peerId].send(packet);
        } else {
            console.warn("No user with id " + peerId);
        }
    }

    onPacket(type, callback) {
        this.handlers[type] = callback;
    }

    removePacket(type) {
        delete this.handlers[type];
    }

    _dispatch(packet, sender) {
        packet.receivedTimestamp = Date.now();
        if (packet.type && this.handlers[packet.type]) {
            this.handlers[packet.type](packet, sender);
        } else {
            console.warn(`Unhandled packet type "${packet.type}"`);
        }
    }

    enablePing(intervalMs = 2000) {
        this.onPacket("pong", (p, sender) => {
            const now = performance.now();
            const ping = now - p.time;
            console.debug(`[Ping] ${sender}: ${Math.round(ping)} ms`);
        });

        return this.pingInterval = setInterval(() => {
            const now = performance.now();
            this.sendPacket({ type: "ping", time: now });
        }, intervalMs);
    }

    disablePing() {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
        this.removePacket('pong');
    }
}

export class User {
    constructor(id = undefined) {
        this.id = id;
        this.peer = null;
        this.lobbyConnection = null;
        this.handlers = {};

        this.onPacket("ping", (p, sender) => {
            this.sendPacket({ type: "pong", time: p.time }, sender);
        });
    }

    initUser(callbacks) {
        this.events = Object.assign({
            onStart: (id) => {},
            onConnection: (conn) => {},
            onOpen: (conn) => {},
            onClose: (conn) => {},
            onData: (data) => {},
        }, callbacks);

        return new Promise((resolve, reject) => {
            try {
                this.peer = new Peer(this.id);
                this.peer.on("open", id => resolve(id));
            } catch (e) {
                this.peer = null;
                reject(e);
            }
        })
            .catch(e => {throw e})
            .then(id => {
                this.events.onStart(id);

                this.peer.on("connection", conn => {
                    this._registerConnection(conn);
                    this.events.onConnection(conn);
                });
            });
    }

    _registerConnection(conn) {
        this.lobbyConnection = conn;

        conn.on("open", () => this.events.onOpen(conn));
        conn.on("data", data => {
            this.events.onData(data);
            this._dispatch(data, conn.peer);
        });
        conn.on("close", () => {
            this.events.onClose(conn);
            this.lobbyConnection = null;
        });
    }

    joinLobby(hostId) {
        const conn = this.peer.connect(hostId, { reliable: true });
        this._registerConnection(conn);
    }

    sendPacket(packet) {
        packet.sentTimestamp = Date.now();
        this.lobbyConnection.send(packet);
    }

    onPacket(type, callback) {
        this.handlers[type] = callback;
    }

    removePacket(type) {
        delete this.handlers[type];
    }

    _dispatch(packet, sender) {
        packet.receivedTimestamp = Date.now();
        if (packet.type && this.handlers[packet.type]) {
            this.handlers[packet.type](packet, sender);
        } else {
            console.warn(`Unhandled packet type "${packet.type}"`);
        }
    }
}