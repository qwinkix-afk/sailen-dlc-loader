import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { copyFileSync, createWriteStream, existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
    copyFileSync(bundledJar, jarPath);
  } catch (err) {
    throw new Error("Ошибка копирования jar: " + err.message);
  }
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

  const knownPaths = [
    "C:\\Program Files\\Java\\jre1.8.0_491\\bin\\java.exe",
    "C:\\Program Files\\Java\\jdk-17\\bin\\java.exe",
    "C:\\Program Files\\Java\\jdk-21\\bin\\java.exe",
    "C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.6.10-hotspot\\bin\\java.exe",
    join(process.env.JAVA_HOME || "", "bin", "java.exe")
  ];
  let javaBin = "java";
  for (const p of knownPaths) {
    if (existsSync(p)) { javaBin = p; break; }
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
  javaArgs.push("-jar", jarAbsolute);

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

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
