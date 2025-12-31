import { beginAuth, finishAuthIfPresent, loadToken } from './js/auth.js';

window.addEventListener('DOMContentLoaded', async () => {
    await finishAuthIfPresent();

    const token = loadToken();
    const loginBtn = document.getElementById('spotifyLogin');

    if (token) {
        loginBtn.textContent = 'Spotify Signed In';
        loginBtn.disabled = true;
    } else {
        loginBtn.onclick = async () => {
            await beginAuth();
        };
    }
});
