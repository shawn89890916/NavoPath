"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => NavoPathBridgePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");

// src/change-utils.ts
var SCHEDULE_LINE = /(?:\b(?:due|deadline|submit|submission|exam|test|interview|schedule|todo)\b|截止|提交|考试|模考|面试|申请|日期|时间|待办|计划|ddl|\b20\d{2}[-/.年]\d{1,2}(?:[-/.月]\d{1,2}日?)?|\b\d{1,2}:\d{2}\b|- \[ \])/i;
function normalizeVaultPath(path) {
  return path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}
function isPathWatched(path, watchedRoot) {
  const normalizedPath = normalizeVaultPath(path);
  const normalizedRoot = normalizeVaultPath(watchedRoot);
  return Boolean(normalizedRoot) && (normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`));
}
function detectManifestChanges(previous, current) {
  const paths = /* @__PURE__ */ new Set([...Object.keys(previous), ...Object.keys(current)]);
  const changes = [];
  for (const path of [...paths].sort()) {
    const before = previous[path];
    const after = current[path];
    if (!after && before) changes.push({ path, changeType: "deleted", previous: before });
    else if (after && !before) changes.push({ path, changeType: "created", current: after });
    if (after && before && (after.hash !== before.hash || after.size !== before.size)) {
      changes.push({ path, changeType: "modified", previous: before, current: after });
    }
  }
  return changes;
}
function schedulingExcerpt(content, maxChars = 3600) {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const selected = [];
  if (lines[0]?.trim() === "---") {
    const closing = lines.slice(1, 80).findIndex((line) => line.trim() === "---");
    if (closing >= 0) selected.push(...lines.slice(0, closing + 2));
  }
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && SCHEDULE_LINE.test(trimmed) && !selected.includes(line)) selected.push(line);
    if (selected.join("\n").length >= maxChars) break;
  }
  const excerpt = selected.length ? selected.join("\n") : normalized.slice(0, Math.min(800, maxChars));
  return excerpt.slice(0, maxChars).trim();
}
async function sha256Hex(value) {
  const input = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function eventDedupeKey(changes) {
  const canonical = changes.map((change) => `${change.changeType}:${normalizeVaultPath(change.path)}:${change.current?.hash || change.previous?.hash || "none"}:${change.current?.mtime || change.previous?.mtime || 0}`).sort().join("\n");
  return `obsidian-${await sha256Hex(canonical)}`;
}

// src/main.ts
var DEFAULT_SETTINGS = {
  watchedRoot: "\u5347\u5B66/\u8D44\u6599",
  endpoint: "https://navopath-mcp.shawn89890916.workers.dev/api/workspace-events",
  secretName: "",
  debounceSeconds: 45
};
var TEXT_EXTENSIONS = /* @__PURE__ */ new Set(["md", "txt", "csv", "json", "yaml", "yml", "html", "htm", "py"]);
var MAX_HASH_BYTES = 16 * 1024 * 1024;
function hex(bytes) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function hmacSignature(secret, value) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}
var NavoPathBridgePlugin = class extends import_obsidian.Plugin {
  data = { settings: { ...DEFAULT_SETTINGS }, manifest: {} };
  pendingPaths = /* @__PURE__ */ new Set();
  flushTimer = null;
  flushing = false;
  statusEl = null;
  warnedMissingSecret = false;
  async onload() {
    const stored = await this.loadData();
    this.data = {
      settings: { ...DEFAULT_SETTINGS, ...stored?.settings || {} },
      manifest: stored?.manifest && typeof stored.manifest === "object" ? stored.manifest : {}
    };
    this.statusEl = this.addStatusBarItem();
    this.setStatus("\u7B49\u5F85\u521D\u59CB\u5316");
    this.addSettingTab(new NavoPathBridgeSettingTab(this));
    this.addCommand({ id: "flush-workspace-changes", name: "\u53D1\u9001\u5F85\u5904\u7406\u7684\u8D44\u6599\u53D8\u5316", callback: () => void this.flushNow(true) });
    this.app.workspace.onLayoutReady(() => {
      this.registerEvent(this.app.vault.on("create", (file) => this.queuePath(file.path)));
      this.registerEvent(this.app.vault.on("modify", (file) => this.queuePath(file.path)));
      this.registerEvent(this.app.vault.on("delete", (file) => this.queuePath(file.path)));
      this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
        this.queuePath(oldPath);
        this.queuePath(file.path);
      }));
      void this.bootstrap();
    });
  }
  onunload() {
    if (this.flushTimer !== null) window.clearTimeout(this.flushTimer);
  }
  bridgeSettings() {
    return this.data.settings;
  }
  async updateSettings(patch) {
    this.data.settings = { ...this.data.settings, ...patch };
    await this.saveData(this.data);
  }
  setStatus(value) {
    if (this.statusEl) this.statusEl.setText(`NavoPath\uFF1A${value}`);
  }
  queuePath(path) {
    const normalized = normalizeVaultPath(path);
    const root = this.data.settings.watchedRoot;
    const wasTracked = Object.keys(this.data.manifest).some((item) => item === normalized || item.startsWith(`${normalized}/`));
    if (!isPathWatched(normalized, root) && !wasTracked) return;
    this.pendingPaths.add(normalized);
    this.setStatus(`${this.pendingPaths.size} \u9879\u53D8\u5316\u5F85\u53D1\u9001`);
    if (this.flushTimer !== null) window.clearTimeout(this.flushTimer);
    this.flushTimer = window.setTimeout(() => void this.flushNow(false), Math.max(5, this.data.settings.debounceSeconds) * 1e3);
  }
  async bootstrap() {
    const current = await this.scanManifest();
    if (Object.keys(this.data.manifest).length === 0) {
      this.data.manifest = current;
      await this.saveData(this.data);
      this.setStatus(`\u57FA\u7EBF\u5DF2\u5EFA\u7ACB\uFF08${Object.keys(current).length} \u4E2A\u6587\u4EF6\uFF09`);
      new import_obsidian.Notice(`NavoPath Bridge \u5DF2\u5EFA\u7ACB ${Object.keys(current).length} \u4E2A\u6587\u4EF6\u7684\u9690\u79C1\u57FA\u7EBF\uFF1B\u4ECA\u540E\u53EA\u53D1\u9001\u53D8\u5316\u3002`);
      return;
    }
    const missed = detectManifestChanges(this.data.manifest, current);
    missed.forEach((change) => this.pendingPaths.add(change.path));
    if (missed.length) {
      this.setStatus(`\u53D1\u73B0 ${missed.length} \u9879\u79BB\u7EBF\u53D8\u5316`);
      await this.flushNow(false);
    } else {
      this.setStatus("\u76D1\u542C\u4E2D");
    }
  }
  watchedFiles() {
    return this.app.vault.getFiles().filter((file) => isPathWatched(file.path, this.data.settings.watchedRoot));
  }
  async fileEntry(file) {
    const hash = file.stat.size <= MAX_HASH_BYTES ? await sha256Hex(await this.app.vault.readBinary(file)) : await sha256Hex(`${file.stat.mtime}:${file.stat.size}:${file.path}`);
    return { hash, mtime: file.stat.mtime, size: file.stat.size };
  }
  async scanManifest() {
    const entries = await Promise.all(this.watchedFiles().map(async (file) => [normalizeVaultPath(file.path), await this.fileEntry(file)]));
    return Object.fromEntries(entries);
  }
  expandPendingPaths() {
    const paths = /* @__PURE__ */ new Set();
    const currentPaths = this.watchedFiles().map((file) => normalizeVaultPath(file.path));
    for (const pending of this.pendingPaths) {
      const descendants = [...currentPaths, ...Object.keys(this.data.manifest)].filter((path) => path === pending || path.startsWith(`${pending}/`));
      if (descendants.length) descendants.forEach((path) => paths.add(path));
      else paths.add(pending);
    }
    return [...paths];
  }
  async changesFor(paths) {
    const current = {};
    for (const path of paths) {
      const file = this.app.vault.getFileByPath(path);
      if (file) current[path] = await this.fileEntry(file);
    }
    const previous = Object.fromEntries(paths.flatMap((path) => this.data.manifest[path] ? [[path, this.data.manifest[path]]] : []));
    return detectManifestChanges(previous, current);
  }
  async fragmentFor(change) {
    if (!change.current) return null;
    const file = this.app.vault.getFileByPath(change.path);
    if (!file || !TEXT_EXTENSIONS.has(file.extension.toLowerCase())) return null;
    const excerpt = schedulingExcerpt(await this.app.vault.cachedRead(file));
    return excerpt ? { path: change.path, excerpt, content_hash: `sha256:${change.current.hash}` } : null;
  }
  async flushNow(showNotice) {
    if (this.flushing) return;
    if (this.flushTimer !== null) {
      window.clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    const secretName = this.data.settings.secretName;
    const token = secretName ? this.app.secretStorage.getSecret(secretName) : null;
    if (!token) {
      this.setStatus("\u9700\u8981\u5728\u8BBE\u7F6E\u4E2D\u9009\u62E9\u8BBE\u5907\u4EE4\u724C");
      if (showNotice || !this.warnedMissingSecret) new import_obsidian.Notice("\u8BF7\u5728 NavoPath Bridge \u8BBE\u7F6E\u4E2D\u521B\u5EFA\u6216\u9009\u62E9\u4E00\u4E2A nvp_ \u8BBE\u5907\u4EE4\u724C\u3002");
      this.warnedMissingSecret = true;
      return;
    }
    this.flushing = true;
    try {
      const changes = await this.changesFor(this.expandPendingPaths());
      if (!changes.length) {
        this.pendingPaths.clear();
        this.setStatus("\u76D1\u542C\u4E2D");
        if (showNotice) new import_obsidian.Notice("\u6CA1\u6709\u5F85\u53D1\u9001\u7684\u8D44\u6599\u53D8\u5316\u3002");
        return;
      }
      for (let offset = 0; offset < changes.length; offset += 100) {
        const batch = changes.slice(offset, offset + 100);
        const fragmentCandidates = (await Promise.all(batch.slice(0, 20).map((change) => this.fragmentFor(change)))).filter((item) => Boolean(item));
        const timestamp = (/* @__PURE__ */ new Date()).toISOString();
        const body = JSON.stringify({
          changed_files: batch.map((change) => ({ path: change.path, change_type: change.changeType, content_hash: `sha256:${change.current?.hash || change.previous?.hash || "deleted"}` })),
          fragments: fragmentCandidates,
          summary: `Obsidian Vault \u7684\u300C${this.data.settings.watchedRoot}\u300D\u68C0\u6D4B\u5230 ${batch.length} \u4E2A\u589E\u91CF\u53D8\u5316\u3002`,
          schedule_impact: fragmentCandidates.length ? "\u8BF7\u4EC5\u6839\u636E\u6240\u9644\u65E5\u671F\u3001\u622A\u6B62\u3001\u5F85\u529E\u6216\u8BA1\u5212\u7247\u6BB5\u5224\u65AD\u662F\u5426\u5F71\u54CD NavoPath \u65E5\u7A0B\u3002" : "\u5F53\u524D\u53EA\u5305\u542B\u6587\u4EF6\u540D\u548C\u5185\u5BB9\u54C8\u5E0C\uFF1B\u9664\u975E\u6587\u4EF6\u540D\u660E\u786E\u8868\u793A\u622A\u6B62\u98CE\u9669\uFF0C\u5426\u5219\u4E0D\u8981\u8C03\u6574\u65E5\u7A0B\u3002",
          timestamp,
          dedupe_key: await eventDedupeKey(batch)
        });
        const unixSeconds = String(Math.floor(Date.now() / 1e3));
        const signature = await hmacSignature(token, `${unixSeconds}.${body}`);
        const response = await (0, import_obsidian.requestUrl)({
          url: this.data.settings.endpoint,
          method: "POST",
          contentType: "application/json",
          headers: {
            Authorization: `Bearer ${token}`,
            "X-NavoPath-Timestamp": unixSeconds,
            "X-NavoPath-Signature": `sha256=${signature}`
          },
          body,
          throw: false
        });
        if (response.status < 200 || response.status >= 300) throw new Error(`workspace event rejected (${response.status})`);
        for (const change of batch) {
          if (change.current) this.data.manifest[change.path] = change.current;
          else delete this.data.manifest[change.path];
          this.pendingPaths.delete(change.path);
        }
        await this.saveData(this.data);
      }
      this.warnedMissingSecret = false;
      this.setStatus("\u6700\u8FD1\u53D8\u5316\u5DF2\u53D1\u9001");
      if (showNotice) new import_obsidian.Notice(`\u5DF2\u5411 NavoPath \u53D1\u9001 ${changes.length} \u4E2A\u589E\u91CF\u53D8\u5316\u3002`);
    } catch (error) {
      console.error("NavoPath Bridge upload failed", error);
      this.setStatus("\u53D1\u9001\u5931\u8D25\uFF0C\u5C06\u81EA\u52A8\u91CD\u8BD5");
      if (showNotice) new import_obsidian.Notice("\u8D44\u6599\u53D8\u5316\u53D1\u9001\u5931\u8D25\uFF1B\u672C\u5730\u57FA\u7EBF\u672A\u63A8\u8FDB\uFF0C\u4E0B\u6B21\u4F1A\u81EA\u52A8\u91CD\u8BD5\u3002");
      this.flushTimer = window.setTimeout(() => void this.flushNow(false), 6e4);
    } finally {
      this.flushing = false;
    }
  }
};
var NavoPathBridgeSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(plugin) {
    super(plugin.app, plugin);
    this.plugin = plugin;
  }
  plugin;
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "NavoPath Bridge" });
    containerEl.createEl("p", { text: "\u53EA\u76D1\u542C\u6307\u5B9A\u76EE\u5F55\uFF0C\u5E76\u5411 NavoPath \u4E0A\u4F20\u53D8\u5316\u6E05\u5355\u3001\u54C8\u5E0C\u548C\u6709\u9650\u7684\u65E5\u7A0B\u76F8\u5173\u7247\u6BB5\u3002\u9996\u6B21\u542F\u52A8\u53EA\u5EFA\u7ACB\u57FA\u7EBF\u3002" });
    new import_obsidian.Setting(containerEl).setName("\u76D1\u542C\u76EE\u5F55").setDesc("\u4F7F\u7528 Vault \u5185\u7684\u76F8\u5BF9\u8DEF\u5F84\uFF1B\u4E0D\u8981\u586B\u5199 C:\\ \u7EDD\u5BF9\u8DEF\u5F84\u3002").addText((text) => text.setValue(this.plugin.bridgeSettings().watchedRoot).onChange(async (value) => this.plugin.updateSettings({ watchedRoot: normalizeVaultPath(value) })));
    new import_obsidian.Setting(containerEl).setName("NavoPath \u8BBE\u5907\u4EE4\u724C").setDesc("\u521B\u5EFA\u6216\u9009\u62E9\u4E00\u4E2A\u4EC5\u7528\u4E8E\u6B64\u8BBE\u5907\u7684 nvp_ \u4EE4\u724C\u3002\u4EE4\u724C\u7531 Obsidian SecretStorage \u4FDD\u5B58\uFF0C\u4E0D\u8FDB\u5165\u63D2\u4EF6 data.json\u3002").addComponent((element) => new import_obsidian.SecretComponent(this.app, element).setValue(this.plugin.bridgeSettings().secretName).onChange(async (value) => this.plugin.updateSettings({ secretName: value })));
    new import_obsidian.Setting(containerEl).setName("\u5408\u5E76\u7B49\u5F85\u65F6\u95F4").setDesc("\u8FDE\u7EED\u4FDD\u5B58\u4F1A\u5728\u6B64\u65F6\u95F4\u5185\u5408\u5E76\u4E3A\u4E00\u6B21\u4E8B\u4EF6\u3002").addSlider((slider) => slider.setLimits(15, 120, 15).setDynamicTooltip().setValue(this.plugin.bridgeSettings().debounceSeconds).onChange(async (value) => this.plugin.updateSettings({ debounceSeconds: value })));
    new import_obsidian.Setting(containerEl).setName("\u7ACB\u5373\u53D1\u9001").setDesc("\u53D1\u9001\u5DF2\u7ECF\u68C0\u6D4B\u5230\u4F46\u5C1A\u672A\u4E0A\u4F20\u7684\u589E\u91CF\u53D8\u5316\u3002").addButton((button) => button.setButtonText("\u53D1\u9001\u5F85\u5904\u7406\u53D8\u5316").setCta().onClick(() => void this.plugin.flushNow(true)));
  }
};
