import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { copyFileSync, createWriteStream, existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { createHmac, randomBytes, createHash } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const AUTH_SECRET = "sailendlc_super_secret_2026";
const GIST_ID = "1b8eab31dbc77498848ea8996facb9fd";
const GH_TOKEN = process.env.GH_TOKEN;
const REGISTER_URL = "https://sailen-dlc.netlify.app/";
const API_URL = process.env.API_URL || "https://sailen-dlc-loader.onrender.com";

const settingsDefaults = {
  ramGb: 6,
  gamePath: join(app.getPath("documents"), "SailenDLC"),
  themeId: "grape",
  closeAfterLaunch: false
};

const settingsPath = join(app.getPath("userData"), "settings.json");

function createWindow() {
  const win = new BrowserWindow({
    width: 1060,
    height: 640,
    minWidth: 980,
    minHeight: 620,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: false,
    transparent: false,
    backgroundColor: "#09090f",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(__dirname, "preload.cjs")
    }
  });

  const devUrl = "http://localhost:5173";
  const productionFile = join(__dirname, "../dist/index.html");

  if (!app.isPackaged) {
    win.loadURL(devUrl);
  } else {
    win.loadFile(productionFile);
  }
}

async function loadSettings() {
  try {
    const raw = await fs.readFile(settingsPath, "utf-8");
    const parsed = JSON.parse(raw);
    const { clientsJsonUrl: _, ...clean } = { ...settingsDefaults, ...parsed };
    return clean;
  } catch {
    return { ...settingsDefaults };
  }
}

async function saveSettings(nextSettings) {
  const merged = { ...settingsDefaults, ...nextSettings };
  await fs.mkdir(dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, JSON.stringify(merged, null, 2), "utf-8");
  return merged;
}

function sanitizeSegment(name) {
  return String(name || "")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .trim();
}

function versionInstallDir(settings, version) {
  const preferred = sanitizeSegment(version.folder || version.name || "client");
  return join(settings.gamePath, preferred || "client");
}

async function fileExists(pathToFile) {
  try {
    await fs.access(pathToFile);
    return true;
  } catch {
    return false;
  }
}

function emitInstallProgress(webContents, payload) {
  webContents.send("client:install-progress", payload);
}

function downloadFile(fileUrl, outputPath, onProgress) {
  const requester = fileUrl.startsWith("https:") ? httpsRequest : httpRequest;

  return new Promise((resolvePromise, rejectPromise) => {
    const req = requester(
      fileUrl,
      {
        headers: {
          "User-Agent": "SailenDLC-Launcher/1.0",
          Accept: "*/*"
        }
      },
      (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const nextUrl = new URL(res.headers.location, fileUrl).toString();
        downloadFile(nextUrl, outputPath, onProgress)
          .then(resolvePromise)
          .catch(rejectPromise);
        return;
      }

      if (res.statusCode !== 200) {
        rejectPromise(new Error(`download_failed_status_${res.statusCode}`));
        return;
      }

      const fileStream = createWriteStream(outputPath);
      const total = Number(res.headers["content-length"] || 0);
      let downloaded = 0;

      res.on("data", (chunk) => {
        downloaded += chunk.length;
        if (typeof onProgress === "function") {
          if (total > 0) {
            const percent = Math.min(100, Math.max(0, (downloaded / total) * 100));
            onProgress({ percent, downloaded, total, totalKnown: true });
          } else {
            // GitHub sometimes streams without content-length; show smooth pseudo-progress.
            const pseudoPercent = Math.min(95, Math.max(1, Math.round(100 * (1 - Math.exp(-downloaded / (30 * 1024 * 1024))))));
            onProgress({ percent: pseudoPercent, downloaded, total: 0, totalKnown: false });
          }
        }
      });

      res.pipe(fileStream);

      fileStream.on("finish", () => {
        fileStream.close();
        if (typeof onProgress === "function") {
          onProgress({ percent: 100, downloaded, total, totalKnown: total > 0 });
        }
        resolvePromise();
      });
      fileStream.on("error", rejectPromise);
      }
    );

    req.on("error", rejectPromise);
    req.setTimeout(60000, () => {
      req.destroy(new Error("download_timeout"));
    });
    req.end();
  });
}

