const { app, BrowserWindow, ipcMain, safeStorage, shell, Tray, Menu, nativeImage, screen } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { createWidgetWindowService } = require("./widget-window.cjs");
const { createCompactWindowService } = require("./compact-window.cjs");
const { createRendererPolicy, resolveDevAppUrl } = require("./renderer-security.cjs");
const {
  readSnapshotFile,
  serializeSnapshot,
  writeSnapshotFile,
} = require("./snapshot-safety.cjs");
const {
  isAuthStorageKey,
  readAuthStorageFile,
  writeAuthStorageFile,
} = require("./auth-storage-safety.cjs");
const {
  createWidgetIpcPolicy,
  sanitizeWidgetAction,
} = require("./widget-ipc-policy.cjs");
const {
  broadcastToLiveWindows,
  createPrimaryWindowRegistry,
  windowFromEvent,
} = require("./window-lifecycle.cjs");
// Lazy-loaded: electron-updater is not needed until autoUpdater is configured
let _autoUpdaterModule;
let _autoUpdater;
function getAutoUpdaterModule() {
  if (!_autoUpdaterModule) _autoUpdaterModule = require("electron-updater");
  return _autoUpdaterModule;
}
function getAutoUpdater() {
  if (_autoUpdater) return _autoUpdater;
  const updaterModule = getAutoUpdaterModule();
  const resolvedUpdater = updaterModule?.autoUpdater
    ?? updaterModule?.default?.autoUpdater
    ?? updaterModule?.default
    ?? updaterModule;
  if (!resolvedUpdater || typeof resolvedUpdater.on !== "function") {
    throw new TypeError("electron-updater autoUpdater instance is unavailable");
  }
  _autoUpdater = resolvedUpdater;
  return _autoUpdater;
}

app.setName("NavoPath");

const localIndexPath = app.isPackaged
  ? path.join(app.getAppPath(), "dist", "index.html")
  : path.join(__dirname, "..", "dist", "index.html");
const rendererPolicy = createRendererPolicy({
  localIndexPath,
  devServerUrl: app.isPackaged ? "" : process.env.VITE_DEV_SERVER_URL,
});
function handleTrusted(channel, handler) {
  ipcMain.handle(channel, (event, ...args) => {
    rendererPolicy.assertTrustedSender(event);
    return handler(event, ...args);
  });
}
function onTrusted(channel, listener) {
  ipcMain.on(channel, (event, ...args) => {
    try {
      rendererPolicy.assertTrustedSender(event);
    } catch {
      return;
    }
    listener(event, ...args);
  });
}
const trustedIpcMain = { handle: handleTrusted, on: onTrusted };
const primaryWindowRegistry = createPrimaryWindowRegistry();
function isPrimaryWindowEvent(event) {
  const primaryWindow = primaryWindowRegistry.get();
  return Boolean(primaryWindow && windowFromEvent(BrowserWindow, event) === primaryWindow);
}

const UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000;
let manualUpdateRequested = false;
let updateState = {
  status: app.isPackaged ? "idle" : "unsupported",
  currentVersion: app.getVersion(),
  availableVersion: "",
  progress: 0,
  message: app.isPackaged ? "" : "Update checks are available in the installed desktop app."
};

function publishUpdateState(patch) {
  updateState = { ...updateState, ...patch, currentVersion: app.getVersion() };
  broadcastToLiveWindows(BrowserWindow.getAllWindows(), "updater:state", updateState);
  return updateState;
}

async function checkForDesktopUpdate(manual = false) {
  const autoUpdater = getAutoUpdater();
  if (!app.isPackaged) return publishUpdateState({ status: "unsupported" });
  if (["checking", "downloading"].includes(updateState.status)) return updateState;
  if (manual && updateState.status === "available") {
    manualUpdateRequested = false;
    publishUpdateState({ status: "downloading", progress: 0 });
    await autoUpdater.downloadUpdate();
    return updateState;
  }
  manualUpdateRequested = manual;
  publishUpdateState({ status: "checking", progress: 0, message: "" });
  await autoUpdater.checkForUpdates();
  return updateState;
}

