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

// 最初のページ
app.get("/", (req, res) => {
  res.render("index", { error: "" });
});

// 部屋を作る
app.post("/create", (req, res) => {
  const name = req.body.name || "プレイヤー1";

  let roomId = Math.random().toString(36).substring(2, 6).toUpperCase();

  while (rooms[roomId]) {
    roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
  }

  const playerId = Math.random().toString(36).substring(2, 10);

  rooms[roomId] = {
    id: roomId,
    players: [
      {
        id: playerId,
        name: name,
        dice: null,
        result: null,
        rollCount: 0
      }
    ],
    status: "playing",
    message: "参加者を待っています。"
  };

  res.redirect("/room/" + roomId + "?playerId=" + playerId);
});

// 部屋に参加する
app.post("/join", (req, res) => {
  const name = req.body.name || "プレイヤー";
  const roomId = req.body.roomId.toUpperCase();

  const room = rooms[roomId];

  if (!room) {
    res.render("index", { error: "その部屋はありません。" });
    return;
  }

  if (room.players.length >= MAX_PLAYERS) {
    res.render("index", { error: "この部屋は満員です。" });
    return;
  }

  const playerId = Math.random().toString(36).substring(2, 10);

  room.players.push({
    id: playerId,
    name: name,
    dice: null,
    result: null,
    rollCount: 0
  });

  res.redirect("/room/" + roomId + "?playerId=" + playerId);
});

// 部屋画面を表示
app.get("/room/:roomId", (req, res) => {
  const roomId = req.params.roomId;
  const playerId = req.query.playerId;

  const room = rooms[roomId];

  if (!room) {
    res.send("部屋が見つかりません。");
    return;
  }

  const me = room.players.find((p) => p.id === playerId);

  if (!me) {
    res.send("プレイヤーが見つかりません。");
    return;
  }

  let finishedCount = 0;

  for (const player of room.players) {
    if (player.result) {
      if (player.result.hasRole || player.rollCount >= MAX_ROLLS) {
        finishedCount++;
      }
    }
  }

  if (room.players.length < MIN_PLAYERS) {
    room.message = "現在" + room.players.length + "人です。最低2人から対戦できます。";
    room.status = "playing";
  } else if (finishedCount === room.players.length) {
    room.status = "finished";

    const ranking = room.players
      .filter((p) => p.result)
      .sort((a, b) => {
        if (a.result.rank !== b.result.rank) {
          return b.result.rank - a.result.rank;
        }
        return b.result.point - a.result.point;
      });

    room.message = "勝者は " + ranking[0].name + " です。";
  } else {
    room.status = "playing";
    room.message = "確定待ち：" + finishedCount + "/" + room.players.length + "人";
  }

  const ranking = room.players
    .filter((p) => p.result)
    .sort((a, b) => {
      if (a.result.rank !== b.result.rank) {
        return b.result.rank - a.result.rank;
      }
      return b.result.point - a.result.point;
    });

  res.render("room", {
    room: room,
    me: me,
    playerId: playerId,
    maxRolls: MAX_ROLLS,
    maxPlayers: MAX_PLAYERS,
    ranking: ranking
  });
});

// サイコロを振る
app.post("/room/:roomId/roll", (req, res) => {
  const roomId = req.params.roomId;
  const playerId = req.body.playerId;

  const room = rooms[roomId];

  if (!room) {
    res.send("部屋が見つかりません。");
    return;
  }

  const player = room.players.find((p) => p.id === playerId);

  if (!player) {
    res.send("プレイヤーが見つかりません。");
    return;
  }

  if (player.result) {
    if (player.result.hasRole || player.rollCount >= MAX_ROLLS) {
      res.redirect("/room/" + roomId + "?playerId=" + playerId);
      return;
    }
  }

  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  const d3 = Math.floor(Math.random() * 6) + 1;

  player.dice = [d1, d2, d3];
  player.rollCount++;

  const arr = [d1, d2, d3].sort((a, b) => a - b);

  if (d1 === 1 && d2 === 1 && d3 === 1) {
    player.result = {
      name: "ピンゾロ",
      rank: 6,
      point: 1,
      hasRole: true
    };
  } else if (d1 === d2 && d2 === d3) {
    player.result = {
      name: d1 + "のゾロ目",
      rank: 5,
      point: d1,
      hasRole: true
    };
  } else if (arr[0] === 4 && arr[1] === 5 && arr[2] === 6) {
    player.result = {
      name: "シゴロ",
      rank: 4,
      point: 6,
      hasRole: true
    };
  } else if (arr[0] === 1 && arr[1] === 2 && arr[2] === 3) {
    player.result = {
      name: "ヒフミ",
      rank: 1,
      point: 0,
      hasRole: true
    };
  } else if (d1 === d2) {
    player.result = {
      name: d3 + "の目",
      rank: 3,
      point: d3,
      hasRole: true
    };
  } else if (d2 === d3) {
    player.result = {
      name: d1 + "の目",
      rank: 3,
      point: d1,
      hasRole: true
    };
  } else if (d1 === d3) {
    player.result = {
      name: d2 + "の目",
      rank: 3,
      point: d2,
      hasRole: true
    };
  } else {
    player.result = {
      name: "役なし",
      rank: 2,
      point: 0,
      hasRole: false
    };
  }

  res.redirect("/room/" + roomId + "?playerId=" + playerId);
});

// もう一回
app.post("/room/:roomId/reset", (req, res) => {
  const roomId = req.params.roomId;
  const playerId = req.body.playerId;

  const room = rooms[roomId];

  if (!room) {
    res.send("部屋が見つかりません。");
    return;
  }

  for (const player of room.players) {
    player.dice = null;
    player.result = null;
    player.rollCount = 0;
  }

  room.status = "playing";
  room.message = "新しいラウンドを開始しました。";

  res.redirect("/room/" + roomId + "?playerId=" + playerId);
});

// サーバー起動
app.listen(PORT, () => {
  console.log("Server running on http://localhost:" + PORT);
});