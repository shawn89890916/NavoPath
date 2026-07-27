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
  writeSnapshot: (payload) => ipcRenderer.invoke("backup:writeSnapshot", payload),
  readLatestSnapshot: () => ipcRenderer.invoke("backup:readLatest"),
  compactWindow: {
    open: (options) => ipcRenderer.invoke("compact-window:open", options),
    close: () => ipcRenderer.invoke("compact-window:close"),
    setAlwaysOnTop: (enabled) => ipcRenderer.invoke("compact-window:set-always-on-top", Boolean(enabled)),
  },
  widget: {
    open: () => ipcRenderer.invoke("widget:open"),
    close: () => ipcRenderer.invoke("widget:close"),
    togglePopover: () => ipcRenderer.invoke("widget:toggle-popover"),
    closePopover: () => ipcRenderer.invoke("widget:close-popover"),
    setAlwaysOnTop: (enabled) => ipcRenderer.invoke("widget:set-always-on-top", Boolean(enabled)),
    getBounds: () => ipcRenderer.invoke("widget:get-bounds"),
    setBounds: (bounds) => ipcRenderer.invoke("widget:set-bounds", bounds),
    getWorkArea: () => ipcRenderer.invoke("widget:get-work-area"),
    sendAction: (action) => ipcRenderer.send("widget:action", action),
    onSnapshot: (listener) => {
      const handler = (_event, snapshot) => listener(snapshot);
      ipcRenderer.on("widget:snapshot", handler);
      return () => ipcRenderer.removeListener("widget:snapshot", handler);
    },
    onPopoverState: (listener) => {
      const handler = (_event, open) => listener(Boolean(open));
      ipcRenderer.on("widget:popover-state", handler);
      return () => ipcRenderer.removeListener("widget:popover-state", handler);
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
