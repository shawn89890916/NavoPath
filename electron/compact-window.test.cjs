const test = require("node:test");
const assert = require("node:assert/strict");
const { compactWindowPosition, createCompactWindowService } = require("./compact-window.cjs");

function makeDeps({ packaged = true } = {}) {
  const handlers = new Map();
  const windows = [];
  class FakeWindow {
    constructor(options) {
      this.options = options;
      this.destroyed = false;
      this.events = new Map();
      windows.push(this);
    }
    isDestroyed() { return this.destroyed; }
    show() { this.shown = true; }
    focus() { this.focused = true; }
    close() { this.destroyed = true; this.events.get("closed")?.(); }
    setAlwaysOnTop(value) { this.alwaysOnTop = value; }
    loadFile(file, options) { this.loaded = { file, options }; }
    loadURL(url) { this.loaded = { url }; }
    once(name, listener) { this.events.set(name, listener); }
    on(name, listener) { this.events.set(name, listener); }
    emit(name) { this.events.get(name)?.(); }
  }
  return {
    handlers,
    windows,
    deps: {
      BrowserWindow: FakeWindow,
      app: { isPackaged: packaged },
      ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
      screen: { getPrimaryDisplay: () => ({ workArea: { x: 0, y: 0, width: 1280, height: 900 } }) },
      fs: { existsSync: () => packaged },
      env: packaged ? {} : { VITE_DEV_SERVER_URL: "http://127.0.0.1:5173" },
      preloadPath: "C:/app/electron/preload.cjs",
      localIndexPath: "C:/app/dist/index.html",
      iconPath: "C:/app/dist/navopath-icon.png",
    },
  };
}

test("positions the portrait window inside the work area", () => {
  assert.deepEqual(
    compactWindowPosition({ x: 0, y: 0, width: 1280, height: 900 }),
    { x: 844, y: 70, width: 420, height: 760 },
  );
});

test("opens one independent portrait app window and reuses it", () => {
  const { deps, windows } = makeDeps();
  const service = createCompactWindowService(deps);
  const first = service.open({ alwaysOnTop: true });
  const second = service.open({ alwaysOnTop: false });

  assert.equal(first, second);
  assert.equal(windows.length, 1);
  assert.equal(first.options.width, 420);
  assert.equal(first.options.height, 760);
  assert.equal(first.options.minWidth, 360);
  assert.equal(first.options.minHeight, 560);
  assert.equal(first.options.resizable, true);
  assert.deepEqual(first.loaded.options.query, { compactWindow: "1" });
  assert.equal(first.alwaysOnTop, false);
});

test("registers open, close, and always-on-top controls", async () => {
  const { deps, handlers, windows } = makeDeps({ packaged: false });
  const service = createCompactWindowService(deps);
  service.registerIpc();

  await handlers.get("compact-window:open")(null, { alwaysOnTop: true });
  assert.equal(windows[0].loaded.url, "http://127.0.0.1:5173/app?compactWindow=1");
  await handlers.get("compact-window:set-always-on-top")(null, false);
  assert.equal(windows[0].alwaysOnTop, false);
  await handlers.get("compact-window:close")();
  assert.equal(windows[0].isDestroyed(), true);
  assert.equal(service.getWindow(), null);
});
