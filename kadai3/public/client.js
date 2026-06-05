const socket = io();

const loginArea = document.getElementById('loginArea');
const gameArea = document.getElementById('gameArea');
const playerNameInput = document.getElementById('playerName');
const roomIdInput = document.getElementById('roomIdInput');
const roomIdText = document.getElementById('roomIdText');
const message = document.getElementById('message');
const players = document.getElementById('players');
const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const rollBtn = document.getElementById('rollBtn');
const resetBtn = document.getElementById('resetBtn');

createBtn.addEventListener('click', () => {
  const playerName = playerNameInput.value.trim();
  socket.emit('createRoom', playerName);
});

joinBtn.addEventListener('click', () => {
  const playerName = playerNameInput.value.trim();
  const roomId = roomIdInput.value.trim();

  if (!roomId) {
    alert('部屋IDを入力してください。');
    return;
  }

  socket.emit('joinRoom', { roomId, playerName });
});

rollBtn.addEventListener('click', () => {
  socket.emit('roll');
});

resetBtn.addEventListener('click', () => {
  socket.emit('resetRound');
});

socket.on('joinedRoom', (roomId) => {
  loginArea.classList.add('hidden');
  gameArea.classList.remove('hidden');
  roomIdText.textContent = roomId;
});

socket.on('roomUpdate', (room) => {
  roomIdText.textContent = room.roomId;
  message.textContent = room.message;

  players.innerHTML = '';

  room.players.forEach((player) => {
    const card = document.createElement('div');
    card.className = 'playerCard';

    const diceText = player.dice ? player.dice.join(' ') : '- - -';
    const resultText = player.result ? player.result.name : '結果待ち';

    card.innerHTML = `
      <h3>${escapeHtml(player.name)}</h3>
      <div class="dice">${diceText}</div>
      <div class="result">${resultText}</div>
    `;

    players.appendChild(card);
  });

  rollBtn.disabled = room.status !== 'playing';

  if (room.status === 'finished') {
    resetBtn.classList.remove('hidden');
  } else {
    resetBtn.classList.add('hidden');
  }
});

socket.on('errorMessage', (text) => {
  alert(text);
});

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
