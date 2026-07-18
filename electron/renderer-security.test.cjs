const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { createRendererPolicy, resolveDevAppUrl } = require("./renderer-security.cjs");

const localIndexPath = path.resolve("app", "dist", "index.html");
const localIndexUrl = pathToFileURL(localIndexPath).href;

test("accepts only loopback development servers", () => {
  assert.equal(resolveDevAppUrl("http://127.0.0.1:5173", { widget: 1 }).href, "http://127.0.0.1:5173/app?widget=1");
  assert.throws(() => resolveDevAppUrl("https://navopath.example.com"), /loopback/);
  assert.throws(() => resolveDevAppUrl(""), /required/);
});

test("trusts the packaged entry and configured local app route only", () => {
  const policy = createRendererPolicy({
    localIndexPath,
    devServerUrl: "http://localhost:5173",
  });

  assert.equal(policy.isTrustedUrl(`${localIndexUrl}?widget=1`), true);
  assert.equal(policy.isTrustedUrl(pathToFileURL(path.resolve("app", "dist", "other.html")).href), false);
  assert.equal(policy.isTrustedUrl("http://localhost:5173/app?widget=1"), true);
  assert.equal(policy.isTrustedUrl("http://localhost:5173/admin"), false);
  assert.equal(policy.isTrustedUrl("https://navopath.example.com/app"), false);
});

test("rejects IPC calls from navigated or unknown renderers", () => {
  const policy = createRendererPolicy({ localIndexPath });

  assert.doesNotThrow(() => policy.assertTrustedSender({ senderFrame: { url: localIndexUrl } }));
  assert.throws(
    () => policy.assertTrustedSender({ senderFrame: { url: "https://attacker.example/app" } }),
    /untrusted renderer/,
  );
  assert.throws(() => policy.assertTrustedSender(null), /untrusted renderer/);
});

test("blocks untrusted navigation and new windows", () => {
  const events = new Map();
  let windowOpenHandler;
  const external = [];
  const policy = createRendererPolicy({ localIndexPath });
  const win = {
    webContents: {
      on: (name, handler) => events.set(name, handler),
      setWindowOpenHandler: (handler) => { windowOpenHandler = handler; },
    },
  };
  policy.secureWindowNavigation(win, (url) => external.push(url));

  let prevented = false;
  events.get("will-navigate")({ preventDefault: () => { prevented = true; } }, "https://example.com");
  assert.equal(prevented, true);
  assert.deepEqual(windowOpenHandler({ url: "https://example.com" }), { action: "deny" });
  assert.deepEqual(external, ["https://example.com", "https://example.com"]);
});
