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
  listExternalPlugins: () => ipcRenderer.invoke("plugins:listExternal"),
  readExternalPluginEntry: (pluginId) => ipcRenderer.invoke("plugins:readExternalEntry", pluginId),
  writeSnapshot: (payload) => ipcRenderer.invoke("backup:writeSnapshot", payload),
  readLatestSnapshot: () => ipcRenderer.invoke("backup:readLatest"),
  widget: {
    open: () => ipcRenderer.invoke("widget:open"),
    close: () => ipcRenderer.invoke("widget:close"),
    setAlwaysOnTop: (enabled) => ipcRenderer.invoke("widget:set-always-on-top", Boolean(enabled)),
    setPosition: (x, y) => ipcRenderer.invoke("widget:set-position", Number(x), Number(y)),
    getPosition: () => ipcRenderer.invoke("widget:get-position"),
    setSize: (width, height) => ipcRenderer.invoke("widget:set-size", Number(width), Number(height)),
    sendAction: (action) => ipcRenderer.send("widget:action", action),
    onSnapshot: (listener) => {
      const handler = (_event, snapshot) => listener(snapshot);
      ipcRenderer.on("widget:snapshot", handler);
      return () => ipcRenderer.removeListener("widget:snapshot", handler);
    },
    onAction: (listener) => {
      const handler = (_event, action) => listener(action);
      ipcRenderer.on("widget:action", handler);
      return () => ipcRenderer.removeListener("widget:action", handler);
    },
    pushSnapshot: (snapshot) => ipcRenderer.send("widget:push-snapshot", snapshot),
  },
  isDesktop: () => true
});