function configureAutoUpdater() {
  const autoUpdater = getAutoUpdater();
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("update-available", async (info) => {
    publishUpdateState({ status: "available", availableVersion: info.version, progress: 0 });
    if (!manualUpdateRequested) return;
    manualUpdateRequested = false;
    publishUpdateState({ status: "downloading", progress: 0 });
    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      publishUpdateState({ status: "error", message: error instanceof Error ? error.message : String(error) });
    }
  });
  autoUpdater.on("update-not-available", () => {
    manualUpdateRequested = false;
    publishUpdateState({ status: "current", availableVersion: "", progress: 0 });
  });
  autoUpdater.on("download-progress", (progress) => {
    publishUpdateState({ status: "downloading", progress: Math.round(progress.percent || 0) });
  });
  autoUpdater.on("update-downloaded", (info) => {
    publishUpdateState({ status: "downloaded", availableVersion: info.version, progress: 100 });
  });
  autoUpdater.on("error", (error) => {
    manualUpdateRequested = false;
    publishUpdateState({ status: "error", message: error instanceof Error ? error.message : String(error) });
  });

  if (!app.isPackaged) return;
  const initialTimer = setTimeout(() => void checkForDesktopUpdate(false).catch((error) => publishUpdateState({ status: "error", message: String(error) })), 30_000);
  const interval = setInterval(() => void checkForDesktopUpdate(false).catch((error) => publishUpdateState({ status: "error", message: String(error) })), UPDATE_INTERVAL_MS);
  initialTimer.unref?.();
  interval.unref?.();
}

function getPaths() {
  const dir = app.getPath("userData");
  return {
    dir,
    authSessionPath: path.join(dir, "auth-session.json"),
    pluginsDir: path.join(dir, "plugins")
  };
}

function validateAuthStorageKey(key) {
  if (!isAuthStorageKey(key)) {
    throw new Error("Invalid authentication storage key.");
  }
}

function readAuthStorage(key) {
  validateAuthStorageKey(key);
  const { authSessionPath } = getPaths();
  const state = readAuthStorageFile(authSessionPath);
  if (!state.ok) return null;
  const stored = state.data;
  const storedValue = stored[key];
  if (typeof storedValue !== "string" || !storedValue) return null;
  if (storedValue.startsWith("plain:")) {
    delete stored[key];
    try { writeAuthStorageFile(authSessionPath, stored); } catch { /* keep the original file */ }
    return null;
  }
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    const encryptedValue = storedValue.startsWith("safe:") ? storedValue.slice("safe:".length) : storedValue;
    return safeStorage.decryptString(Buffer.from(encryptedValue, "base64"));
  } catch {
    return null;
  }
}

function writeAuthStorage(key, value) {
  validateAuthStorageKey(key);
  if (typeof value !== "string" || value.length > 1024 * 1024) {
    throw new Error("Invalid authentication storage value.");
  }
  const { dir, authSessionPath } = getPaths();
  fs.mkdirSync(dir, { recursive: true });
  if (!safeStorage.isEncryptionAvailable()) return false;
  let encryptedValue;
  try {
    encryptedValue = `safe:${safeStorage.encryptString(value).toString("base64")}`;
  } catch {
    return false;
  }
  const state = readAuthStorageFile(authSessionPath);
  const stored = state.ok ? state.data : {};
  if (!state.ok && fs.existsSync(authSessionPath)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(dir, `auth-session.corrupt-${stamp}.json`);
    try {
      fs.copyFileSync(authSessionPath, backupPath);
    } catch {
      return false;
    }
    console.warn(`[auth] invalid authentication storage preserved at ${backupPath}`);
  }
  stored[key] = encryptedValue;
  try {
    writeAuthStorageFile(authSessionPath, stored);
    return true;
  } catch {
    return false;
  }
}

function removeAuthStorage(key) {
  validateAuthStorageKey(key);
  const { authSessionPath } = getPaths();
  const state = readAuthStorageFile(authSessionPath);
  if (!state.ok) return;
  const stored = state.data;
  if (!(key in stored)) return;
  delete stored[key];
  writeAuthStorageFile(authSessionPath, stored);
}

