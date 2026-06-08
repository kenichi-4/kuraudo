const express = require("express");
const app = express();

app.set("view engine", "ejs");
app.use("/public", express.static(__dirname + "/public"));
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 8080; // ポート番号8080
const MAX_ROLLS = 3; // 振り直し回数
const WIN_SCORE = 10; // 先に取ったら勝ち
const DIFFICULTIES = {
  strong: { name: "強い", min: 4, max: 6 },
  normal: { name: "普通", min: 1, max: 6 },
  weak: { name: "弱い", min: 1, max: 3 }
};

let games = {}; // 作成されたCPU対戦の情報を保存する

function createPlayer(id, name, isCpu, difficulty) {
  return {
    id: id,
    name: name,
    isCpu: isCpu,
    difficulty: difficulty || "normal",
    score: 0,
    dice: null,
    result: null,
    rollCount: 0
  };
}

function rollDice() {
  return rollDiceInRange(1, 6);
}

function rollDiceInRange(min, max) {
  return [
    randomNumber(min, max),
    randomNumber(min, max),
    randomNumber(min, max)
  ];
}

function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// チンチロの役判定
function judgeDice(dice) {
  const d1 = dice[0];
  const d2 = dice[1];
  const d3 = dice[2];
  const arr = dice.slice().sort((a, b) => a - b);

  if (d1 === 1 && d2 === 1 && d3 === 1) {
    return { name: "ピンゾロ", rank: 6, point: 1, hasRole: true };
  } else if (d1 === d2 && d2 === d3) {
    return { name: d1 + "のゾロ目", rank: 5, point: d1, hasRole: true };
  } else if (arr[0] === 4 && arr[1] === 5 && arr[2] === 6) {
    return { name: "シゴロ", rank: 4, point: 6, hasRole: true };
  } else if (arr[0] === 1 && arr[1] === 2 && arr[2] === 3) {
    return { name: "ヒフミ", rank: 1, point: 0, hasRole: true };
  } else if (d1 === d2) {
    return { name: d3 + "の目", rank: 3, point: d3, hasRole: true };
  } else if (d2 === d3) {
    return { name: d1 + "の目", rank: 3, point: d1, hasRole: true };
  } else if (d1 === d3) {
    return { name: d2 + "の目", rank: 3, point: d2, hasRole: true };
  }

  return { name: "役なし", rank: 2, point: 0, hasRole: false };
}

// 役が出た場合、または3回振った場合に確定する
function isFinished(player) {
  return player.result && (player.result.hasRole || player.rollCount >= MAX_ROLLS);
}

// 1回サイコロを振る
function rollOnce(player) {
  if (player.isCpu) {
    const difficulty = DIFFICULTIES[player.difficulty] || DIFFICULTIES.normal;
    player.dice = rollDiceInRange(difficulty.min, difficulty.max);
  } else {
    player.dice = rollDice();
  }

  player.rollCount++;
  player.result = judgeDice(player.dice);
}

// 役の強さで順位を作る
function getRanking(players) {
  return players
    .filter((player) => player.result)
    .sort((a, b) => {
      if (a.result.rank !== b.result.rank) {
        return b.result.rank - a.result.rank;
      }
      return b.result.point - a.result.point;
    })
    .map((player, index) => ({
      ...player,
      place: index + 1
    }));
}

// ラウンドの勝者を決める
function getRoundWinner(players) {
  const ranking = getRanking(players);

  if (ranking.length < 2) {
    return null;
  }

  if (
    ranking[0].result.rank === ranking[1].result.rank &&
    ranking[0].result.point === ranking[1].result.point
  ) {
    return null;
  }

  return ranking[0];
}

// 勝った役に応じた基本ポイントを返す
function getWinPoint(result) {
  if (result.name === "ピンゾロ") {
    return 5;
  } else if (result.name.includes("ゾロ目")) {
    return 3;
  } else if (result.name === "シゴロ") {
    return 2;
  }

  return 1;
}

// ラウンドの得点を加算する
function scoreRound(game) {
  const winner = getRoundWinner(game.players);

  game.roundWinner = winner;

  if (!winner) {
    game.roundPoint = 0;
    game.roundScored = true;
    return;
  }

  let point = getWinPoint(winner.result);

  // 負けた側がヒフミの場合、勝った側の獲得ポイントを2倍にする
  const loser = game.players.find((player) => player.id !== winner.id);

  if (loser && loser.result && loser.result.name === "ヒフミ") {
    point *= 2;
  }

  winner.score += point;
  game.roundPoint = point;
  game.roundScored = true;
}

