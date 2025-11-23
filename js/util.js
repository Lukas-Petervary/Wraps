export function formatMs(ms){
    if (ms == null) return '0:00';
    const s = Math.floor(ms/1000);
    const m = Math.floor(s/60);
    const sec = s%60;
    return `${m}:${sec.toString().padStart(2,'0')}`;
}
