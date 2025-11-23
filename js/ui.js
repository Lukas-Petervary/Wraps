// js/ui.js
export function renderQueueItem(item, idx, { onRemove } = {}) {
    const li = document.createElement('li');
    li.className = 'flex items-center justify-between p-2 bg-slate-900 rounded-lg';
    const left = document.createElement('div');
    left.className = 'text-sm';
    left.innerHTML = `<div class="font-semibold">${escapeHtml(item.title||item.uri)}</div><div class="text-xs opacity-70">${escapeHtml(item.artist||'')}</div>`;
    const right = document.createElement('div');
    right.className = 'flex gap-2 items-center';
    const playBtn = document.createElement('button');
    playBtn.className = 'px-2 py-1 bg-green-500 rounded text-xs';
    playBtn.textContent = 'Play';
    playBtn.onclick = () => {
        // emit SET_TRACK from caller; here we just call onRemove? The calling code should wire an event.
        if (typeof item.onPlay === 'function') item.onPlay();
    };
    const rm = document.createElement('button');
    rm.className = 'px-2 py-1 bg-red-600 rounded text-xs';
    rm.textContent = 'Remove';
    rm.onclick = onRemove;
    right.appendChild(playBtn);
    right.appendChild(rm);
    li.appendChild(left);
    li.appendChild(right);
    return li;
}

function escapeHtml(s=''){ return String(s).replace(/[&<>"']/g, (m)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
