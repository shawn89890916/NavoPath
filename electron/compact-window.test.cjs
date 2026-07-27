const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { compactWindowPosition, createCompactWindowService } = require("./compact-window.cjs");

function makeDeps({ packaged = true, canControl } = {}) {
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
      canControl,
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

test("rejects portrait window controls from non-application renderers", async () => {
  const { deps, handlers, windows } = makeDeps({
    canControl: (event) => event?.role === "application",
  });
  const service = createCompactWindowService(deps);
  service.registerIpc();

  assert.equal(await handlers.get("compact-window:open")({ role: "widget" }), false);
  assert.equal(windows.length, 0);

  const win = service.open({ alwaysOnTop: true });
  assert.equal(await handlers.get("compact-window:set-always-on-top")({ role: "widget" }, false), false);
  assert.equal(win.alwaysOnTop, undefined);
  assert.equal(await handlers.get("compact-window:close")({ role: "widget" }), false);
  assert.equal(win.isDestroyed(), false);

  assert.equal(await handlers.get("compact-window:set-always-on-top")({ role: "application" }, false), true);
  assert.equal(win.alwaysOnTop, false);
  assert.equal(await handlers.get("compact-window:close")({ role: "application" }), true);
  assert.equal(win.isDestroyed(), true);
});

test("wires portrait controls to primary or portrait application windows only", () => {
  const source = fs.readFileSync(path.resolve("electron", "main.cjs"), "utf8");

  assert.match(source, /function isApplicationWindowEvent\(event\)/);
  assert.match(source, /win === primaryWindowRegistry\.get\(\)/);
  assert.match(source, /compactWindowService\?\.ownsWindow\(win\)/);
  assert.match(source, /canControl: isApplicationWindowEvent/);
});
