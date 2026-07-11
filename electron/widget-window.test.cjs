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
      this.sent = [];
      this.webContents = { send: (...args) => this.sent.push(args) };
      windows.push(this);
    }
    isDestroyed() { return this.destroyed; }
    show() { this.shown = true; }
    focus() { this.focused = true; }
    close() { this.destroyed = true; this.events.get("closed")?.(); }
    setAlwaysOnTop(value) { this.alwaysOnTop = value; }
    setPosition(x, y) { this.bounds = { ...this.bounds, x, y }; }
    setBounds(bounds) { this.bounds = { ...this.bounds, ...bounds }; }
    setMaximumSize(width, height) { this.maximumSize = { width, height }; }
    getBounds() { return { ...this.bounds }; }
    getSize() { return [this.bounds.width, this.bounds.height]; }
    loadFile(file, options) { this.loaded = { file, options }; }
    loadURL(url) { this.loaded = { url }; }
    once(name, listener) { this.events.set(name, listener); }
    on(name, listener) { this.events.set(name, listener); }
    emit(name) { this.events.get(name)?.(); }
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

test("opens and resets the widget at the compact 400 by 80 default", async () => {
  const { deps, windows, handlers } = makeDeps();
  const service = createWidgetWindowService(deps);
  service.registerIpc();

  const first = service.open();
  const second = service.open();

  assert.equal(first, second);
  assert.equal(windows.length, 1);
  assert.equal(first.options.width, 400);
  assert.equal(first.options.height, 80);
  assert.equal(first.options.resizable, true);
  assert.equal(first.options.thickFrame, true);
  assert.equal(first.options.minWidth, 128);
  assert.equal(first.options.minHeight, 56);
  assert.equal(first.options.maxWidth, 860);
  assert.equal(first.options.maxHeight, 504);
  assert.ok(handlers.has("widget:set-bounds"));
  assert.ok(handlers.has("widget:get-bounds"));

  await handlers.get("widget:set-bounds")(null, { width: 128, height: 56 });
  assert.deepEqual(first.getBounds(), { x: 80, y: 80, width: 128, height: 56 });
});

test("clamps requested bounds to the current display", async () => {
  const { deps, handlers } = makeDeps();
  const service = createWidgetWindowService(deps);
  service.registerIpc();
  const win = service.open();

  await handlers.get("widget:set-bounds")(null, { x: 1200, y: -20, width: 2000, height: 40 });

  assert.deepEqual(win.getBounds(), { x: 414, y: 0, width: 860, height: 56 });
});

test("rejects invalid requested bounds without corrupting the window", async () => {
  const { deps, handlers } = makeDeps();
  const service = createWidgetWindowService(deps);
  service.registerIpc();
  const win = service.open();

  await handlers.get("widget:set-bounds")(null, { x: "bad", width: Number.NaN });

  assert.deepEqual(win.getBounds(), { x: 80, y: 80, width: 400, height: 80 });
});

test("positions the popover below the widget when it fits", () => {
  assert.deepEqual(
    positionPopover(
      { x: 80, y: 80, width: 500, height: 88 },
      { width: 332, height: 360 },
      { x: 0, y: 0, width: 1280, height: 720 },
    ),
    { x: 248, y: 174, width: 332, height: 360, openAbove: false, scrollRequired: false },
  );
});

test("positions the popover above and within the work area when needed", () => {
  assert.deepEqual(
    positionPopover(
      { x: 1800, y: 950, width: 128, height: 56 },
      { width: 332, height: 360 },
      { x: 1280, y: 0, width: 1920, height: 1080 },
    ),
    { x: 1596, y: 584, width: 332, height: 360, openAbove: true, scrollRequired: false },
  );
});

test("clamps popovers on right, left, and negative-coordinate displays", () => {
  assert.deepEqual(
    positionPopover(
      { x: -1900, y: 100, width: 128, height: 56 },
      { width: 332, height: 360 },
      { x: -1920, y: 0, width: 1920, height: 1080 },
    ),
    { x: -1914, y: 162, width: 332, height: 360, openAbove: false, scrollRequired: false },
  );
  assert.equal(positionPopover(
    { x: 1180, y: 100, width: 128, height: 56 },
    { width: 332, height: 360 },
    { x: 0, y: 0, width: 1280, height: 720 },
  ).x, 942);
});

