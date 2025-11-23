// js/auth.js
export const CLIENT_ID = "632da48f28a640ca920d3f3bba68e77e";
export const REDIRECT_URI = `${location.origin}/Wraps/`;
const SCOPE = "streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state";

const CODE_VERIFIER_KEY = "wraps_pkce_verifier";
const TOKEN_KEY = "wraps_spotify_token";

// utilities
function randString(len=64){
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    let s = "";
    for(let i=0;i<len;i++) s += chars[Math.floor(Math.random()*chars.length)];
    return s;
}

async function sha256(str) {
    const buf = new TextEncoder().encode(str);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return new Uint8Array(hash);
}
function base64url(bytes){
    let s = btoa(String.fromCharCode(...bytes));
    s = s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return s;
}

// Begin PKCE: generate verifier & code_challenge, redirect to auth endpoint
export async function beginAuth(){
    const verifier = randString(96);
    localStorage.setItem(CODE_VERIFIER_KEY, verifier);
    const hashed = await sha256(verifier);
    const challenge = base64url(hashed);

    const url = new URL('https://accounts.spotify.com/authorize');
    url.searchParams.set('client_id', CLIENT_ID);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', REDIRECT_URI);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('scope', SCOPE);
    // show dialog to ensure user picks account
    url.searchParams.set('show_dialog', 'true');

    location = url.toString();
}

// After redirect back with ?code=... we must exchange code -> tokens
export async function finishAuthIfPresent(){
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    if (!code) return;
    const verifier = localStorage.getItem(CODE_VERIFIER_KEY);
    if (!verifier) {
        console.error('PKCE verifier missing');
        return;
    }

    // exchange code for token (client-side) — Spotify allows CORS
    const body = new URLSearchParams();
    body.set('client_id', CLIENT_ID);
    body.set('grant_type', 'authorization_code');
    body.set('code', code);
    body.set('redirect_uri', REDIRECT_URI);
    body.set('code_verifier', verifier);

    const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
    });

    if (!res.ok) {
        console.error('Token exchange failed', await res.text());
        return;
    }
    const data = await res.json();
    // data includes access_token, refresh_token, expires_in
    const tokenObj = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + (data.expires_in * 1000) - 60000 // 1 min early
    };
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenObj));
    // cleanup URL
    history.replaceState({}, '', `${location.origin}/Wraps/`);
    // go to home
    location = `${location.origin}/Wraps/`;
}

export function loadToken(){
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (Date.now() > obj.expires_at) {
        // try refresh
        return null; // for simplicity; token refresh can be implemented using refresh_token
    }
    return obj.access_token;
}

export function saveTokenObj(obj){
    localStorage.setItem(TOKEN_KEY, JSON.stringify(obj));
}

export function logout(){
    localStorage.removeItem(TOKEN_KEY);
}
