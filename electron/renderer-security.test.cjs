const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
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

test("does not expose or execute external plugin scripts", () => {
  const preloadSource = fs.readFileSync(path.resolve("electron", "preload.cjs"), "utf8");
  const electronMainSource = fs.readFileSync(path.resolve("electron", "main.cjs"), "utf8");
  const rendererSource = fs.readFileSync(path.resolve("src", "main.tsx"), "utf8");

  assert.doesNotMatch(preloadSource, /readExternalPluginEntry|plugins:readExternalEntry/);
  assert.doesNotMatch(electronMainSource, /readExternalPluginEntry|plugins:readExternalEntry/);
  assert.doesNotMatch(rendererSource, /new Function\("window",\s*"navopath"/);
  assert.match(electronMainSource, /not external scripts/);
});

test("never falls back to reversible plaintext authentication storage", () => {
  const electronMainSource = fs.readFileSync(path.resolve("electron", "main.cjs"), "utf8");

  assert.doesNotMatch(electronMainSource, /stored\[key\]\s*=\s*`plain:/);
  assert.match(electronMainSource, /if \(!safeStorage\.isEncryptionAvailable\(\)\)/);
  assert.match(electronMainSource, /stored\[key\]\s*=\s*`safe:/);
});
