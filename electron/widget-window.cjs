const WIDGET_MIN_WIDTH = 360;
const WIDGET_MAX_WIDTH = 860;
const WIDGET_MIN_HEIGHT = 84;
const DEFAULT_WIDGET_WIDTH = 500;
const DEFAULT_WIDGET_HEIGHT = 88;
const POPOVER_WIDTH = 280;
const POPOVER_HEIGHT = 252;
const POPOVER_GAP = 6;
const WINDOW_MARGIN = 6;

function maxHeightFor(workArea) {
  return Math.max(320, Math.round(workArea.height * 0.7));
}

function clampBounds(bounds, workArea) {
  const safeX = Number.isFinite(Number(bounds.x)) ? Number(bounds.x) : workArea.x;
  const safeY = Number.isFinite(Number(bounds.y)) ? Number(bounds.y) : workArea.y;
  const safeWidth = Number.isFinite(Number(bounds.width)) ? Number(bounds.width) : DEFAULT_WIDGET_WIDTH;
  const safeHeight = Number.isFinite(Number(bounds.height)) ? Number(bounds.height) : DEFAULT_WIDGET_HEIGHT;
  const maxWidth = Math.min(WIDGET_MAX_WIDTH, Math.max(WIDGET_MIN_WIDTH, workArea.width - WINDOW_MARGIN * 2));
  const maxHeight = Math.min(maxHeightFor(workArea), Math.max(WIDGET_MIN_HEIGHT, workArea.height - WINDOW_MARGIN * 2));
  const width = Math.min(maxWidth, Math.max(WIDGET_MIN_WIDTH, Math.round(safeWidth)));
  const height = Math.min(maxHeight, Math.max(WIDGET_MIN_HEIGHT, Math.round(safeHeight)));
  return {
    x: Math.min(workArea.x + workArea.width - width - WINDOW_MARGIN, Math.max(workArea.x, Math.round(safeX))),
    y: Math.min(workArea.y + workArea.height - height - WINDOW_MARGIN, Math.max(workArea.y, Math.round(safeY))),
    width,
    height,
  };
}

function positionPopover(widgetBounds, popoverSize, workArea) {
  const minX = workArea.x;
  const maxX = workArea.x + workArea.width - popoverSize.width;
  const x = Math.min(maxX, Math.max(minX, widgetBounds.x + widgetBounds.width - popoverSize.width));
  const below = widgetBounds.y + widgetBounds.height + POPOVER_GAP;
  const y = below + popoverSize.height <= workArea.y + workArea.height
    ? below
    : Math.max(workArea.y, widgetBounds.y - popoverSize.height - POPOVER_GAP);
  return { x: Math.round(x), y: Math.round(y) };
}