function extractZipWindows(zipPath, destination) {
  return new Promise((resolvePromise, rejectPromise) => {
    const ps = spawn(
      "powershell",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destination.replace(/'/g, "''")}' -Force`
      ],
      { windowsHide: true }
    );

    let stderr = "";
    ps.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    ps.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(new Error(stderr || `extract_failed_${code}`));
    });
    ps.on("error", rejectPromise);
  });
}

function generateHwid() {
  try {
    const r = spawnSync("wmic", ["useraccount", "where", "name='%username%'", "get", "sid"], { encoding: "utf8", timeout: 5000 });
    if (r.status === 0 && r.stdout) {
      const lines = r.stdout.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("SID"));
      if (lines.length) return lines[0];
    }
  } catch {}
  return "HWID-" + randomBytes(8).toString("hex").toUpperCase();
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

async function readGist() {
  try {
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: { "Authorization": `Bearer ${GH_TOKEN}`, "User-Agent": "SailenDLC/1.0" }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return JSON.parse(data.files["keys.json"].content || "{}");
  } catch { return null; }
}

async function writeGist(content) {
  try {
    await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${GH_TOKEN}`,
        "Content-Type": "application/json",
        "User-Agent": "SailenDLC/1.0"
      },
      body: JSON.stringify({ files: { "keys.json": { content: JSON.stringify(content) } } })
    });
  } catch {}
}

async function readUsersGist() {
  try {
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: { "Authorization": `Bearer ${GH_TOKEN}`, "User-Agent": "SailenDLC/1.0" }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.files["users.json"] ? JSON.parse(data.files["users.json"].content || "[]") : [];
  } catch { return []; }
}

