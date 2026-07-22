import express from "express";
import cors from "cors";
import { createHash, createHmac, randomBytes } from "node:crypto";

const PORT = process.env.PORT || 3001;
const GIST_ID = "1b8eab31dbc77498848ea8996facb9fd";
const GH_TOKEN = process.env.GH_TOKEN;
const AUTH_SECRET = process.env.AUTH_SECRET || "sailendlc_super_secret_2026";

const app = express();
app.use(cors());
app.use(express.json());

async function readUsers() {
  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    headers: { Authorization: `Bearer ${GH_TOKEN}`, "User-Agent": "SailenDLC/1.0" }
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.files["users.json"] ? JSON.parse(data.files["users.json"].content || "[]") : [];
}

async function writeUsers(users) {
  await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "SailenDLC/1.0"
    },
    body: JSON.stringify({ files: { "users.json": { content: JSON.stringify(users) } } })
  });
}

async function readKeys() {
  try {
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: { Authorization: `Bearer ${GH_TOKEN}`, "User-Agent": "SailenDLC/1.0" }
    });
    if (!res.ok) return {};
    const data = await res.json();
    return JSON.parse(data.files["keys.json"]?.content || "{}");
  } catch { return {}; }
}

async function writeKeys(content) {
  await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "SailenDLC/1.0"
    },
    body: JSON.stringify({ files: { "keys.json": { content: JSON.stringify(content) } } })
  });
}

function verifyKey(code) {
  const parts = code.split("-");
  if (parts.length !== 5 || parts[0] !== "SLDLC") return null;
  const type = parts[1];
  const maxUses = parseInt(parts[2], 10);
  const rand = parts[3];
  const sig = parts[4];
  const expected = createHmac("sha256", AUTH_SECRET).update(type + maxUses + rand).digest("hex").substring(0, 12).toUpperCase();
  if (sig !== expected) return null;
  let days = 0;
  if (type === "P") days = Infinity;
  else days = parseInt(type, 10);
  if (!days) return null;
  return { type, days, maxUses };
}

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }
    if (username.length < 3 || username.length > 32) {
      return res.status(400).json({ error: "Username must be 3-32 characters" });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: "Password must be at least 4 characters" });
    }

    const users = await readUsers();
    if (users.find((u) => u.username === username)) {
      return res.status(409).json({ error: "User already exists" });
    }

    const salt = randomBytes(16).toString("hex");
    const passwordHash = createHash("sha256").update(password + salt).digest("hex");
    users.push({ username, email: email || "", passwordHash, salt });
    await writeUsers(users);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    const users = await readUsers();
    const user = users.find((u) => u.username === username);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const hash = createHash("sha256").update(password + user.salt).digest("hex");
    if (hash !== user.passwordHash) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    res.json({ success: true, username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/activate", async (req, res) => {
  try {
    const { key } = req.body;
    if (!key) return res.status(400).json({ error: "Key required" });

    const result = verifyKey(key);
    if (!result) return res.status(400).json({ error: "Неверный ключ" });

    const keysData = await readKeys();
    const keyData = keysData[key];
    if (keyData && keyData.used >= result.maxUses) {
      return res.status(400).json({ error: "Ключ исчерпан (макс. " + result.maxUses + " активаций)" });
    }

    const used = (keyData?.used || 0) + 1;
    const hwids = keyData?.hwids || [];
    keysData[key] = { used, maxUses: result.maxUses, hwids };
    await writeKeys(keysData);

    const expiresAt = result.days === Infinity ? null : new Date(Date.now() + result.days * 86400000).toISOString();
    res.json({ success: true, type: result.type, expires_at: expiresAt, used, maxUses: result.maxUses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`SailenDLC API running on port ${PORT}`);
});