test("constrains popover height and requests scrolling when neither side fits", () => {
  assert.deepEqual(
    positionPopover(
      { x: 80, y: 90, width: 128, height: 56 },
      { width: 332, height: 420 },
      { x: 0, y: 0, width: 800, height: 240 },
    ),
    { x: 6, y: 152, width: 332, height: 82, openAbove: false, scrollRequired: true },
  );
});

test("rounds fractional display bounds at 125 percent scaling", () => {
  assert.deepEqual(
    positionPopover(
      { x: 100.4, y: 80.6, width: 500.2, height: 88.2 },
      { width: 331.6, height: 359.6 },
      { x: 0, y: 0, width: 1280, height: 720 },
    ),
    { x: 269, y: 175, width: 332, height: 360, openAbove: false, scrollRequired: false },
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

test("toggles a separate fixed-size popover without changing widget bounds", async () => {
  const { deps, handlers, windows } = makeDeps();
  const service = createWidgetWindowService(deps);
  service.registerIpc();
  service.open();

  await handlers.get("widget:toggle-popover")();

  assert.equal(windows.length, 2);
  assert.equal(windows[1].options.width, 332);
  assert.equal(windows[1].options.height, 420);
  assert.equal(windows[1].options.resizable, false);
  assert.deepEqual(windows[0].getBounds(), { x: 80, y: 80, width: 400, height: 80 });
  assert.deepEqual(windows[1].loaded.options.query, { widgetPopover: "1" });
  assert.deepEqual(windows[1].getBounds(), { x: 148, y: 166, width: 332, height: 420 });
  windows[1].emit("ready-to-show");
  assert.equal(windows[1].shown, true);
  assert.equal(windows[1].focused, true);
  assert.deepEqual(windows[0].sent, [["widget:popover-state", true]]);

  await handlers.get("widget:toggle-popover")();
  assert.equal(windows[1].isDestroyed(), true);
  assert.deepEqual(windows[0].sent.at(-1), ["widget:popover-state", false]);
});

test("closes the popover on blur and through the close IPC handler", async () => {
  const { deps, handlers, windows } = makeDeps();
  const service = createWidgetWindowService(deps);
  service.registerIpc();
  service.open();

  await handlers.get("widget:toggle-popover")();
  windows[1].emit("blur");
  assert.equal(windows[1].isDestroyed(), true);

  await handlers.get("widget:toggle-popover")();
  assert.equal(windows.length, 3);
  await handlers.get("widget:close-popover")();
  assert.equal(windows[2].isDestroyed(), true);
});

test("delayed events from a closed popover cannot dismiss its replacement", async () => {
  const { deps, handlers, windows } = makeDeps();
  const service = createWidgetWindowService(deps);
  service.registerIpc();
  service.open();

  await handlers.get("widget:toggle-popover")();
  const oldPopover = windows[1];
  await handlers.get("widget:close-popover")({ sender: "ipc-event" });
  await handlers.get("widget:toggle-popover")();
  const replacement = windows[2];

  oldPopover.emit("blur");
  oldPopover.emit("closed");

  assert.equal(replacement.isDestroyed(), false);
});

test("closes the popover when the widget moves, resizes, or closes", async () => {
  for (const eventName of ["move", "resize", "closed"]) {
    const { deps, handlers, windows } = makeDeps();
    const service = createWidgetWindowService(deps);
    service.registerIpc();
    const widget = service.open();
    await handlers.get("widget:toggle-popover")();

    widget.emit(eventName);

    assert.equal(windows[1].isDestroyed(), true, eventName);
  }
});

test("broadcasts snapshots to both live renderer windows and owns each", async () => {
  const { deps, handlers, windows } = makeDeps();
  const service = createWidgetWindowService(deps);
  service.registerIpc();
  service.open();
  await handlers.get("widget:toggle-popover")();
  const snapshot = { taskTitle: "Focus" };

  service.broadcastSnapshot(snapshot);

  assert.deepEqual(windows[0].sent, [["widget:snapshot", snapshot]]);
  assert.deepEqual(windows[1].sent, [["widget:snapshot", snapshot]]);
  assert.equal(service.ownsWindow(windows[0]), true);
  assert.equal(service.ownsWindow(windows[1]), true);
  assert.equal(service.ownsWindow({}), false);
});
