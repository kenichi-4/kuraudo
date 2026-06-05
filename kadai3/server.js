const express = require('express');     //Webページの表示
const http = require('http');
const { Server } = require('socket.io');     //リアルタイム通信

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;     //ポート番号3000
const MIN_PLAYERS = 2;     //最小人数
const MAX_PLAYERS = 8;     //最大人数
const MAX_ROLLS = 3;     //振り直せる回数

app.use(express.static('public'));

const rooms = {};     //作られた部屋の保存

function makeRoomId() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}     //部屋のID生成

function rollDice() {
  return [1, 2, 3].map(() => Math.floor(Math.random() * 6) + 1);
}     //サイコロ

function judgeDice(dice) {
  const [d1, d2, d3] = dice;
  const arr = [...dice].sort((a, b) => a - b);

  if (d1 === 1 && d2 === 1 && d3 === 1) {
    return { name: 'ピンゾロ', rank: 6, point: 1, hasRole: true };
  }

  if (d1 === d2 && d2 === d3) {
    return { name: `${d1}のゾロ目`, rank: 5, point: d1, hasRole: true };
  }

  if (arr[0] === 4 && arr[1] === 5 && arr[2] === 6) {
    return { name: 'シゴロ', rank: 4, point: 6, hasRole: true };
  }

  if (arr[0] === 1 && arr[1] === 2 && arr[2] === 3) {
    return { name: 'ヒフミ', rank: 1, point: 0, hasRole: true };
  }

  if (d1 === d2) return { name: `${d3}の目`, rank: 3, point: d3, hasRole: true };
  if (d2 === d3) return { name: `${d1}の目`, rank: 3, point: d1, hasRole: true };
  if (d1 === d3) return { name: `${d2}の目`, rank: 3, point: d2, hasRole: true };

  return { name: '役なし', rank: 2, point: 0, hasRole: false };
}     //チンチロの役の判別

function compareResults(a, b) {
  if (a.rank !== b.rank) return b.rank - a.rank;
  if (a.point !== b.point) return b.point - a.point;
  return 0;
}     //勝敗の判別

function getPlayerNumber(room) {
  room.nextPlayerNumber += 1;
  return room.nextPlayerNumber;
}     //名前

function isPlayerFinished(player) {
  if (!player.result) return false;
  return player.result.hasRole || player.rollCount >= MAX_ROLLS;
}     //振り終わりを判別

function updateRoomStatus(room) {
  const playerCount = room.players.length;
  const finishedCount = room.players.filter(isPlayerFinished).length;

  if (playerCount < MIN_PLAYERS && finishedCount !== playerCount) {
    room.status = 'playing';
    room.message = `今は${playerCount}人です。練習で振れますが、勝敗表示は最低${MIN_PLAYERS}人必要です。`;
    return;
  }     

  if (finishedCount === playerCount && playerCount >= MIN_PLAYERS) {
    room.status = 'finished';
    const ranking = makeRanking(room.players);
    const top = ranking[0];
    const winners = ranking.filter((p) => compareResults(p.result, top.result) === 0);

    if (winners.length === 1) {
      room.message = `勝者は ${winners[0].name} です！`;
    } else {
      room.message = `同率1位：${winners.map((p) => p.name).join('、')}！`;
    }
    return;
  }    

  if (finishedCount === playerCount && playerCount < MIN_PLAYERS) {
    room.status = 'waiting';
    room.message = `振り終わりました。勝敗表示は最低${MIN_PLAYERS}人必要です。参加者を待つか、もう一回押してください。`;
    return;
  }

  room.status = 'playing';
  room.message = `確定待ち：${finishedCount}/${playerCount}人（役が出るまで最大${MAX_ROLLS}回）`;
}     //部屋の状態確認

function makeRanking(players) {
  return [...players]
    .filter((p) => p.result)
    .sort((a, b) => compareResults(a.result, b.result));
}     //順位の生成

function getPublicRoom(room) {
  const ranking = room.status === 'finished'
    ? makeRanking(room.players).map((player, index) => ({
        id: player.id,
        name: player.name,
        dice: player.dice,
        result: player.result,
        rollCount: player.rollCount,
        place: index + 1
      }))
    : [];

  return {
    roomId: room.roomId,
    status: room.status,
    minPlayers: MIN_PLAYERS,
    maxPlayers: MAX_PLAYERS,
    maxRolls: MAX_ROLLS,
    playerCount: room.players.length,
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      dice: player.dice,
      result: player.result,
      rollCount: player.rollCount,
      finished: isPlayerFinished(player)
    })),
    ranking,
    message: room.message
  };
}     //クライアントに送る情報の生成

function sendRoom(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  updateRoomStatus(room);
  io.to(roomId).emit('roomUpdate', getPublicRoom(room));
}     //部屋にいる全員に送る

function makePlayer(socket, room, playerName) {
  return {
    id: socket.id,
    name: playerName || `プレイヤー${getPlayerNumber(room)}`,
    dice: null,
    result: null,
    rollCount: 0
  };
}     //新しく参加した人の情報

io.on('connection', (socket) => {
   //接続処理
  socket.on('createRoom', (playerName) => {
    let roomId = makeRoomId();
    while (rooms[roomId]) roomId = makeRoomId();

    rooms[roomId] = {
      roomId,
      status: 'waiting',
      players: [],
      nextPlayerNumber: 0,
      message: `最低${MIN_PLAYERS}人必要です。参加者を待っています。`
    };     

    const room = rooms[roomId];
    room.players.push(makePlayer(socket, room, playerName));

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.emit('joinedRoom', roomId);
    sendRoom(roomId);
  });    //

  socket.on('joinRoom', ({ roomId, playerName }) => {
    roomId = String(roomId || '').toUpperCase();
    const room = rooms[roomId];

    if (!room) {
      socket.emit('errorMessage', 'その部屋はありません。');
      return;
    }

    if (room.players.length >= MAX_PLAYERS) {
      socket.emit('errorMessage', `この部屋は満員です。最大${MAX_PLAYERS}人までです。`);
      return;
    }

    if (room.players.some((p) => p.id === socket.id)) {
      socket.emit('errorMessage', 'すでにこの部屋に参加しています。');
      return;
    }

    room.players.push(makePlayer(socket, room, playerName));

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.emit('joinedRoom', roomId);
    sendRoom(roomId);
  });     //部屋の作成

  socket.on('roll', () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room) return;
s

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;

    if (isPlayerFinished(player)) {
      socket.emit('errorMessage', 'このラウンドではもう確定しています。');
      return;
    }

    if (player.rollCount >= MAX_ROLLS) {
      socket.emit('errorMessage', `最大${MAX_ROLLS}回までです。`);
      return;
    }

    player.dice = rollDice();
    player.result = judgeDice(player.dice);
    player.rollCount += 1;

    sendRoom(roomId);
  });

  socket.on('resetRound', () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room) return;

    room.players.forEach((p) => {
      p.dice = null;
      p.result = null;
      p.rollCount = 0;
    });

    sendRoom(roomId);
  });

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room) return;

    room.players = room.players.filter((p) => p.id !== socket.id);

    if (room.players.length === 0) {
      delete rooms[roomId];
      return;
    }

    room.players.forEach((p) => {
      p.dice = null;
      p.result = null;
      p.rollCount = 0;
    });

    sendRoom(roomId);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
