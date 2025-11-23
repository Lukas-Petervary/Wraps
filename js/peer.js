// js/peer.js
// createRoom(roomId, handlers) --> { broadcast, isLeader, startHeartbeats, queue }
export async function createRoom(roomId, handlers = {}) {
    const peer = new Peer(); // random peer id
    let connections = [];
    let isLeader = false;
    let leaderId = null;
    let queue = [];

    const participants = new Set();

    function updateParticipants(){
        handlers.onConnectedPeers && handlers.onConnectedPeers(Array.from(participants));
    }

    peer.on('open', id => {
        // if this peer's id matches the roomId, we're the leader (creator navigated to #id)
        if (id === roomId) {
            isLeader = true;
            leaderId = id;
            participants.add(id);
            updateParticipants();
        } else {
            // if not leader, attempt to connect to leader
            const conn = peer.connect(roomId);
            conn.on('open', () => {
                connections.push(conn);
                participants.add(conn.peer);
                updateParticipants();
            });
            conn.on('data', (d) => incoming(d, conn.peer));
            conn.on('close', () => {
                participants.delete(conn.peer);
                updateParticipants();
            });
        }
    });

    peer.on('connection', conn => {
        // someone connected to us (leader will receive connections)
        connections.push(conn);
        participants.add(conn.peer);
        updateParticipants();

        conn.on('data', d => incoming(d, conn.peer));
        conn.on('close', () => {
            participants.delete(conn.peer);
            updateParticipants();
        });

        // send existing state (queue) to new peer
        conn.on('open', () => {
            conn.send({ type: 'QUEUE_SYNC', queue });
        });
    });

    function broadcast(msg){
        connections.forEach(c=>{
            try { c.send(msg); } catch(e){}
        });
    }

    function incoming(msg, from){
        // forward to handler
        handlers.onMessage && handlers.onMessage(msg, { from });
        // If leader, maybe act on messages or rebroadcast as appropriate
    }

    let hbInterval = null;
    function startHeartbeats(getStateCb){
        if (!isLeader) return;
        if (hbInterval) clearInterval(hbInterval);
        hbInterval = setInterval(async () => {
            const stateSnapshot = await getStateCb();
            const payload = {
                type: 'HEARTBEAT',
                timestamp: Date.now(),
                position_ms: stateSnapshot.position,
                uri: stateSnapshot.uri,
                source: stateSnapshot.source, // 'spotify' or 'youtube'
                paused: !!stateSnapshot.paused
            };

            // broadcast heartbeat
            broadcast(payload);
        }, 2000);
    }

    return {
        peer,
        broadcast,
        incoming,
        isLeader,
        startHeartbeats,
        get queue(){ return queue; },
        set queue(q){ queue = q; },
        // small helper to expose participants
        getParticipants(){ return Array.from(participants); }
    };
}
