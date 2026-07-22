import express from "express";
import cors from "cors";
import { createHash, randomBytes } from "node:crypto";

const PORT = process.env.PORT || 3001;
const GIST_ID = "1b8eab31dbc77498848ea8996facb9fd";
const GH_TOKEN = "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";

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

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
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
    users.push({ username, passwordHash, salt });
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

app.listen(PORT, () => {
  console.log(`SailenDLC API running on port ${PORT}`);
});
