import express from "express";
import cors from "cors";
import initSqlJs from "sql.js";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, "config.json");
const DB_PATH = join(__dirname, "data.db");

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    const cfg = { adminPassword: randomBytes(6).toString("hex"), port: 3000 };
    writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
    console.log("Created config.json — save this admin password!");
    return cfg;
  }
  return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
}

const config = loadConfig();
let db;

async function initDb() {
  const SQL = await initSqlJs();
  if (existsSync(DB_PATH)) {
    const buf = readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }
  db.run(`CREATE TABLE IF NOT EXISTS keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL DEFAULT '30d',
    used INTEGER NOT NULL DEFAULT 0,
    hwid TEXT,
    activated_at TEXT,
    expires_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  saveDb();
}

function saveDb() {
  writeFileSync(DB_PATH, Buffer.from(db.export()));
}

function generateKey() {
  return "SLDLC-" + randomBytes(8).toString("hex").toUpperCase();
}

function expiryDate(type) {
  if (type === "permanent") return null;
  const days = parseInt(type.replace("d", ""), 10) || 30;
  return new Date(Date.now() + days * 86400000).toISOString();
}

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/admin/keys", (req, res) => {
  const { password, type, count } = req.body;
  if (password !== config.adminPassword) return res.status(403).json({ error: "Invalid password" });
  if (!["permanent", "7d", "14d", "30d", "60d", "90d"].includes(type)) return res.status(400).json({ error: "Invalid type" });
  const n = Math.min(count || 1, 100);
  const codes = [];
  for (let i = 0; i < n; i++) {
    const code = generateKey();
    db.run("INSERT INTO keys (code, type) VALUES (?, ?)", [code, type]);
    codes.push(code);
  }
  saveDb();
  res.json({ keys: codes });
});

app.get("/api/admin/keys", (req, res) => {
  if (req.query.password !== config.adminPassword) return res.status(403).json({ error: "Invalid password" });
  const stmt = db.prepare("SELECT code, type, used, hwid, activated_at, expires_at, created_at FROM keys ORDER BY id DESC LIMIT 200");
  const keys = [];
  while (stmt.step()) keys.push(stmt.getAsObject());
  res.json({ keys });
});

app.post("/api/activate", (req, res) => {
  const { key, hwid } = req.body;
  if (!key || !hwid) return res.status(400).json({ error: "Missing key or hwid" });

  const stmt = db.prepare("SELECT * FROM keys WHERE code = ?");
  stmt.bind([key]);
  if (!stmt.step()) return res.status(404).json({ error: "Key not found" });
  const row = stmt.getAsObject();

  if (row.used) {
    if (row.hwid === hwid) {
      const expired = row.expires_at && new Date(row.expires_at) < new Date();
      if (expired) return res.status(403).json({ error: "Subscription expired", expired: true });
      return res.json({ success: true, type: row.type, expires_at: row.expires_at, message: "Already activated" });
    }
    return res.status(403).json({ error: "Key already used on another device" });
  }

  const expiresAt = expiryDate(row.type);
  db.run("UPDATE keys SET used = 1, hwid = ?, activated_at = datetime('now'), expires_at = ? WHERE id = ?", [hwid, expiresAt, row.id]);
  saveDb();
  res.json({ success: true, type: row.type, expires_at: expiresAt });
});

app.post("/api/verify", (req, res) => {
  const { hwid } = req.body;
  if (!hwid) return res.status(400).json({ error: "Missing hwid" });

  const stmt = db.prepare("SELECT * FROM keys WHERE hwid = ? AND used = 1 ORDER BY id DESC");
  stmt.bind([hwid]);
  let active = null;
  while (stmt.step()) {
    const r = stmt.getAsObject();
    if (!r.expires_at || new Date(r.expires_at) > new Date()) { active = r; break; }
  }
  if (active) return res.json({ valid: true, type: active.type, expires_at: active.expires_at });
  return res.json({ valid: false, message: "No active subscription" });
});

app.get("/api/status", (_req, res) => {
  const total = db.exec("SELECT COUNT(*) as c FROM keys")[0].values[0][0];
  const used = db.exec("SELECT COUNT(*) as c FROM keys WHERE used = 1")[0].values[0][0];
  res.json({ keys: { total, used } });
});

await initDb();
app.listen(config.port, () => {
  console.log(`SailenDLC Auth API running on port ${config.port}`);
  console.log(`Admin password: ${config.adminPassword}`);
  console.log(`\nGenerate 5 keys (30d):`);
  console.log(`curl -X POST http://localhost:${config.port}/api/admin/keys -H "Content-Type: application/json" -d '{"password":"${config.adminPassword}","type":"30d","count":5}'`);
  console.log(`\nList keys:`);
  console.log(`curl "http://localhost:${config.port}/api/admin/keys?password=${config.adminPassword}"`);
});
