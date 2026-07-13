const WIDGET_MIN_WIDTH = 128;
const WIDGET_MAX_WIDTH = 860;
const WIDGET_MIN_HEIGHT = 56;
const DEFAULT_WIDGET_WIDTH = 400;
const DEFAULT_WIDGET_HEIGHT = 80;
const POPOVER_WIDTH = 300;
const POPOVER_HEIGHT = 220;
const POPOVER_GAP = 6;
const WINDOW_MARGIN = 6;

function maxHeightFor(workArea) {
  return Math.max(320, Math.round(workArea.height * 0.7));
}

function clampBounds(bounds, workArea, fixedEdges = {}) {
  const safeX = Number.isFinite(Number(bounds.x)) ? Number(bounds.x) : workArea.x;
  const safeY = Number.isFinite(Number(bounds.y)) ? Number(bounds.y) : workArea.y;
  const safeWidth = Number.isFinite(Number(bounds.width)) ? Number(bounds.width) : DEFAULT_WIDGET_WIDTH;
  const safeHeight = Number.isFinite(Number(bounds.height)) ? Number(bounds.height) : DEFAULT_WIDGET_HEIGHT;
  const maxWidth = Math.min(WIDGET_MAX_WIDTH, Math.max(WIDGET_MIN_WIDTH, workArea.width - WINDOW_MARGIN * 2));
  const maxHeight = Math.min(maxHeightFor(workArea), Math.max(WIDGET_MIN_HEIGHT, workArea.height - WINDOW_MARGIN * 2));
  const width = Math.min(maxWidth, Math.max(WIDGET_MIN_WIDTH, Math.round(safeWidth)));
  const height = Math.min(maxHeight, Math.max(WIDGET_MIN_HEIGHT, Math.round(safeHeight)));
  const requestedRight = Math.round(safeX + safeWidth);
  const requestedBottom = Math.round(safeY + safeHeight);
  const requestedX = fixedEdges.horizontal === "right" ? requestedRight - width : Math.round(safeX);
  const requestedY = fixedEdges.vertical === "bottom" ? requestedBottom - height : Math.round(safeY);
  return {
    x: Math.min(workArea.x + workArea.width - width - WINDOW_MARGIN, Math.max(workArea.x, requestedX)),
    y: Math.min(workArea.y + workArea.height - height - WINDOW_MARGIN, Math.max(workArea.y, requestedY)),
    width,
    height,
  };
}

function positionPopover(widgetBounds, popoverSize, workArea) {
  const area = {
    x: Math.round(Number(workArea.x)),
    y: Math.round(Number(workArea.y)),
    width: Math.max(0, Math.round(Number(workArea.width))),
    height: Math.max(0, Math.round(Number(workArea.height))),
  };
  const widget = {
    x: Number(widgetBounds.x),
    y: Number(widgetBounds.y),
    width: Math.max(0, Number(widgetBounds.width)),
    height: Math.max(0, Number(widgetBounds.height)),
  };
  const requestedWidth = Math.max(1, Math.round(Number(popoverSize.width)));
  const originalRequestedHeight = Math.max(1, Math.round(Number(popoverSize.height)));
  const requestedHeight = Math.min(POPOVER_HEIGHT, originalRequestedHeight);
  const width = Math.min(requestedWidth, Math.max(1, area.width - WINDOW_MARGIN * 2));
  const minX = area.x + WINDOW_MARGIN;
  const maxX = area.x + area.width - WINDOW_MARGIN - width;
  const x = Math.min(maxX, Math.max(minX, widget.x + widget.width - width));

  const top = area.y + WINDOW_MARGIN;
  const bottom = area.y + area.height - WINDOW_MARGIN;
  const belowY = widget.y + widget.height + POPOVER_GAP;
  const belowSpace = Math.max(0, bottom - belowY);
  const aboveSpace = Math.max(0, widget.y - POPOVER_GAP - top);
  const fitsBelow = requestedHeight <= belowSpace;
  const fitsAbove = requestedHeight <= aboveSpace;
  const openAbove = !fitsBelow && (fitsAbove || aboveSpace > belowSpace);
  const availableHeight = openAbove ? aboveSpace : belowSpace;
  const height = Math.min(requestedHeight, availableHeight);
  const y = openAbove
    ? widget.y - POPOVER_GAP - height
    : belowY;

  return {
    x: Math.round(x),
    y: Math.round(y),
    width,
    height,
    openAbove,
    scrollRequired: height < originalRequestedHeight,
  };
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

  function broadcastPopoverState(openState) {
    if (widgetWindow && !widgetWindow.isDestroyed() && widgetWindow.webContents && !widgetWindow.webContents.isDestroyed()) {
      widgetWindow.webContents.send("widget:popover-state", Boolean(openState));
    }
  }

  function togglePopover() {
    if (popoverWindow && !popoverWindow.isDestroyed()) return closePopover();
    if (!widgetWindow || widgetWindow.isDestroyed()) return false;
    const workArea = displayFor(widgetWindow.getBounds()).workArea;
    const position = positionPopover(
      widgetWindow.getBounds(),
      { width: POPOVER_WIDTH, height: POPOVER_HEIGHT },
      workArea,
    );
    const popover = new deps.BrowserWindow({
      width: position.width,
      height: position.height,
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
      broadcastPopoverState(true);
    });
    popover.on("blur", () => closePopover(popover));
    popover.on("closed", () => {
      if (popoverWindow === popover) {
        popoverWindow = null;
        broadcastPopoverState(false);
      }
    });
    return true;
  }

  function broadcastSnapshot(snapshot) {
    for (const win of [widgetWindow, popoverWindow]) {
      if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) win.webContents.send("widget:snapshot", snapshot);
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
      const fixedEdges = requested.fixedEdges && typeof requested.fixedEdges === "object"
        ? {
            horizontal: requested.fixedEdges.horizontal === "right" ? "right" : "left",
            vertical: requested.fixedEdges.vertical === "bottom" ? "bottom" : "top",
          }
        : {};
      const workArea = displayFor(next).workArea;
      widgetWindow.setMaximumSize?.(
        Math.min(WIDGET_MAX_WIDTH, workArea.width - WINDOW_MARGIN * 2),
        maxHeightFor(workArea),
      );
      widgetWindow.setBounds(clampBounds(next, workArea, fixedEdges));
      return true;
    });
    deps.ipcMain.handle("widget:get-work-area", () => {
      if (!widgetWindow || widgetWindow.isDestroyed()) return deps.screen.getPrimaryDisplay().workArea;
      return displayFor(widgetWindow.getBounds()).workArea;
    });
    const refreshBounds = () => {
      if (!widgetWindow || widgetWindow.isDestroyed()) return;
      closePopover();
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
