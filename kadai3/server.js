const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

const rooms = {};

function makeRoomId() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function rollDice() {
  return [1, 2, 3].map(() => Math.floor(Math.random() * 6) + 1);
}

function judgeDice(dice) {
  const [d1, d2, d3] = dice;
  const arr = [...dice].sort((a, b) => a - b);

  if (d1 === 1 && d2 === 1 && d3 === 1) {
    return { name: 'ピンゾロ', rank: 6, point: 1 };
  }

  if (d1 === d2 && d2 === d3) {
    return { name: `${d1}のゾロ目`, rank: 5, point: d1 };
  }

  if (arr[0] === 4 && arr[1] === 5 && arr[2] === 6) {
    return { name: 'シゴロ', rank: 4, point: 6 };
  }

  if (arr[0] === 1 && arr[1] === 2 && arr[2] === 3) {
    return { name: 'ヒフミ', rank: 1, point: 0 };
  }

  if (d1 === d2) {
    return { name: `${d3}の目`, rank: 3, point: d3 };
  }
  if (d2 === d3) {
    return { name: `${d1}の目`, rank: 3, point: d1 };
  }
  if (d1 === d3) {
    return { name: `${d2}の目`, rank: 3, point: d2 };
  }

  return { name: '役なし', rank: 2, point: 0 };
}

function compareResults(a, b) {
  if (a.rank !== b.rank) return a.rank > b.rank ? 1 : -1;
  if (a.point !== b.point) return a.point > b.point ? 1 : -1;
  return 0;
}

function getPublicRoom(room) {
  return {
    roomId: room.roomId,
    status: room.status,
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      dice: player.dice,
      result: player.result
    })),
    message: room.message
  };
}

function sendRoom(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  io.to(roomId).emit('roomUpdate', getPublicRoom(room));
}

io.on('connection', (socket) => {
  socket.on('createRoom', (playerName) => {
    let roomId = makeRoomId();
    while (rooms[roomId]) roomId = makeRoomId();

    rooms[roomId] = {
      roomId,
      status: 'waiting',
      players: [
        {
          id: socket.id,
          name: playerName || 'プレイヤー1',
          dice: null,
          result: null
        }
      ],
      message: '相手の参加を待っています。'
    };

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.emit('joinedRoom', roomId);
    sendRoom(roomId);
  });

  socket.on('joinRoom', ({ roomId, playerName }) => {
    roomId = String(roomId || '').toUpperCase();
    const room = rooms[roomId];

    if (!room) {
      socket.emit('errorMessage', 'その部屋はありません。');
      return;
    }

    if (room.players.length >= 2) {
      socket.emit('errorMessage', 'この部屋は満員です。');
      return;
    }

    room.players.push({
      id: socket.id,
      name: playerName || 'プレイヤー2',
      dice: null,
      result: null
    });
    room.status = 'playing';
    room.message = '2人そろいました。サイコロを振ってください。';

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.emit('joinedRoom', roomId);
    sendRoom(roomId);
  });

  socket.on('roll', () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;

    if (player.dice) {
      socket.emit('errorMessage', 'このラウンドではもう振っています。');
      return;
    }

    player.dice = rollDice();
    player.result = judgeDice(player.dice);
    room.message = `${player.name} がサイコロを振りました。`;

    if (room.players.length === 2 && room.players.every((p) => p.dice)) {
      const [p1, p2] = room.players;
      const result = compareResults(p1.result, p2.result);
      room.status = 'finished';

      if (result === 1) {
        room.message = `${p1.name} の勝ち！`;
      } else if (result === -1) {
        room.message = `${p2.name} の勝ち！`;
      } else {
        room.message = '引き分け！';
      }
    }

    sendRoom(roomId);
  });

  socket.on('resetRound', () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room) return;

    room.players.forEach((p) => {
      p.dice = null;
      p.result = null;
    });
    room.status = room.players.length === 2 ? 'playing' : 'waiting';
    room.message = '次のラウンドです。サイコロを振ってください。';
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

    room.status = 'waiting';
    room.players.forEach((p) => {
      p.dice = null;
      p.result = null;
    });
    room.message = '相手が退出しました。新しい相手を待っています。';
    sendRoom(roomId);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
