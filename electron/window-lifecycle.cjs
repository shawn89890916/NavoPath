function createPrimaryWindowRegistry() {
  let primaryWindow = null;

  function get() {
    if (primaryWindow?.isDestroyed?.()) primaryWindow = null;
    return primaryWindow;
  }

  return {
    get,
    set: (win) => {
      primaryWindow = win || null;
      return primaryWindow;
    },
    clear: (win) => {
      if (primaryWindow === win) primaryWindow = null;
    },
    show: () => {
      const win = get();
      if (!win) return null;
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
      return win;
    },
  };
}

function windowFromEvent(BrowserWindow, event) {
  try {
    return BrowserWindow.fromWebContents(event?.sender) || null;
  } catch {
    return null;
  }
}

function broadcastToLiveWindows(windows, channel, payload) {
  for (const win of windows) {
    if (!win || win.isDestroyed?.()) continue;
    const contents = win.webContents;
    if (!contents || contents.isDestroyed?.()) continue;
    try {
      contents.send(channel, payload);
    } catch {
      // A renderer can close between the lifecycle check and send.
    }
  }
}

module.exports = {
  broadcastToLiveWindows,
  createPrimaryWindowRegistry,
  windowFromEvent,
};
