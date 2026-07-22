import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, "gist-config.json");

async function main() {
  console.log("=== Настройка GitHub Gist для активаций ===\n");

  const token = process.env.GH_TOKEN;
  if (!token) {
    console.log("1. Зайди на https://github.com/settings/tokens");
    console.log("2. Нажми 'Generate new token (classic)'");
    console.log("3. Выбери scope: gist");
    console.log("4. Скопируй токен");
    console.log("");
    console.log("Запусти скрипт снова с токеном:");
    console.log("  $env:GH_TOKEN='твой_токен'; node setup-gist.js\n");
    process.exit(1);
  }

  // Create empty gist
  const body = JSON.stringify({
    description: "SailenDLC key activations",
    public: false,
    files: { "keys.json": { content: "{}" } }
  });

  const res = await fetch("https://api.github.com/gists", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "SailenDLC-Setup/1.0"
    },
    body
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("GitHub API error:", res.status, err);
    process.exit(1);
  }

  const data = await res.json();
  const gistId = data.id;
  const rawUrl = `https://api.github.com/gists/${gistId}`;

  writeFileSync(CONFIG_PATH, JSON.stringify({ gistId, rawUrl, token }, null, 2));
  console.log(`\n✓ Gist создан! ID: ${gistId}`);
  console.log(`✓ URL: https://gist.github.com/${data.owner?.login || "anonymous"}/${gistId}`);
  console.log(`\nСкопируй эти данные в electron/main.js:\n`);
  console.log(`const GIST_ID = "${gistId}";`);
  console.log(`const GH_TOKEN = "${token}";`);
}

main().catch(console.error);
