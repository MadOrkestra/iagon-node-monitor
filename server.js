import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import compression from "compression";
import { readFile } from "fs/promises";
import { dirSize, execShellCommand } from "./lib/helper.js";
const { version } = JSON.parse(await readFile("./package.json"));

const config = dotenv.config().parsed;
const app = express();
const port = config.SERVER_PORT;
const logfile = config.LOGFILE;
const nodeBin = config.NODE_BIN;

console.log(new Date(), "Welcome to IAG Node Monitor", version);
console.log(new Date(), "Starting up...");

if (!nodeBin) {
  console.error("Node binary not defined");
  process.exit(1);
} else {
  console.log(new Date(), "Node binary:", nodeBin);
}

if (!port) {
  console.error("Server port  not defined");
  process.exit(1);
}

if (!logfile) {
  console.error("Logfile location not defined");
  process.exit(1);
} else {
  console.log(new Date(), "Logfile location:", logfile);
}

app.use(cors());
app.use(compression());
app.use(express.static("public"));

// LOGFILE
app.get("/api/logfile", async (req, res) => {
  let data = await readFile(logfile, "utf8");
  let log = data.split("\n").map((el) => decodeURIComponent(el));
  let json = [];
  for (let l of log) {
    if (l) {
      let obj = JSON.parse(l);
      if (obj.message.includes("=>")) {
        obj.text = JSON.parse(
          decodeURIComponent(obj.message.split("=>")[1]?.trim())
        );
        obj.message = obj.message.split("=>")[0].trim();
      }

      // EXCLUDE PING
      if (obj.level == "info" && obj.message.includes("ping success")) continue;
      if (obj.level == "info" && obj.message.includes("requesting heartbeat"))
        continue;

      json.push(obj);
    }
  }
  res.json(json);
});

// STATS
app.get("/api/stats", async (req, res) => {
  let json = {};
  const nodeVersion = await execShellCommand(nodeBin + " --version");
  const info = await execShellCommand(nodeBin + " get:info");
  for (let line of info.split("\n")) {
    if (line.includes("=>")) {
      let [key, value] = line.split(":");
      json[
        key
          .replace("=>", "")
          .replace(/[^a-z0-9\s]/gi, "")
          .replace(/ +/g, "")
          .trim()
      ] = value.trim();
    }
  }
  json.monitorVersion = version;
  json.nodeVersion = nodeVersion;

  res.json(json);
});

// STATUS
app.get("/api/status", async (req, res) => {
  let json = {};
  const info = await execShellCommand(nodeBin + " get:status");
  json.up = info.includes("up and running");
  json.timestamp = new Date().toISOString();
  res.json(json);
});

// UPDATE
app.get("/api/update", async (req, res) => {
  const data = await execShellCommand("tail -n 20 " + logfile);
  let log = data.split("\n").map((el) => decodeURIComponent(el));
  let json = [];
  for (let l of log) {
    if (l) {
      let obj = JSON.parse(l);
      if (obj.message.includes("=>")) {
        obj.text = JSON.parse(
          decodeURIComponent(obj.message.split("=>")[1]?.trim())
        );
        obj.message = obj.message.split("=>")[0].trim();
      }

      // EXCLUDE PING
      if (obj.level == "info" && obj.message.includes("ping success")) continue;
      if (obj.level == "info" && obj.message.includes("requesting heartbeat"))
        continue;

      json.push(obj);
    }
  }

  res.json(json);
});

// STARTING SERVER
app.listen(port, () => {
  console.log(new Date(), "Server started on port", port);
});
