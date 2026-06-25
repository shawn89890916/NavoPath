const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopApi", {
  authStorage: {
    getItem: (key) => ipcRenderer.invoke("auth-storage:get", key),
    setItem: (key, value) => ipcRenderer.invoke("auth-storage:set", key, value),
    removeItem: (key) => ipcRenderer.invoke("auth-storage:remove", key)
  },
  getUpdateState: () => ipcRenderer.invoke("updater:getState"),
  checkForUpdates: () => ipcRenderer.invoke("updater:check"),
  installUpdate: () => ipcRenderer.invoke("updater:install"),
  onUpdateState: (listener) => {
    const handler = (_event, state) => listener(state);
    ipcRenderer.on("updater:state", handler);
    return () => ipcRenderer.removeListener("updater:state", handler);
  },
  aiChat: (payload) => ipcRenderer.invoke("ai:chat", payload),
  getAutoLaunch: () => ipcRenderer.invoke("autolaunch:get"),
  setAutoLaunch: (enabled) => ipcRenderer.invoke("autolaunch:set", enabled),
  writeSnapshot: (payload) => ipcRenderer.invoke("backup:writeSnapshot", payload),
  readLatestSnapshot: () => ipcRenderer.invoke("backup:readLatest"),
  isDesktop: () => true
});
