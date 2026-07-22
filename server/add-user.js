import { createHash, randomBytes } from "node:crypto";

const GIST_ID = "1b8eab31dbc77498848ea8996facb9fd";
const GH_TOKEN = "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";

async function main() {
  const [,, username, password] = process.argv;
  if (!username || !password) {
    console.error("Usage: node add-user.js <username> <password>");
    process.exit(1);
  }

  // Fetch current users
  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    headers: { Authorization: `Bearer ${GH_TOKEN}`, "User-Agent": "SailenDLC/1.0" }
  });
  if (!res.ok) throw new Error("Failed to fetch gist: " + res.status);
  const data = await res.json();
  const users = data.files["users.json"] ? JSON.parse(data.files["users.json"].content || "[]") : [];

  if (users.find((u) => u.username === username)) {
    console.error("User already exists:", username);
    process.exit(1);
  }

  const salt = randomBytes(16).toString("hex");
  const passwordHash = createHash("sha256").update(password + salt).digest("hex");
  users.push({ username, passwordHash, salt });

  const updateRes = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "SailenDLC/1.0"
    },
    body: JSON.stringify({ files: { "users.json": { content: JSON.stringify(users) } } })
  });
  if (!updateRes.ok) throw new Error("Failed to update gist: " + updateRes.status);

  console.log(`User "${username}" added successfully!`);
}

main().catch(console.error);