function createWidgetWindowService(deps) {
  let widgetWindow = null;
  let popoverWindow = null;
  let registered = false;

  function displayFor(bounds) {
    return deps.screen.getDisplayMatching?.(bounds) || deps.screen.getPrimaryDisplay();
  }

  function open() {
    if (widgetWindow && !widgetWindow.isDestroyed()) {
      widgetWindow.show();
      widgetWindow.focus();
      return widgetWindow;
    }
    const workArea = deps.screen.getPrimaryDisplay().workArea;
    widgetWindow = new deps.BrowserWindow({
      width: DEFAULT_WIDGET_WIDTH,
      height: DEFAULT_WIDGET_HEIGHT,
      minWidth: WIDGET_MIN_WIDTH,
      minHeight: WIDGET_MIN_HEIGHT,
      maxWidth: Math.min(WIDGET_MAX_WIDTH, workArea.width - WINDOW_MARGIN * 2),
      maxHeight: maxHeightFor(workArea),
      title: "NavoPath",
      icon: deps.iconPath,
      alwaysOnTop: true,
      frame: false,
      thickFrame: true,
      resizable: true,
      transparent: true,
      autoHideMenuBar: true,
      backgroundColor: "#00000000",
      hasShadow: false,
      show: false,
      webPreferences: {
        preload: deps.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    const useLocalFile = deps.app.isPackaged || (deps.fs.existsSync(deps.localIndexPath) && !deps.env.VITE_DEV_SERVER_URL);
    if (useLocalFile) {
      widgetWindow.loadFile(deps.localIndexPath, { query: { widget: "1" } });
    } else {
      const baseUrl = deps.env.VITE_DEV_SERVER_URL || deps.env.NAVOPATH_APP_URL || "https://navopath-xiaoyang.pages.dev";
      widgetWindow.loadURL(`${baseUrl}/app?widget=1`);
    }
    widgetWindow.once("ready-to-show", () => widgetWindow?.show());
    widgetWindow.on("move", () => closePopover());
    widgetWindow.on("resize", () => closePopover());
    widgetWindow.on("closed", () => {
      closePopover();
      widgetWindow = null;
    });
    return widgetWindow;
  }

  function closePopover(target = popoverWindow) {
    if (target && !target.isDestroyed()) target.close();
    return true;
  }

  function togglePopover() {
    if (popoverWindow && !popoverWindow.isDestroyed()) return closePopover();
    if (!widgetWindow || widgetWindow.isDestroyed()) return false;
    const popover = new deps.BrowserWindow({
      width: POPOVER_WIDTH,
      height: POPOVER_HEIGHT,
      parent: widgetWindow,
      title: "NavoPath",
      icon: deps.iconPath,
      alwaysOnTop: true,
      frame: false,
      transparent: true,
      resizable: false,
      skipTaskbar: true,
      autoHideMenuBar: true,
      backgroundColor: "#00000000",
      hasShadow: false,
      show: false,
      webPreferences: {
        preload: deps.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    popoverWindow = popover;
    const workArea = displayFor(widgetWindow.getBounds()).workArea;
    const [width, height] = popover.getSize();
    const position = positionPopover(widgetWindow.getBounds(), { width, height }, workArea);
    popover.setPosition(position.x, position.y);
    const useLocalFile = deps.app.isPackaged || (deps.fs.existsSync(deps.localIndexPath) && !deps.env.VITE_DEV_SERVER_URL);
    if (useLocalFile) {
      popover.loadFile(deps.localIndexPath, { query: { widgetPopover: "1" } });
    } else {
      const baseUrl = deps.env.VITE_DEV_SERVER_URL || deps.env.NAVOPATH_APP_URL || "https://navopath-xiaoyang.pages.dev";
      popover.loadURL(`${baseUrl}/app?widgetPopover=1`);
    }
    popover.once("ready-to-show", () => {
      if (popoverWindow !== popover || popover.isDestroyed()) return;
      popover.show();
      popover.focus();
    });
    popover.on("blur", () => closePopover(popover));
    popover.on("closed", () => {
      if (popoverWindow === popover) popoverWindow = null;
    });
    return true;
  }

  function broadcastSnapshot(snapshot) {
    for (const win of [widgetWindow, popoverWindow]) {
      if (win && !win.isDestroyed()) win.webContents.send("widget:snapshot", snapshot);
    }
  }

  function ownsWindow(win) {
    return win === widgetWindow || win === popoverWindow;
  }

  function registerIpc() {
    if (registered) return;
    registered = true;
    deps.ipcMain.handle("widget:open", () => { open(); return true; });
    deps.ipcMain.handle("widget:close", () => { if (widgetWindow && !widgetWindow.isDestroyed()) widgetWindow.close(); return true; });
    deps.ipcMain.handle("widget:toggle-popover", togglePopover);
    deps.ipcMain.handle("widget:close-popover", () => closePopover());
    deps.ipcMain.handle("widget:set-always-on-top", (_event, enabled) => {
      if (widgetWindow && !widgetWindow.isDestroyed()) widgetWindow.setAlwaysOnTop(Boolean(enabled));
      return true;
    });
    deps.ipcMain.handle("widget:get-bounds", () => {
      if (!widgetWindow || widgetWindow.isDestroyed()) return null;
      return widgetWindow.getBounds();
    });
    deps.ipcMain.handle("widget:set-bounds", (_event, requested) => {
      if (!widgetWindow || widgetWindow.isDestroyed() || !requested) return false;
      const current = widgetWindow.getBounds();
      const next = { ...current };
      for (const key of ["x", "y", "width", "height"]) {
        const value = Number(requested[key]);
        if (Number.isFinite(value)) next[key] = value;
      }
      const workArea = displayFor(next).workArea;
      widgetWindow.setMaximumSize?.(
        Math.min(WIDGET_MAX_WIDTH, workArea.width - WINDOW_MARGIN * 2),
        maxHeightFor(workArea),
      );
      widgetWindow.setBounds(clampBounds(next, workArea));
      return true;
    });
    deps.ipcMain.handle("widget:get-work-area", () => {
      if (!widgetWindow || widgetWindow.isDestroyed()) return deps.screen.getPrimaryDisplay().workArea;
      return displayFor(widgetWindow.getBounds()).workArea;
    });
    const refreshBounds = () => {
      if (!widgetWindow || widgetWindow.isDestroyed()) return;
      const current = widgetWindow.getBounds();
      const workArea = displayFor(current).workArea;
      widgetWindow.setMaximumSize?.(
        Math.min(WIDGET_MAX_WIDTH, workArea.width - WINDOW_MARGIN * 2),
        maxHeightFor(workArea),
      );
      widgetWindow.setBounds(clampBounds(current, workArea));
    };
    const registerDisplayListeners = () => {
      deps.screen.on?.("display-metrics-changed", refreshBounds);
      deps.screen.on?.("display-removed", refreshBounds);
    };
    if (typeof deps.app.isReady === "function" && !deps.app.isReady() && typeof deps.app.whenReady === "function") {
      void deps.app.whenReady().then(registerDisplayListeners);
    } else {
      registerDisplayListeners();
    }
  }

  return {
    open,
    registerIpc,
    togglePopover,
    closePopover,
    broadcastSnapshot,
    ownsWindow,
    getWindow: () => widgetWindow,
  };
}

module.exports = {
  DEFAULT_WIDGET_HEIGHT,
  DEFAULT_WIDGET_WIDTH,
  clampBounds,
  createWidgetWindowService,
  positionPopover,
};
