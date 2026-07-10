const test = require("node:test");
const assert = require("node:assert/strict");
const { createWidgetWindowService, positionPopover } = require("./widget-window.cjs");

function makeDeps() {
  const handlers = new Map();
  const screenEvents = new Map();
  const windows = [];
  class FakeWindow {
    constructor(options) {
      this.options = options;
      this.destroyed = false;
      this.events = new Map();
      this.bounds = { x: 80, y: 80, width: options.width, height: options.height };
      this.webContents = { send() {} };
      windows.push(this);
    }
    isDestroyed() { return this.destroyed; }
    show() { this.shown = true; }
    focus() { this.focused = true; }
    close() { this.destroyed = true; this.events.get("closed")?.(); }
    setAlwaysOnTop(value) { this.alwaysOnTop = value; }
    setBounds(bounds) { this.bounds = { ...this.bounds, ...bounds }; }
    setMaximumSize(width, height) { this.maximumSize = { width, height }; }
    getBounds() { return { ...this.bounds }; }
    loadFile(file, options) { this.loaded = { file, options }; }
    loadURL(url) { this.loaded = { url }; }
    once(name, listener) { this.events.set(name, listener); }
    on(name, listener) { this.events.set(name, listener); }
  }

  return {
    windows,
    handlers,
    deps: {
      BrowserWindow: FakeWindow,
      app: { isPackaged: true, getAppPath: () => "C:/app" },
      ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
      screen: {
        getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1280, height: 720 } }),
        getPrimaryDisplay: () => ({ workArea: { x: 0, y: 0, width: 1280, height: 720 } }),
        on: (name, listener) => screenEvents.set(name, listener),
      },
      fs: { existsSync: () => true },
      path: require("node:path"),
      env: {},
      preloadPath: "C:/app/electron/preload.cjs",
      localIndexPath: "C:/app/dist/index.html",
      iconPath: "C:/app/dist/navopath-icon.png",
    },
    screenEvents,
  };
}

test("creates a reusable resizable widget window and registers IPC", async () => {
  const { deps, windows, handlers } = makeDeps();
  const service = createWidgetWindowService(deps);
  service.registerIpc();

  const first = service.open();
  const second = service.open();

  assert.equal(first, second);
  assert.equal(windows.length, 1);
  assert.equal(first.options.width, 500);
  assert.equal(first.options.height, 88);
  assert.equal(first.options.resizable, true);
  assert.equal(first.options.thickFrame, true);
  assert.equal(first.options.minWidth, 360);
  assert.equal(first.options.minHeight, 84);
  assert.equal(first.options.maxWidth, 860);
  assert.equal(first.options.maxHeight, 504);
  assert.ok(handlers.has("widget:set-bounds"));
  assert.ok(handlers.has("widget:get-bounds"));
});

test("clamps requested bounds to the current display", async () => {
  const { deps, handlers } = makeDeps();
  const service = createWidgetWindowService(deps);
  service.registerIpc();
  const win = service.open();

  await handlers.get("widget:set-bounds")(null, { x: 1200, y: -20, width: 2000, height: 40 });

  assert.deepEqual(win.getBounds(), { x: 414, y: 0, width: 860, height: 84 });
});

test("rejects invalid requested bounds without corrupting the window", async () => {
  const { deps, handlers } = makeDeps();
  const service = createWidgetWindowService(deps);
  service.registerIpc();
  const win = service.open();

  await handlers.get("widget:set-bounds")(null, { x: "bad", width: Number.NaN });

  assert.deepEqual(win.getBounds(), { x: 80, y: 80, width: 500, height: 88 });
});

test("positions the popover below the widget when it fits", () => {
  assert.deepEqual(
    positionPopover(
      { x: 80, y: 80, width: 500, height: 88 },
      { width: 280, height: 252 },
      { x: 0, y: 0, width: 1280, height: 720 },
    ),
    { x: 300, y: 174 },
  );
});

test("positions the popover above and within the work area when needed", () => {
  assert.deepEqual(
    positionPopover(
      { x: 900, y: 620, width: 360, height: 88 },
      { width: 280, height: 252 },
      { x: 0, y: 0, width: 1280, height: 720 },
    ),
    { x: 980, y: 362 },
  );
});

test("re-clamps the widget when display metrics change", () => {
  const { deps, screenEvents } = makeDeps();
  const service = createWidgetWindowService(deps);
  service.registerIpc();
  const win = service.open();
  win.bounds = { x: 1000, y: 600, width: 860, height: 500 };

  screenEvents.get("display-metrics-changed")();

  assert.deepEqual(win.getBounds(), { x: 414, y: 214, width: 860, height: 500 });
  assert.deepEqual(win.maximumSize, { width: 860, height: 504 });
});

test("restores bounds against the target display instead of the current display", async () => {
  const { deps, handlers } = makeDeps();
  deps.screen.getDisplayMatching = (bounds) => bounds.x >= 1280
    ? { workArea: { x: 1280, y: 0, width: 1920, height: 1080 } }
    : { workArea: { x: 0, y: 0, width: 1280, height: 720 } };
  const service = createWidgetWindowService(deps);
  service.registerIpc();
  const win = service.open();

  await handlers.get("widget:set-bounds")(null, { x: 1500, y: 120, width: 700, height: 300 });

  assert.deepEqual(win.getBounds(), { x: 1500, y: 120, width: 700, height: 300 });
  assert.deepEqual(win.maximumSize, { width: 860, height: 756 });
});