const allowedPluginPermissions = new Set(["tasks", "settings", "ui", "events", "calendar"]);
const allowedPluginFieldTypes = new Set(["boolean", "number", "string", "select"]);

function cleanText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 200) : fallback;
}

function cleanLocalizedText(value) {
  if (!value || typeof value !== "object") return undefined;
  const result = {};
  for (const lang of ["zh", "en"]) {
    const text = cleanText(value[lang]);
    if (text) result[lang] = text;
  }
  return Object.keys(result).length ? result : undefined;
}

function cleanPluginConfigFields(fields) {
  if (!Array.isArray(fields)) return [];
  return fields.slice(0, 20).flatMap((field) => {
    if (!field || typeof field !== "object") return [];
    const key = cleanText(field.key).replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 64);
    const type = cleanText(field.type);
    if (!key || !allowedPluginFieldTypes.has(type)) return [];
    const cleanField = {
      key,
      label: cleanText(field.label, key),
      labelI18n: cleanLocalizedText(field.labelI18n),
      type,
      default: field.default,
    };
    if (type === "number") {
      if (Number.isFinite(field.min)) cleanField.min = Number(field.min);
      if (Number.isFinite(field.max)) cleanField.max = Number(field.max);
    }
    if (type === "select" && Array.isArray(field.options)) {
      cleanField.options = field.options.slice(0, 50).flatMap((option) => {
        if (!option || typeof option !== "object") return [];
        const value = cleanText(option.value).slice(0, 100);
        if (!value) return [];
        return [{
          value,
          label: cleanText(option.label, value),
          labelI18n: cleanLocalizedText(option.labelI18n),
        }];
      });
    }
    return [cleanField];
  });
}

function readExternalPluginManifests() {
  const { pluginsDir } = getPaths();
  if (!fs.existsSync(pluginsDir)) return { plugins: [] };
  const plugins = [];
  for (const entry of fs.readdirSync(pluginsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const folderId = entry.name.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 80);
    const manifestPath = path.join(pluginsDir, entry.name, "manifest.json");
    if (!folderId || !fs.existsSync(manifestPath)) continue;
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      if (!manifest || typeof manifest !== "object") continue;
      const id = cleanText(manifest.id, folderId).replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 80);
      const name = cleanText(manifest.name, id);
      if (!id || !name) continue;
      plugins.push({
        id,
        name,
        nameI18n: cleanLocalizedText(manifest.nameI18n),
        description: cleanText(manifest.description, "Local plugin installed in the desktop plugin directory.").slice(0, 500),
        descriptionI18n: cleanLocalizedText(manifest.descriptionI18n),
        enabledSummaryI18n: cleanLocalizedText(manifest.enabledSummaryI18n) || {
          zh: "本地插件已保留在用户插件目录中；当前版本加载 manifest 和配置，不执行外部脚本。",
          en: "This local plugin is preserved in the user plugin directory; this build loads its manifest and config, not external scripts.",
        },
        version: cleanText(manifest.version, "0.0.0").slice(0, 40),
        author: cleanText(manifest.author, "Local").slice(0, 80),
        icon: cleanText(manifest.icon, "P").slice(0, 4),
        permissions: Array.isArray(manifest.permissions)
          ? manifest.permissions.filter((permission) => allowedPluginPermissions.has(permission)).slice(0, 5)
          : [],
        configFields: cleanPluginConfigFields(manifest.configFields),
        source: "external",
      });
    } catch (error) {
      console.warn(`[plugins] failed to read ${manifestPath}:`, error);
    }
  }
  return { plugins };
}

let isQuitting = false;
let tray = null;

function showMainWindow() {
  return primaryWindowRegistry.show() || createWindow();
}

