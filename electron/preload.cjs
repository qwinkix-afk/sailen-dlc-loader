const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("launcherWindow", {
  close: () => ipcRenderer.invoke("window:close")
});

contextBridge.exposeInMainWorld("launcherApi", {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  pickFolder: () => ipcRenderer.invoke("dialog:pick-folder"),
  isClientInstalled: (version) => ipcRenderer.invoke("client:is-installed", version),
  installClient: (version) => ipcRenderer.invoke("client:install", version),
  launchClient: (version) => ipcRenderer.invoke("client:launch", version),
  onInstallProgress: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("client:install-progress", handler);
    return () => ipcRenderer.removeListener("client:install-progress", handler);
  },
  authActivate: (key) => ipcRenderer.invoke("auth:activate", key),
  authVerify: () => ipcRenderer.invoke("auth:verify"),
  authStatus: () => ipcRenderer.invoke("auth:status"),
  checkUpdate: () => ipcRenderer.invoke("update:check"),
  downloadJar: (url, dest) => ipcRenderer.invoke("update:download-jar", url, dest),
  login: (username, password) => ipcRenderer.invoke("auth:login", username, password),
  register: () => ipcRenderer.invoke("auth:register"),
  logout: () => ipcRenderer.invoke("auth:logout"),
  checkSession: () => ipcRenderer.invoke("auth:check-session")
});
