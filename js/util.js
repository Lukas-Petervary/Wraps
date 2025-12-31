export function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
}

export function generateRoomId(length = 6) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let str = '';
    for (let i = 0; i < length; i++) str += chars[Math.floor(Math.random() * chars.length)];
    return str;
}

// format seconds -> M:SS
export function formatTime(sec) {
    if (!sec || isNaN(sec)) return '0:00';
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

import { Track } from "./wrappers/AbstractWrapper.js";
export function parseTrackInput(str) {
    if (!str || typeof str !== 'string') return null;
    const s = str.trim();

    // YouTube full URL
    const ytMatch = s.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
        const id = ytMatch[1];
        return new Track('youtube', id, `https://www.youtube.com/watch?v=${id}`);
    }
    // bare 11-char id
    if (/^[a-zA-Z0-9_-]{11}$/.test(s)) {
        return new Track('youtube', s, `https://www.youtube.com/watch?v=${s}`);
    }

    // Spotify URL
    const spMatch = s.match(/(?:open\.spotify\.com\/track\/|spotify:track:)([a-zA-Z0-9]+)/);
    if (spMatch) {
        const id = spMatch[1];
        return new Track('spotify', id, `spotify:track:${id}`);
    }

    // Sometimes text includes a URL; try to extract URL from text
    try {
        const possible = (s.match(/https?:\/\/[^\s]+/) || [null])[0];
        if (possible) return parseTrackInput(possible);
    } catch (e) {}

    return null;
}

export function renderQueueItem(item, idx, { onPlay, onRemove } = {}) {
    const li = document.createElement('li');
    li.className = 'flex items-center justify-between p-2 bg-slate-900 rounded-lg';

    const left = document.createElement('div');
    left.className = 'text-sm';
    left.innerHTML = `
    <div class="font-semibold">${escapeHtml(item.title || item.uri)}</div>
    <div class="text-xs opacity-70">${escapeHtml(item.artist || '')}</div>
  `;

    const right = document.createElement('div');
    right.className = 'flex gap-2 items-center';

    const playBtn = document.createElement('button');
    playBtn.className = 'px-2 py-1 bg-green-500 rounded text-xs';
    playBtn.textContent = 'Play';
    playBtn.onclick = () => { if (onPlay) onPlay(item, idx); };

    const rmBtn = document.createElement('button');
    rmBtn.className = 'px-2 py-1 bg-red-600 rounded text-xs';
    rmBtn.textContent = 'Remove';
    rmBtn.onclick = () => { if (onRemove) onRemove(item, idx); };

    right.appendChild(playBtn);
    right.appendChild(rmBtn);
    li.appendChild(left);
    li.appendChild(right);
    return li;
}

function escapeHtml(s = '') {
    return String(s).replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