// ゲーム全体の状態を更新する
function updateGameStatus(game) {
  const player = game.players[0];
  const cpu = game.players[1];

  if (isFinished(player) && isFinished(cpu)) {
    if (!game.roundScored) {
      scoreRound(game);
    }

    if (player.score >= WIN_SCORE || cpu.score >= WIN_SCORE) {
      const matchWinner = player.score >= WIN_SCORE ? player : cpu;
      game.status = "matchFinished";
      game.message = matchWinner.name + " が" + WIN_SCORE + "ポイント先取で勝ちです。";
    } else if (!game.roundWinner) {
      game.status = "finished";
      game.message = "このラウンドは引き分けです。ポイントは入りません。";
    } else {
      game.status = "finished";
      game.message = game.roundWinner.name + " が " + game.roundPoint + " ポイント取りました。";
    }
  } else if (isFinished(player)) {
    game.status = "cpu";
    game.message = "あなたの結果が確定しました。次はCPUの番です。";
  } else {
    game.status = "player";
    game.message = "あなたの番です。役が出るか3回振ると確定します。";
  }
}

// 最初のページ
app.get("/", (req, res) => {
  res.render("index", { error: "", difficulties: DIFFICULTIES });
});

// CPU対戦を始める
app.post("/start", (req, res) => {
  const name = req.body.name || "プレイヤー";
  const difficulty = DIFFICULTIES[req.body.difficulty] ? req.body.difficulty : "normal";
  let gameId = Math.random().toString(36).substring(2, 8).toUpperCase();

  while (games[gameId]) {
    gameId = Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  games[gameId] = {
    id: gameId,
    status: "player",
    roundNumber: 1,
    roundScored: false,
    roundWinner: null,
    roundPoint: 0,
    message: "あなたの番です。サイコロを振ってください。",
    players: [
      createPlayer("player", name, false),
      createPlayer("cpu", "CPU（" + DIFFICULTIES[difficulty].name + "）", true, difficulty)
    ]
  };

  res.redirect("/game/" + gameId);
});

// 対戦画面を表示
app.get("/game/:gameId", (req, res) => {
  const game = games[req.params.gameId];

  if (!game) {
    res.render("index", {
      error: "対戦データがありません。もう一度始めてください。",
      difficulties: DIFFICULTIES
    });
    return;
  }

  updateGameStatus(game);

  res.render("room", {
    game: game,
    me: game.players[0],
    maxRolls: MAX_ROLLS,
    winningScore: WIN_SCORE,
    ranking: getRanking(game.players)
  });
});

// プレイヤーのサイコロを振る
app.post("/game/:gameId/roll", (req, res) => {
  const game = games[req.params.gameId];

  if (!game) {
    res.redirect("/");
    return;
  }

  const player = game.players[0];

  if (game.status !== "matchFinished" && !isFinished(player)) {
    rollOnce(player);
  }

  updateGameStatus(game);
  res.redirect("/game/" + game.id);
});

// CPUのサイコロを振る
app.post("/game/:gameId/cpu-roll", (req, res) => {
  const game = games[req.params.gameId];

  if (!game) {
    res.redirect("/");
    return;
  }

  const player = game.players[0];
  const cpu = game.players[1];

  if (game.status !== "matchFinished" && isFinished(player) && !isFinished(cpu)) {
    rollOnce(cpu);
  }

  updateGameStatus(game);
  res.redirect("/game/" + game.id);
});

// もう一回
app.post("/game/:gameId/reset", (req, res) => {
  const game = games[req.params.gameId];

  if (!game) {
    res.redirect("/");
    return;
  }

  const resetScore = game.status === "matchFinished";

  for (const player of game.players) {
    if (resetScore) {
      player.score = 0;
    }

    player.dice = null;
    player.result = null;
    player.rollCount = 0;
  }

  game.roundNumber = resetScore ? 1 : game.roundNumber + 1;
  game.roundScored = false;
  game.roundWinner = null;
  game.roundPoint = 0;
  game.status = "player";
  game.message = resetScore
    ? "新しい試合を開始しました。あなたの番です。"
    : "次のラウンドを開始しました。あなたの番です。";

  res.redirect("/game/" + game.id);
});

// 対戦をやめる
app.post("/game/:gameId/end", (req, res) => {
  delete games[req.params.gameId];
  res.redirect("/");
});

// サーバー起動
app.listen(PORT, "127.0.0.1", () => {
  console.log("Server running on http://localhost:" + PORT);
});