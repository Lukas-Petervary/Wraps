import { generateRoomId } from '../js/util.js';

const roomInput = document.getElementById('roomInput');
const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');

createBtn.onclick = () => {
    const roomId = roomInput.value.trim() || generateRoomId();
    window.location.href = `${location.origin}/Wraps/room/?host=${roomId}`;
};

joinBtn.onclick = () => {
    const roomId = roomInput.value.trim();
    if (!roomId) return alert("Please enter a room ID to join.");
    window.location.href = `${location.origin}/Wraps/room/?join=${roomId}`;
};
