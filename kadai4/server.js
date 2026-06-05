"use strict";

const express = require("express");
const app = express();

app.set("view engine", "ejs");
app.use("/public", express.static(__dirname + "/public"));
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 8080;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 8;
const MAX_ROLLS = 3;

let rooms = {};

function makeRoomId() {
  let roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
  while (rooms[roomId]) {
    roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
  }
  return roomId;
}

function makePlayerId() {
  return Math.random().toString(36).substring(2, 10);
}

function rollDice() {
  return [
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1
  ];
}

function judgeDice(dice) {
  const d1 = dice[0];
  const d2 = dice[1];
  const d3 = dice[2];
  const arr = [...dice].sort((a, b) => a - b);

  if (d1 === 1 && d2 === 1 && d3 === 1) {
    return { name: "ピンゾロ", rank: 6, point: 1, hasRole: true };
  }

  if (d1 === d2 && d2 === d3) {
    return { name: d1 + "のゾロ目", rank: 5, point: d1, hasRole: true };
  }

  if (arr[0] === 4 && arr[1] === 5 && arr[2] === 6) {
    return { name: "シゴロ", rank: 4, point: 6, hasRole: true };
  }

  if (arr[0] === 1 && arr[1] === 2 && arr[2] === 3) {
    return { name: "ヒフミ", rank: 1, point: 0, hasRole: true };
  }

  if (d1 === d2) {
    return { name: d3 + "の目", rank: 3, point: d3, hasRole: true };
  }

  if (d2 === d3) {
    return { name: d1 + "の目", rank: 3, point: d1, hasRole: true };
  }

  if (d1 === d3) {
    return { name: d2 + "の目", rank: 3, point: d2, hasRole: true };
  }

  return { name: "役なし", rank: 2, point: 0, hasRole: false };
}

function isFinished(player) {
  if (!player.result) return false;
  if (player.result.hasRole) return true;
  if (player.rollCount >= MAX_ROLLS) return true;
  return false;
}

function compareResult(a, b) {
  if (a.result.rank !== b.result.rank) {
    return b.result.rank - a.result.rank;
  }
  if (a.result.point !== b.result.point) {
    return b.result.point - a.result.point;
  }
  return 0;
}

function makeRanking(players) {
  return players
    .filter((player) => player.result)
    .sort(compareResult)
    .map((player, index) => {
      return {
        place: index + 1,
        name: player.name,
        dice: player.dice,
        result: player.result,
        rollCount: player.rollCount
      };
    });
}

function updateRoom(room) {
  const finishedCount = room.players.filter(isFinished).length;
  const playerCount = room.players.length;

  if (playerCount < MIN_PLAYERS) {
    room.status = "playing";
    room.message = "現在" + playerCount + "人です。最低" + MIN_PLAYERS + "人から対戦できます。";
    return;
  }

  if (finishedCount === playerCount) {
    room.status = "finished";
    const ranking = makeRanking(room.players);
    const top = ranking[0];
    const winners = ranking.filter((player) => {
      return player.result.rank === top.result.rank && player.result.point === top.result.point;
    });

    if (winners.length === 1) {
      room.message = "勝者は" + winners[0].name + "です。";
    } else {
      room.message = "同率1位は" + winners.map((player) => player.name).join("、") + "です。";
    }
    return;
  }

  room.status = "playing";
  room.message = "確定待ち：" + finishedCount + "/" + playerCount + "人";
}

function addPlayer(room, name) {
  const player = {
    id: makePlayerId(),
    name: name || "プレイヤー" + (room.players.length + 1),
    dice: null,
    result: null,
    rollCount: 0
  };
  room.players.push(player);
  return player;
}

app.get("/", (req, res) => {
  res.render("index", { error: "" });
});

app.post("/create", (req, res) => {
  const roomId = makeRoomId();
  const room = {
    id: roomId,
    players: [],
    status: "waiting",
    message: "参加者を待っています。"
  };

  rooms[roomId] = room;
  const player = addPlayer(room, req.body.name);
  updateRoom(room);

  res.redirect("/room/" + roomId + "?playerId=" + player.id);
});

app.post("/join", (req, res) => {
  const roomId = String(req.body.roomId || "").toUpperCase();
  const room = rooms[roomId];

  if (!room) {
    res.render("index", { error: "指定された部屋IDは存在しません。" });
    return;
  }

  if (room.players.length >= MAX_PLAYERS) {
    res.render("index", { error: "この部屋は満員です。" });
    return;
  }

  const player = addPlayer(room, req.body.name);
  updateRoom(room);

  res.redirect("/room/" + roomId + "?playerId=" + player.id);
});

app.get("/room/:roomId", (req, res) => {
  const roomId = String(req.params.roomId || "").toUpperCase();
  const playerId = req.query.playerId;
  const room = rooms[roomId];

  if (!room) {
    res.render("index", { error: "部屋が見つかりません。" });
    return;
  }

  const me = room.players.find((player) => player.id === playerId);
  updateRoom(room);

  res.render("room", {
    room: room,
    me: me,
    playerId: playerId,
    maxRolls: MAX_ROLLS,
    maxPlayers: MAX_PLAYERS,
    ranking: makeRanking(room.players)
  });
});

app.post("/room/:roomId/roll", (req, res) => {
  const roomId = String(req.params.roomId || "").toUpperCase();
  const playerId = req.body.playerId;
  const room = rooms[roomId];

  if (!room) {
    res.redirect("/");
    return;
  }

  const player = room.players.find((p) => p.id === playerId);
  if (!player) {
    res.redirect("/room/" + roomId);
    return;
  }

  if (!isFinished(player) && player.rollCount < MAX_ROLLS) {
    player.dice = rollDice();
    player.result = judgeDice(player.dice);
    player.rollCount += 1;
  }

  updateRoom(room);
  res.redirect("/room/" + roomId + "?playerId=" + playerId);
});

app.post("/room/:roomId/reset", (req, res) => {
  const roomId = String(req.params.roomId || "").toUpperCase();
  const playerId = req.body.playerId;
  const room = rooms[roomId];

  if (!room) {
    res.redirect("/");
    return;
  }

  for (const player of room.players) {
    player.dice = null;
    player.result = null;
    player.rollCount = 0;
  }

  updateRoom(room);
  res.redirect("/room/" + roomId + "?playerId=" + playerId);
});

app.listen(PORT, () => {
  console.log("Example app listening on port " + PORT + "!");
});
