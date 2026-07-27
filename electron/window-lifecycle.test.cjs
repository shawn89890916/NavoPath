const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  broadcastToLiveWindows,
  createPrimaryWindowRegistry,
} = require("./window-lifecycle.cjs");

function fakeWindow(options = {}) {
  const calls = [];
  const webContents = {
    isDestroyed: () => options.webContentsDestroyed === true,
    send: (...args) => {
      if (options.sendThrows) throw new Error("send failed");
      calls.push(["send", ...args]);
    },
  };
  return {
    calls,
    webContents,
    isDestroyed: () => options.destroyed === true,
    isMinimized: () => options.minimized === true,
    restore: () => calls.push(["restore"]),
    show: () => calls.push(["show"]),
    focus: () => calls.push(["focus"]),
  };
}

test("tracks the primary window independently from BrowserWindow list order", () => {
  const registry = createPrimaryWindowRegistry();
  const main = fakeWindow();
  const other = fakeWindow();

  assert.equal(registry.get(), null);
  registry.set(main);
  assert.equal(registry.get(), main);
  registry.clear(other);
  assert.equal(registry.get(), main);
  registry.clear(main);
  assert.equal(registry.get(), null);
});

test("drops destroyed primary references and restores the live primary window", () => {
  const registry = createPrimaryWindowRegistry();
  const destroyed = fakeWindow({ destroyed: true });
  const minimized = fakeWindow({ minimized: true });

  registry.set(destroyed);
  assert.equal(registry.get(), null);
  registry.set(minimized);
  assert.equal(registry.show(), minimized);
  assert.deepEqual(minimized.calls, [["restore"], ["show"], ["focus"]]);
});

test("broadcasts only to live windows and tolerates a concurrent send failure", () => {
  const live = fakeWindow();
  const destroyed = fakeWindow({ destroyed: true });
  const destroyedContents = fakeWindow({ webContentsDestroyed: true });
  const throwing = fakeWindow({ sendThrows: true });

  assert.doesNotThrow(() => broadcastToLiveWindows(
    [destroyed, live, destroyedContents, throwing],
    "updater:state",
    { status: "current" },
  ));
  assert.deepEqual(live.calls, [["send", "updater:state", { status: "current" }]]);
  assert.deepEqual(destroyed.calls, []);
  assert.deepEqual(destroyedContents.calls, []);
});

test("uses the primary registry for desktop lifecycle actions and safe update broadcasts", () => {
  const source = fs.readFileSync(path.resolve("electron", "main.cjs"), "utf8");
  assert.doesNotMatch(source, /BrowserWindow\.getAllWindows\(\)\[0\]/);
  assert.match(source, /broadcastToLiveWindows\(BrowserWindow\.getAllWindows\(\), "updater:state", updateState\)/);
  assert.match(source, /primaryWindowRegistry\.set\(win\)/);
  assert.match(source, /primaryWindowRegistry\.clear\(win\)/);
  assert.match(source, /click: \(\) => showMainWindow\(\)/);
});