function createWindow() {
  const existingWin = primaryWindowRegistry.get();
  if (existingWin) return existingWin;
  const iconPath = app.isPackaged
    ? path.join(app.getAppPath(), "dist", "navopath-icon.png")
    : path.join(__dirname, "..", "public", "navopath-icon.png");

  const useLocalFile = app.isPackaged || (fs.existsSync(localIndexPath) && !process.env.VITE_DEV_SERVER_URL);

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1180,
    minHeight: 720,
    title: "NavoPath",
    icon: iconPath,
    backgroundColor: "#f5f7fb",
    show: false, // Don't show until ready-to-show
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false
    }
  });
  primaryWindowRegistry.set(win);

  // Show window when content is ready for faster perceived performance
  win.once("ready-to-show", () => {
    win.show();
  });

  win.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    win.hide();
  });
  win.on("closed", () => primaryWindowRegistry.clear(win));

  win.webContents.on("did-fail-load", (_e, errorCode, errorDescription, validatedURL) => {
    console.error(`[did-fail-load] code=${errorCode} desc=${errorDescription} url=${validatedURL}`);
  });

  rendererPolicy.secureWindowNavigation(win, (url) => shell.openExternal(url));

  if (useLocalFile) {
    win.loadFile(localIndexPath);
  } else {
    win.loadURL(resolveDevAppUrl(process.env.VITE_DEV_SERVER_URL).toString());
  }
  return win;
}

// Single-instance lock: focus existing window instead of launching a duplicate
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    showMainWindow();
  });
}

app.whenReady().then(() => {
  // Create window first for fastest perceived startup
  createWindow();
  
  // Defer non-critical initialization to background
  setImmediate(() => {
    createTray();
    configureAutoUpdater();
  });
  
  app.on("activate", () => {
    showMainWindow();
  });
});

function createTray() {
  const iconPath = app.isPackaged
    ? path.join(app.getAppPath(), "dist", "navopath-icon.png")
    : path.join(__dirname, "..", "public", "navopath-icon.png");
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) trayIcon = nativeImage.createEmpty();
  } catch {
    trayIcon = nativeImage.createEmpty();
  }
  tray = new Tray(trayIcon);
  const contextMenu = Menu.buildFromTemplate([
    { label: "显示 NavoPath", click: () => showMainWindow() },
    { type: "separator" },
    { label: "退出", click: () => { isQuitting = true; app.quit(); } }
  ]);
  tray.setToolTip("NavoPath");
  tray.setContextMenu(contextMenu);
  tray.on("click", () => showMainWindow());
}

app.on("before-quit", () => { isQuitting = true; });

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    // Keep app alive in tray; only quit when user explicitly exits from tray
    if (!isQuitting) {
      const win = primaryWindowRegistry.get();
      if (win) win.hide();
    } else {
      app.quit();
    }
  }
});

handleTrusted("auth-storage:get", (_event, key) => readAuthStorage(key));
handleTrusted("auth-storage:set", (_event, key, value) => writeAuthStorage(key, value));
handleTrusted("auth-storage:remove", (_event, key) => removeAuthStorage(key));
handleTrusted("plugins:listExternal", () => readExternalPluginManifests());
handleTrusted("updater:getState", () => updateState);
handleTrusted("updater:check", async () => {
  try {
    return await checkForDesktopUpdate(true);
  } catch (error) {
    return publishUpdateState({ status: "error", message: error instanceof Error ? error.message : String(error) });
  }
});
handleTrusted("updater:install", () => {
  if (updateState.status !== "downloaded") return false;
  setImmediate(() => {
    const autoUpdater = getAutoUpdater();
    if (typeof autoUpdater.quitAndInstall !== "function") {
      publishUpdateState({
        status: "error",
        message: "The downloaded update cannot be installed automatically. Please download the latest installer manually."
      });
      return;
    }
    autoUpdater.quitAndInstall(false, true);
  });
  return true;
});

// Auto-launch at system startup (toggled from Settings)
handleTrusted("autolaunch:get", () => {
  try {
    return app.getLoginItemSettings().openAtLogin;
  } catch {
    return false;
  }
});
handleTrusted("autolaunch:set", (_event, enabled) => {
  try {
    app.setLoginItemSettings({ openAtLogin: !!enabled });
    return app.getLoginItemSettings().openAtLogin;
  } catch {
    return false;
  }
});

