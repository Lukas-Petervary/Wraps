// js/spotify.js
export async function initPlayer(accessToken, onReady = ()=>{}, onStateChange = ()=>{}){
    return new Promise((resolve, reject) => {
        const player = new Spotify.Player({
            name: "Wraps Player",
            getOAuthToken: cb => { cb(accessToken); }
        });

        player.addListener('ready', ({ device_id }) => {
            onReady(device_id);
            // return wrapper
            const wrapper = {
                source: 'spotify',
                deviceId: device_id,
                playUri: async (uri) => {
                    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${device_id}`, {
                        method: 'PUT',
                        headers: { Authorization: `Bearer ${accessToken}` },
                        body: JSON.stringify({ uris: [uri] })
                    });
                },
                pause: async ()=> player.pause(),
                resume: async ()=> player.resume(),
                seek: async (posMs) => player.seek(Math.floor(posMs/1000)), // Spotify seek expects ms? Spotify.Player.seek expects ms
                getCurrentState: async () => {
                    const s = await player.getCurrentState();
                    if (!s) return null;
                    const track = s.track_window.current_track;
                    return {
                        position: s.position,
                        paused: s.paused,
                        uri: track && track.uri,
                        source: 'spotify',
                        track
                    };
                }
            };

            player.addListener('player_state_changed', (state) => onStateChange(state));
            resolve(wrapper);
        });

        player.addListener('initialization_error', ({ message }) => reject(message));
        player.addListener('authentication_error', ({ message }) => reject(message));
        player.addListener('account_error', ({ message }) => reject(message));

        player.connect();
    });
}

export async function apiGetTrack(accessToken, id){
    const res = await fetch(`https://api.spotify.com/v1/tracks/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) throw new Error('Track fetch failed');
    return res.json();
}
