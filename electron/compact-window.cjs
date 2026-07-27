const { resolveDevAppUrl } = require("./renderer-security.cjs");

const DEFAULT_COMPACT_WIDTH = 420;
const DEFAULT_COMPACT_HEIGHT = 760;
const MIN_COMPACT_WIDTH = 360;
const MIN_COMPACT_HEIGHT = 560;
const WINDOW_MARGIN = 16;

function compactWindowPosition(workArea) {
  const width = Math.min(DEFAULT_COMPACT_WIDTH, Math.max(MIN_COMPACT_WIDTH, workArea.width - WINDOW_MARGIN * 2));
  const height = Math.min(DEFAULT_COMPACT_HEIGHT, Math.max(MIN_COMPACT_HEIGHT, workArea.height - WINDOW_MARGIN * 2));
  return {
    x: Math.round(workArea.x + workArea.width - width - WINDOW_MARGIN),
    y: Math.round(workArea.y + Math.max(WINDOW_MARGIN, (workArea.height - height) / 2)),
    width,
    height,
  };
}

function createCompactWindowService(deps) {
  let compactWindow = null;
  let registered = false;

  function open(options = {}) {
    const alwaysOnTop = options.alwaysOnTop !== false;
    if (compactWindow && !compactWindow.isDestroyed()) {
      compactWindow.setAlwaysOnTop(alwaysOnTop);
      compactWindow.show();
      compactWindow.focus();
      return compactWindow;
    }

    const bounds = compactWindowPosition(deps.screen.getPrimaryDisplay().workArea);
    compactWindow = new deps.BrowserWindow({
      ...bounds,
      minWidth: MIN_COMPACT_WIDTH,
      minHeight: MIN_COMPACT_HEIGHT,
      title: "NavoPath",
      icon: deps.iconPath,
      alwaysOnTop,
      resizable: true,
      autoHideMenuBar: true,
      backgroundColor: "#FBF9FF",
      show: false,
      webPreferences: {
        preload: deps.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    deps.rendererPolicy?.secureWindowNavigation(compactWindow, deps.openExternal);

    const createdWindow = compactWindow;
    const useLocalFile = deps.app.isPackaged || (deps.fs.existsSync(deps.localIndexPath) && !deps.env.VITE_DEV_SERVER_URL);
    if (useLocalFile) {
      createdWindow.loadFile(deps.localIndexPath, { query: { compactWindow: "1" } });
    } else {
      createdWindow.loadURL(resolveDevAppUrl(deps.env.VITE_DEV_SERVER_URL, { compactWindow: 1 }).toString());
    }
    createdWindow.once("ready-to-show", () => {
      if (compactWindow === createdWindow && !createdWindow.isDestroyed()) createdWindow.show();
    });
    createdWindow.on("closed", () => {
      if (compactWindow === createdWindow) compactWindow = null;
    });
    return createdWindow;
  }

  function registerIpc() {
    if (registered) return;
    registered = true;
    const canControl = (event) => typeof deps.canControl !== "function" || deps.canControl(event);
    deps.ipcMain.handle("compact-window:open", (event, options) => {
      if (!canControl(event)) return false;
      open(options);
      return true;
    });
    deps.ipcMain.handle("compact-window:close", (event) => {
      if (!canControl(event)) return false;
      if (compactWindow && !compactWindow.isDestroyed()) compactWindow.close();
      return true;
    });
    deps.ipcMain.handle("compact-window:set-always-on-top", (event, enabled) => {
      if (!canControl(event)) return false;
      if (compactWindow && !compactWindow.isDestroyed()) compactWindow.setAlwaysOnTop(Boolean(enabled));
      return true;
    });
  }

  return {
    open,
    registerIpc,
    ownsWindow: (win) => win === compactWindow,
    getWindow: () => compactWindow,
  };
}

module.exports = {
  DEFAULT_COMPACT_HEIGHT,
  DEFAULT_COMPACT_WIDTH,
  MIN_COMPACT_HEIGHT,
  MIN_COMPACT_WIDTH,
  compactWindowPosition,
  createCompactWindowService,
};
