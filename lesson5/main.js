const express = require("express");
const app = express();

app.get("/hello", (req, res) => {
  res.send("Hello world\n");
});

app.listen(80);