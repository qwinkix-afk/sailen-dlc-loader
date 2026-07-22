import { writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, "gist-config.json");

async function main() {
  const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  const version = process.argv[2] || "1.0.0";

  console.log(`Setting version to ${version}...\n`);

  // Read current gist to preserve keys.json
  const res = await fetch(`https://api.github.com/gists/${config.gistId}`, {
    headers: { "Authorization": `Bearer ${config.token}`, "User-Agent": "SailenDLC/1.0" }
  });
  const gist = await res.json();
  const keysContent = gist.files["keys.json"]?.content || "{}";

  // Update with version info
  const body = JSON.stringify({
    files: {
      "keys.json": { content: keysContent },
      "version.json": { content: JSON.stringify({ version, jarUrl: "", premiumJarUrl: "" }, null, 2) }
    }
  });

  const upd = await fetch(`https://api.github.com/gists/${config.gistId}`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${config.token}`,
      "Content-Type": "application/json",
      "User-Agent": "SailenDLC/1.0"
    },
    body
  });

  if (upd.ok) {
    console.log(`✓ version.json added to Gist!`);
    console.log(`  Current version: ${version}`);
    console.log(`\nКогда соберёшь новый билд — обнови версию:`);
    console.log(`  node update-version.js 1.0.1`);
    console.log(`\nИ залей exe в catbox.moe или google drive, вставь ссылку в`);
    console.log(`  https://gist.github.com/${config.gistId}#file-version-json`);
  } else {
    console.error("Failed:", await upd.text());
  }
}

main().catch(console.error);