// Local JSON snapshot — written on every app launch (and on demand) so users
// always have an offline backup next to their auth session in userData.
handleTrusted("backup:writeSnapshot", (event, payload) => {
  if (!isPrimaryWindowEvent(event)) return { ok: false, error: "Only the main window can write recovery snapshots." };
  try {
    const { dir } = getPaths();
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const stampedPath = path.join(dir, `navopath-snapshot-${stamp}.json`);
    const latestPath = path.join(dir, "navopath-snapshot-latest.json");
    const body = serializeSnapshot(payload, app.getVersion());
    writeSnapshotFile(stampedPath, body);
    writeSnapshotFile(latestPath, body);
    // Keep only the 10 most recent stamped snapshots (latest is preserved separately).
    const snapshots = fs.readdirSync(dir)
      .filter((name) => /^navopath-snapshot-\d{4}-\d{2}-\d{2}T.+\.json$/.test(name))
      .sort()
      .reverse();
    for (const stale of snapshots.slice(10)) {
      try { fs.unlinkSync(path.join(dir, stale)); } catch { /* ignore */ }
    }
    return { ok: true, path: latestPath, stampedPath };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
});

handleTrusted("backup:readLatest", (event) => {
  if (!isPrimaryWindowEvent(event)) return { ok: false, error: "Only the main window can read recovery snapshots." };
  try {
    const { dir } = getPaths();
    const latestPath = path.join(dir, "navopath-snapshot-latest.json");
    if (!fs.existsSync(latestPath)) return { ok: false, reason: "not-found" };
    return { ok: true, payload: readSnapshotFile(latestPath) };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
});

// ============================================================
// Desktop widget window (always-on-top mini panel)
// ============================================================
const widgetIconPath = app.isPackaged
  ? path.join(app.getAppPath(), "dist", "navopath-icon.png")
  : path.join(__dirname, "..", "public", "navopath-icon.png");
let compactWindowService = null;
function isApplicationWindowEvent(event) {
  const win = windowFromEvent(BrowserWindow, event);
  return Boolean(
    win
    && (win === primaryWindowRegistry.get() || compactWindowService?.ownsWindow(win)),
  );
}
const widgetWindowService = createWidgetWindowService({
  BrowserWindow,
  app,
  ipcMain: trustedIpcMain,
  screen,
  fs,
  path,
  env: process.env,
  preloadPath: path.join(__dirname, "preload.cjs"),
  localIndexPath,
  iconPath: widgetIconPath,
  rendererPolicy,
  openExternal: (url) => shell.openExternal(url),
});
widgetWindowService.registerIpc();

compactWindowService = createCompactWindowService({
  BrowserWindow,
  app,
  ipcMain: trustedIpcMain,
  screen,
  fs,
  env: process.env,
  preloadPath: path.join(__dirname, "preload.cjs"),
  localIndexPath,
  iconPath: widgetIconPath,
  rendererPolicy,
  openExternal: (url) => shell.openExternal(url),
  canControl: isApplicationWindowEvent,
});
compactWindowService.registerIpc();

const widgetIpcPolicy = createWidgetIpcPolicy({
  BrowserWindow,
  widgetWindowService,
  getPrimaryWindow: () => primaryWindowRegistry.get(),
});

// Relay: widget renderer → main window (action requests)
onTrusted("widget:action", (event, action) => {
  if (!widgetIpcPolicy.canSendAction(event)) return;
  const safeAction = sanitizeWidgetAction(action);
  if (!safeAction) return;
  const main = primaryWindowRegistry.get();
  if (main) broadcastToLiveWindows([main], "widget:action", safeAction);
});

// Relay: main window → widget renderer (snapshot pushes)
onTrusted("widget:push-snapshot", (event, snapshot) => {
  if (!widgetIpcPolicy.canPushSnapshot(event)) return;
  widgetWindowService.broadcastSnapshot(snapshot);
});
