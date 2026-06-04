const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("plannerApi", {
  getData: () => ipcRenderer.invoke("planner:getData"),
  saveData: (data) => ipcRenderer.invoke("planner:saveData", data),
  applyActions: (actions) => ipcRenderer.invoke("planner:applyActions", actions),
  resetSeed: () => ipcRenderer.invoke("planner:resetSeed"),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  selectBackgroundImage: () => ipcRenderer.invoke("settings:selectBackgroundImage"),
  chat: (payload) => ipcRenderer.invoke("ai:chat", payload)
});
