const socket = io();

const loginArea = document.getElementById('loginArea');
const gameArea = document.getElementById('gameArea');
const playerNameInput = document.getElementById('playerName');
const roomIdInput = document.getElementById('roomIdInput');
const roomIdText = document.getElementById('roomIdText');
const message = document.getElementById('message');
const players = document.getElementById('players');
const rankingArea = document.getElementById('rankingArea');
const rankingList = document.getElementById('rankingList');
const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const rollBtn = document.getElementById('rollBtn');
const resetBtn = document.getElementById('resetBtn');
const playerCountText = document.getElementById('playerCountText');

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
  playerCountText.textContent = `${room.playerCount}/${room.maxPlayers}人`;

  players.innerHTML = '';

  room.players.forEach((player) => {
    const card = document.createElement('div');
    card.className = 'playerCard';

    const diceText = player.dice ? player.dice.join(' ') : '- - -';
    const resultText = player.result ? player.result.name : '結果待ち';
    const rollCountText = `${player.rollCount}/${room.maxRolls}回`;
    let statusText = 'まだ';
    if (player.finished) {
      statusText = '確定';
    } else if (player.rollCount > 0) {
      statusText = 'もう一回振れます';
    }

    card.innerHTML = `
      <h3>${escapeHtml(player.name)}</h3>
      <div class="dice">${diceText}</div>
      <div class="result">${resultText}</div>
      <div class="status">${statusText}</div>
      <div class="status">振った回数：${rollCountText}</div>
    `;

    players.appendChild(card);
  });

  rollBtn.disabled = room.status !== 'playing';

  if (room.status === 'finished') {
    resetBtn.classList.remove('hidden');
    rankingArea.classList.remove('hidden');
    rankingList.innerHTML = '';

    room.ranking.forEach((player) => {
      const li = document.createElement('li');
      li.textContent = `${player.place}位：${player.name}　${player.dice.join(' ')}　${player.result.name}（${player.rollCount}回）`;
      rankingList.appendChild(li);
    });
  } else {
    resetBtn.classList.add('hidden');
    rankingArea.classList.add('hidden');
    rankingList.innerHTML = '';
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