async function writeUsersGist(users) {
  try {
    await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${GH_TOKEN}`,
        "Content-Type": "application/json",
        "User-Agent": "SailenDLC/1.0"
      },
      body: JSON.stringify({ files: { "users.json": { content: JSON.stringify(users) } } })
    });
  } catch {}
}

function hashPassword(password, salt) {
  return createHash("sha256").update(password + salt).digest("hex");
}

async function installClient(event, version) {
  const settings = await loadSettings();
  const targetDir = versionInstallDir(settings, version);
  await fs.mkdir(targetDir, { recursive: true });

  const jarName = version.exePath || "SailenDLC.jar";
  const jarPath = join(targetDir, jarName);
  const bundledJar = app.isPackaged
    ? join(process.resourcesPath, "SailenDLC.jar")
    : join(__dirname, "SailenDLC.jar");

  emitInstallProgress(event.sender, { phase: "download", percent: 0 });
  try {
    // Try to download latest jar from remote, fallback to bundled
    try {
      const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, { headers: { "User-Agent": "SailenDLC/1.0" } });
      if (res.ok) {
        const data = await res.json();
        const info = JSON.parse(data.files["version.json"]?.content || "{}");
        // Download free jar
        if (info.jarUrl) {
          emitInstallProgress(event.sender, { phase: "download", percent: 5, text: "Скачиваю обновление..." });
          await downloadFile(info.jarUrl, jarPath, (p) => {
            emitInstallProgress(event.sender, { phase: "download", percent: 5 + Math.round(p.percent * 0.3) });
          });
        } else {
          copyFileSync(bundledJar, jarPath);
        }
        // Download premium jar if URL set (not bundled)
        const premiumTarget = join(targetDir, "SailenPremium.jar");
        if (info.premiumJarUrl) {
          await downloadFile(info.premiumJarUrl, premiumTarget, () => {});
        }
      } else {
        copyFileSync(bundledJar, jarPath);
      }
    } catch {
      copyFileSync(bundledJar, jarPath);
    }

    for (const f of ["log4j-api-2.17.0.jar", "log4j-core-2.17.0.jar", "java-discord-rpc.jar", "discord-rpc.dll"]) {
      const src = app.isPackaged
        ? join(process.resourcesPath, f)
        : join(__dirname, f);
      if (existsSync(src)) copyFileSync(src, join(targetDir, f));
    }
    const assetsSrc = app.isPackaged
      ? join(process.resourcesPath, "assets")
      : join(__dirname, "..", "assets");
    if (existsSync(assetsSrc)) {
      await fs.cp(assetsSrc, join(targetDir, "assets"), { recursive: true });
    }
    emitInstallProgress(event.sender, { phase: "download", percent: 50 });
  } catch (err) {
    throw new Error("Ошибка копирования jar: " + err.message);
  }

  const jreDir = join(targetDir, "jre21");
  if (!existsSync(join(jreDir, "bin", "java.exe"))) {
    emitInstallProgress(event.sender, { phase: "download", percent: 60, text: "Скачиваю Java 21..." });
    const zipUrl = "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.11%2B10/OpenJDK21U-jre_x64_windows_hotspot_21.0.11_10.zip";
    const zipPath = join(targetDir, "jre21.zip");
    await downloadFile(zipUrl, zipPath, (pct) => {
      emitInstallProgress(event.sender, { phase: "download", percent: 60 + Math.round(pct * 0.3) });
    });
    emitInstallProgress(event.sender, { phase: "download", percent: 90, text: "Распаковываю Java 21..." });
    await extractZipWindows(zipPath, jreDir);
    try { await fs.unlink(zipPath); } catch {}
  }
  settings.javaPath = join(jreDir, "bin", "java.exe");
  await saveSettings(settings);

  emitInstallProgress(event.sender, { phase: "done", percent: 100 });
  return targetDir;
}

async function resolveExecutable(version) {
  const settings = await loadSettings();
  const targetDir = versionInstallDir(settings, version);
  const jarRel = version.exePath || "SailenDLC.jar";
  const jarAbsolute = resolve(targetDir, jarRel);

  const isInsideTarget = jarAbsolute.startsWith(resolve(targetDir));
  if (!isInsideTarget) {
    throw new Error("invalid_jar_path");
  }

  return { jarAbsolute, targetDir, settings };
}

async function isClientInstalled(version) {
  const { jarAbsolute } = await resolveExecutable(version);
  return fileExists(jarAbsolute);
}

async function launchClient(version) {
  const { jarAbsolute, targetDir, settings } = await resolveExecutable(version);
  const installed = await fileExists(jarAbsolute);
  if (!installed) {
    throw new Error("client_not_installed");
  }

  let javaBin = settings.javaPath || "java";
  try {
    const v = spawnSync(javaBin, ["-version"], { encoding: "utf8", timeout: 5000 });
    if (v.status !== 0 && v.error) javaBin = "java";
  } catch { javaBin = "java"; }
  if (javaBin === "java") {
    const candidates = [
      "C:\\Program Files\\Java\\jdk-21\\bin\\java.exe",
      "C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.6.10-hotspot\\bin\\java.exe",
      "C:\\Program Files\\Java\\jdk-17\\bin\\java.exe",
      "C:\\Program Files\\Java\\jre1.8.0_491\\bin\\java.exe",
      join(process.env.JAVA_HOME || "", "bin", "java.exe"),
      "java"
    ];
    for (const p of candidates) {
      try {
        const v = spawnSync(p, ["-version"], { encoding: "utf8", timeout: 5000 });
        if (v.status === 0 || v.error === undefined) { javaBin = p; break; }
      } catch {}
    }
  }

  const memoryMb = Math.max(1024, Number(settings.ramGb || 6) * 1024);
  const javaArgs = [`-Xmx${memoryMb}M`];
  let javaVer = 0;
  try {
    const v = spawnSync(javaBin, ["-version"], { encoding: "utf8" });
    const m = (v.stdout + v.stderr).match(/(?:version\s+"|openjdk\s+)(\d+)/);
    if (m) javaVer = parseInt(m[1], 10);
    if (javaVer >= 9) {
      javaArgs.push("--add-opens", "java.base/java.lang=ALL-UNNAMED");
      javaArgs.push("--add-opens", "java.base/java.util=ALL-UNNAMED");
      javaArgs.push("--add-opens", "java.base/java.lang.reflect=ALL-UNNAMED");
      javaArgs.push("--add-opens", "java.base/java.io=ALL-UNNAMED");
    }
  } catch {}

  const log4jApi = join(targetDir, "log4j-api-2.17.0.jar");
  const log4jCore = join(targetDir, "log4j-core-2.17.0.jar");
  const discordRpc = join(targetDir, "java-discord-rpc.jar");
  const discordDll = join(targetDir, "discord-rpc.dll");
  const cpJars = [log4jApi, log4jCore, discordRpc, jarAbsolute].filter(existsSync);
  if (cpJars.length >= 3) {
    javaArgs.push("-Djna.library.path=" + targetDir);
    javaArgs.push("-cp", cpJars.join(";"));
    javaArgs.push("Start");
  } else {
    javaArgs.push("-jar", jarAbsolute);
  }

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(javaBin, javaArgs, {
      cwd: targetDir,
      detached: false,
      stdio: "pipe",
      windowsHide: true
    });

    let output = "";
    child.stdout.on("data", (d) => { output += d.toString(); });
    child.stderr.on("data", (d) => { output += d.toString(); });

    child.on("error", (err) => {
      rejectPromise(new Error("Ошибка запуска Java: " + err.message));
    });

    child.on("close", (code) => {
      const logPath = join(targetDir, "launcher_java.log");
      const logStream = createWriteStream(logPath, { flags: "w" });
      logStream.write("Java bin: " + javaBin + "\n");
      logStream.write("Args: " + javaArgs.join(" ") + "\n");
      logStream.write("Exit code: " + code + "\n");
      logStream.write("Output:\n" + output);
      logStream.end();

      if (code !== 0 && code !== null) {
        rejectPromise(new Error("Java завершилась с кодом " + code));
        return;
      }

      if (settings.closeAfterLaunch) {
        BrowserWindow.getAllWindows().forEach((window) => window.close());
      }
      resolvePromise({ ok: true });
    });
  });
}

app.whenReady().then(() => {
  ipcMain.handle("window:close", (event) => {
    const targetWindow = BrowserWindow.fromWebContents(event.sender);
    if (targetWindow) targetWindow.close();
  });

  ipcMain.handle("settings:get", async () => loadSettings());
  ipcMain.handle("settings:save", async (_event, nextSettings) => saveSettings(nextSettings || {}));

  ipcMain.handle("dialog:pick-folder", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"]
    });
    if (result.canceled || !result.filePaths.length) return "";
    return result.filePaths[0];
  });

  ipcMain.handle("client:is-installed", async (_event, version) => isClientInstalled(version));
  ipcMain.handle("client:install", async (event, version) => installClient(event, version));
  ipcMain.handle("client:launch", async (_event, version) => launchClient(version));

  ipcMain.handle("auth:activate", async (_event, key) => {
    const settings = await loadSettings();
    const hwid = settings.authHwid || generateHwid();
    const result = verifyKey(key);
    if (!result) return { success: false, error: "Неверный ключ" };

    // Check Gist for usage count
    const gistData = await readGist() || {};
    const keyData = gistData[key];
    if (keyData && keyData.used >= result.maxUses) return { success: false, error: "Ключ исчерпан (макс. " + result.maxUses + " активаций)" };

    const used = (keyData?.used || 0) + 1;
    const hwids = keyData?.hwids || [];
    hwids.push(hwid);
    gistData[key] = { used, maxUses: result.maxUses, hwids };
    await writeGist(gistData);

    // Save locally
    const expiresAt = result.days === Infinity ? null : new Date(Date.now() + result.days * 86400000).toISOString();
    await saveSettings({ ...settings, authKey: key, authHwid: hwid, authExpiresAt: expiresAt, authType: result.type, authMaxUses: result.maxUses });
    return { success: true, type: result.type, expires_at: expiresAt, used, maxUses: result.maxUses };
  });

  ipcMain.handle("auth:verify", async () => {
    const settings = await loadSettings();
    if (!settings.authKey) return { valid: false, message: "Не активирован" };
    const result = verifyKey(settings.authKey);
    if (!result) return { valid: false, message: "Неверный ключ" };
    if (settings.authExpiresAt && new Date(settings.authExpiresAt) < new Date()) return { valid: false, expired: true, message: "Срок истёк" };
    return { valid: true, type: result.type, expires_at: settings.authExpiresAt };
  });

  ipcMain.handle("update:check", async () => {
    try {
      const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
        headers: { "User-Agent": "SailenDLC/1.0" }
      });
      if (!res.ok) return { error: "Connection failed" };
      const data = await res.json();
      const info = JSON.parse(data.files["version.json"]?.content || "{}");
      return { jarUrl: info.jarUrl || null, premiumJarUrl: info.premiumJarUrl || null, version: info.version || "1.0.0" };
    } catch { return { error: "Check failed" }; }
  });

  ipcMain.handle("update:download-jar", async (_event, url, dest) => {
    if (!url) return { error: "No URL" };
    try {
      await downloadFile(url, dest, () => {});
      return { success: true };
    } catch (e) { return { error: e.message || "Download failed" }; }
  });

  ipcMain.handle("auth:status", async () => {
    const settings = await loadSettings();
    if (!settings.authKey) return { activated: false };
    const result = verifyKey(settings.authKey);
    if (!result) return { activated: false };
    if (settings.authExpiresAt && new Date(settings.authExpiresAt) < new Date()) return { activated: false, expired: true };
    return { activated: true, expires_at: settings.authExpiresAt, type: result.type };
  });

  ipcMain.handle("auth:login", async (_event, username, password) => {
    if (!username || !password) return { success: false, error: "Введите логин и пароль" };
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          await saveSettings({ sessionUser: username });
          return { success: true, username };
        }
        return { success: false, error: data.error || "Неверный логин или пароль" };
      }
    } catch {}
    // Fallback: direct Gist check
    try {
      const users = await readUsersGist();
      const user = users.find((u) => u.username === username);
      if (!user) return { success: false, error: "Неверный логин или пароль" };
      const hash = hashPassword(password, user.salt);
      if (hash !== user.passwordHash) return { success: false, error: "Неверный логин или пароль" };
      await saveSettings({ sessionUser: username });
      return { success: true, username };
    } catch {
      return { success: false, error: "Ошибка соединения с сервером" };
    }
  });

  ipcMain.handle("auth:register", async () => {
    const { shell } = await import("electron");
    await shell.openExternal(REGISTER_URL);
    return { success: true };
  });

  ipcMain.handle("auth:logout", async () => {
    await saveSettings({ sessionId: "", sessionUser: "", loggedIn: false });
    return { success: true };
  });

  ipcMain.handle("auth:check-session", async () => {
    const settings = await loadSettings();
    if (settings.loggedIn && settings.sessionUser) {
      return { loggedIn: true, username: settings.sessionUser };
    }
    if (settings.sessionId || settings.sessionUser) {
      await saveSettings({ sessionId: "", sessionUser: "", loggedIn: false });
    }
    return { loggedIn: false };
  });

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
