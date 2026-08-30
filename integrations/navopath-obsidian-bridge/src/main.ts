import { Notice, Platform, Plugin, PluginSettingTab, requestUrl, SecretComponent, Setting, TFile } from "obsidian";
import { detectManifestChanges, eventDedupeKey, isPathWatched, isValidDeviceToken, normalizeVaultPath, schedulingExcerpt, sha256Hex, type BridgeManifest, type DetectedChange, type ManifestEntry } from "./change-utils.ts";

type BridgeSettings = {
  watchedRoot: string;
  endpoint: string;
  secretName: string;
  debounceSeconds: number;
};

type StoredData = {
  settings: BridgeSettings;
  manifest: BridgeManifest;
};

const DEFAULT_SETTINGS: BridgeSettings = {
  watchedRoot: "升学/资料",
  endpoint: "https://navopath-mcp.shawn89890916.workers.dev/api/workspace-events",
  secretName: "",
  debounceSeconds: 45,
};

const TEXT_EXTENSIONS = new Set(["md", "txt", "csv", "json", "yaml", "yml", "html", "htm", "py"]);
const MAX_HASH_BYTES = 16 * 1024 * 1024;
const DEVICE_SECRET_NAME = "navopath-obsidian-bridge-device-token";
const DESKTOP_BOOTSTRAP_FILENAME = "navopath-obsidian-bridge.token";

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacSignature(secret: string, value: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

export default class NavoPathBridgePlugin extends Plugin {
  private data: StoredData = { settings: { ...DEFAULT_SETTINGS }, manifest: {} };
  private pendingPaths = new Set<string>();
  private flushTimer: number | null = null;
  private flushing = false;
  private statusEl: HTMLElement | null = null;
  private warnedMissingSecret = false;

  async onload() {
    const stored = (await this.loadData()) as Partial<StoredData> | null;
    this.data = {
      settings: { ...DEFAULT_SETTINGS, ...(stored?.settings || {}) },
      manifest: stored?.manifest && typeof stored.manifest === "object" ? stored.manifest : {},
    };
    await this.importDesktopBootstrapSecret();
    this.statusEl = this.addStatusBarItem();
    this.setStatus("等待初始化");
    this.addSettingTab(new NavoPathBridgeSettingTab(this));
    this.addCommand({ id: "flush-workspace-changes", name: "发送待处理的资料变化", callback: () => void this.flushNow(true) });

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

  async updateSettings(patch: Partial<BridgeSettings>) {
    this.data.settings = { ...this.data.settings, ...patch };
    await this.saveData(this.data);
  }

  private async importDesktopBootstrapSecret() {
    if (!Platform.isDesktopApp || !process.env.LOCALAPPDATA) return;
    const fs = require("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");
    const bootstrapPath = path.join(process.env.LOCALAPPDATA, "NavoPath", DESKTOP_BOOTSTRAP_FILENAME);
    if (!fs.existsSync(bootstrapPath)) return;

    try {
      const token = fs.readFileSync(bootstrapPath, "utf8").trim();
      if (!isValidDeviceToken(token)) {
        new Notice("NavoPath Bridge 的一次性设备令牌无效，未导入。");
        return;
      }
      this.app.secretStorage.setSecret(DEVICE_SECRET_NAME, token);
      this.data.settings.secretName = DEVICE_SECRET_NAME;
      await this.saveData(this.data);
      new Notice("NavoPath Bridge 已安全导入设备令牌。");
    } finally {
      fs.rmSync(bootstrapPath, { force: true });
    }
  }

  private setStatus(value: string) {
    if (this.statusEl) this.statusEl.setText(`NavoPath：${value}`);
  }

  private queuePath(path: string) {
    const normalized = normalizeVaultPath(path);
    const root = this.data.settings.watchedRoot;
    const wasTracked = Object.keys(this.data.manifest).some((item) => item === normalized || item.startsWith(`${normalized}/`));
    if (!isPathWatched(normalized, root) && !wasTracked) return;
    this.pendingPaths.add(normalized);
    this.setStatus(`${this.pendingPaths.size} 项变化待发送`);
    if (this.flushTimer !== null) window.clearTimeout(this.flushTimer);
    this.flushTimer = window.setTimeout(() => void this.flushNow(false), Math.max(5, this.data.settings.debounceSeconds) * 1000);
  }

  private async bootstrap() {
    const current = await this.scanManifest();
    if (Object.keys(this.data.manifest).length === 0) {
      this.data.manifest = current;
      await this.saveData(this.data);
      this.setStatus(`基线已建立（${Object.keys(current).length} 个文件）`);
      new Notice(`NavoPath Bridge 已建立 ${Object.keys(current).length} 个文件的隐私基线；今后只发送变化。`);
      return;
    }
    const missed = detectManifestChanges(this.data.manifest, current);
    missed.forEach((change) => this.pendingPaths.add(change.path));
    if (missed.length) {
      this.setStatus(`发现 ${missed.length} 项离线变化`);
      await this.flushNow(false);
    } else {
      this.setStatus("监听中");
    }
  }

  private watchedFiles() {
    return this.app.vault.getFiles().filter((file) => isPathWatched(file.path, this.data.settings.watchedRoot));
  }

  private async fileEntry(file: TFile): Promise<ManifestEntry> {
    const hash = file.stat.size <= MAX_HASH_BYTES
      ? await sha256Hex(await this.app.vault.readBinary(file))
      : await sha256Hex(`${file.stat.mtime}:${file.stat.size}:${file.path}`);
    return { hash, mtime: file.stat.mtime, size: file.stat.size };
  }

  private async scanManifest() {
    const entries = await Promise.all(this.watchedFiles().map(async (file) => [normalizeVaultPath(file.path), await this.fileEntry(file)] as const));
    return Object.fromEntries(entries) as BridgeManifest;
  }

  private expandPendingPaths() {
    const paths = new Set<string>();
    const currentPaths = this.watchedFiles().map((file) => normalizeVaultPath(file.path));
    for (const pending of this.pendingPaths) {
      const descendants = [...currentPaths, ...Object.keys(this.data.manifest)].filter((path) => path === pending || path.startsWith(`${pending}/`));
      if (descendants.length) descendants.forEach((path) => paths.add(path));
      else paths.add(pending);
    }
    return [...paths];
  }

  private async changesFor(paths: string[]) {
    const current: BridgeManifest = {};
    for (const path of paths) {
      const file = this.app.vault.getFileByPath(path);
      if (file) current[path] = await this.fileEntry(file);
    }
    const previous = Object.fromEntries(paths.flatMap((path) => this.data.manifest[path] ? [[path, this.data.manifest[path]]] : []));
    return detectManifestChanges(previous, current);
  }

  private async fragmentFor(change: DetectedChange) {
    if (!change.current) return null;
    const file = this.app.vault.getFileByPath(change.path);
    if (!file || !TEXT_EXTENSIONS.has(file.extension.toLowerCase())) return null;
    const excerpt = schedulingExcerpt(await this.app.vault.cachedRead(file));
    return excerpt ? { path: change.path, excerpt, content_hash: `sha256:${change.current.hash}` } : null;
  }

  async flushNow(showNotice: boolean) {
    if (this.flushing) return;
    if (this.flushTimer !== null) {
      window.clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    const secretName = this.data.settings.secretName;
    const token = secretName ? this.app.secretStorage.getSecret(secretName) : null;
    if (!token) {
      this.setStatus("需要在设置中选择设备令牌");
      if (showNotice || !this.warnedMissingSecret) new Notice("请在 NavoPath Bridge 设置中创建或选择一个 nvp_ 设备令牌。");
      this.warnedMissingSecret = true;
      return;
    }

    this.flushing = true;
    try {
      const changes = await this.changesFor(this.expandPendingPaths());
      if (!changes.length) {
        this.pendingPaths.clear();
        this.setStatus("监听中");
        if (showNotice) new Notice("没有待发送的资料变化。");
        return;
      }

      for (let offset = 0; offset < changes.length; offset += 100) {
        const batch = changes.slice(offset, offset + 100);
        const fragmentCandidates = (await Promise.all(batch.slice(0, 20).map((change) => this.fragmentFor(change)))).filter((item): item is NonNullable<typeof item> => Boolean(item));
        const timestamp = new Date().toISOString();
        const body = JSON.stringify({
          changed_files: batch.map((change) => ({ path: change.path, change_type: change.changeType, content_hash: `sha256:${change.current?.hash || change.previous?.hash || "deleted"}` })),
          fragments: fragmentCandidates,
          summary: `Obsidian Vault 的「${this.data.settings.watchedRoot}」检测到 ${batch.length} 个增量变化。`,
          schedule_impact: fragmentCandidates.length ? "请仅根据所附日期、截止、待办或计划片段判断是否影响 NavoPath 日程。" : "当前只包含文件名和内容哈希；除非文件名明确表示截止风险，否则不要调整日程。",
          timestamp,
          dedupe_key: await eventDedupeKey(batch),
        });
        const unixSeconds = String(Math.floor(Date.now() / 1000));
        const signature = await hmacSignature(token, `${unixSeconds}.${body}`);
        const response = await requestUrl({
          url: this.data.settings.endpoint,
          method: "POST",
          contentType: "application/json",
          headers: {
            Authorization: `Bearer ${token}`,
            "X-NavoPath-Timestamp": unixSeconds,
            "X-NavoPath-Signature": `sha256=${signature}`,
          },
          body,
          throw: false,
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
      this.setStatus("最近变化已发送");
      if (showNotice) new Notice(`已向 NavoPath 发送 ${changes.length} 个增量变化。`);
    } catch (error) {
      console.error("NavoPath Bridge upload failed", error);
      this.setStatus("发送失败，将自动重试");
      if (showNotice) new Notice("资料变化发送失败；本地基线未推进，下次会自动重试。");
      this.flushTimer = window.setTimeout(() => void this.flushNow(false), 60_000);
    } finally {
      this.flushing = false;
    }
  }
}

class NavoPathBridgeSettingTab extends PluginSettingTab {
  constructor(plugin: NavoPathBridgePlugin) {
    super(plugin.app, plugin);
    this.plugin = plugin;
  }

  plugin: NavoPathBridgePlugin;

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "NavoPath Bridge" });
    containerEl.createEl("p", { text: "只监听指定目录，并向 NavoPath 上传变化清单、哈希和有限的日程相关片段。首次启动只建立基线。" });

    new Setting(containerEl)
      .setName("监听目录")
      .setDesc("使用 Vault 内的相对路径；不要填写 C:\\ 绝对路径。")
      .addText((text) => text.setValue(this.plugin.bridgeSettings().watchedRoot).onChange(async (value) => this.plugin.updateSettings({ watchedRoot: normalizeVaultPath(value) })));

    new Setting(containerEl)
      .setName("NavoPath 设备令牌")
      .setDesc("创建或选择一个仅用于此设备的 nvp_ 令牌。令牌由 Obsidian SecretStorage 保存，不进入插件 data.json。")
      .addComponent((element) => new SecretComponent(this.app, element)
        .setValue(this.plugin.bridgeSettings().secretName)
        .onChange(async (value) => this.plugin.updateSettings({ secretName: value })));

    new Setting(containerEl)
      .setName("合并等待时间")
      .setDesc("连续保存会在此时间内合并为一次事件。")
      .addSlider((slider) => slider.setLimits(15, 120, 15).setDynamicTooltip().setValue(this.plugin.bridgeSettings().debounceSeconds).onChange(async (value) => this.plugin.updateSettings({ debounceSeconds: value })));

    new Setting(containerEl)
      .setName("立即发送")
      .setDesc("发送已经检测到但尚未上传的增量变化。")
      .addButton((button) => button.setButtonText("发送待处理变化").setCta().onClick(() => void this.plugin.flushNow(true)));
  }
}
