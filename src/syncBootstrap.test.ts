import { describe, expect, it } from "vitest";
import type { PlannerData, Settings } from "./types";
import { parseBootstrapCache, recoverAccountSettings, resolveBootstrap, type BootstrapCache } from "./syncBootstrap";

const data = (savedAt: string, title: string): PlannerData => ({
  version: 2, importedSeedVersion: "test", generatedAt: savedAt, savedAt, goals: [], projects: [], tasks: [{ id: title, title, dueDate: "2026-06-20", category: "personal", priority: "medium", notes: "", goalId: "", completed: false, createdAt: savedAt, updatedAt: savedAt }], longTasks: [], events: [], notes: [], drafts: [], chat: [], aiConversations: [], aiMemories: [], taskLayouts: {},
});
const settings = (language: "en" | "zh"): Settings => ({ language } as Settings);

function cache(overrides: Partial<BootstrapCache> = {}): BootstrapCache {
  return { data: data("2026-06-19T00:00:00Z", "cached"), settings: settings("zh"), ...overrides };
}

describe("resolveBootstrap", () => {
  it("uses the cloud baseline even when a clean cache has a newer timestamp", () => {
    const remote = data("2026-06-18T00:00:00Z", "remote");
    const result = resolveBootstrap(cache(), remote, settings("en"));
    expect(result.data).toBe(remote);
    expect(result.settings?.language).toBe("en");
    expect(result.replayData).toBe(false);
  });

  it("replays only explicitly dirty local data", () => {
    const local = cache({ dataDirty: true });
    const result = resolveBootstrap(local, data("2026-06-20T00:00:00Z", "remote"), settings("en"));
    expect(result.data).toBe(local.data);
    expect(result.settings?.language).toBe("en");
    expect(result.replayData).toBe(true);
  });

  it("replays dirty settings independently from clean data", () => {
    const local = cache({ settingsDirty: true });
    const remote = data("2026-06-20T00:00:00Z", "remote");
    const result = resolveBootstrap(local, remote, settings("en"));
    expect(result.data).toBe(remote);
    expect(result.settings).toBe(local.settings);
    expect(result.replaySettings).toBe(true);
  });

  it("falls back to cache when no cloud bootstrap is available", () => {
    const local = cache({ dataDirty: true, settingsDirty: true });
    const result = resolveBootstrap(local, null, null);
    expect(result.data).toBe(local.data);
    expect(result.settings).toBe(local.settings);
    expect(result.replayData).toBe(false);
    expect(result.replaySettings).toBe(false);
  });

  it("can prefer remote data for an explicit pull even when cache is dirty", () => {
    const local = cache({ dataDirty: true, settingsDirty: true });
    const remote = data("2026-06-21T00:00:00Z", "remote");
    const remoteSettings = settings("en");
    const result = resolveBootstrap(local, remote, remoteSettings, { preferRemote: true });
    expect(result.data).toBe(remote);
    expect(result.settings).toBe(remoteSettings);
    expect(result.replayData).toBe(false);
    expect(result.replaySettings).toBe(false);
  });
});

describe("parseBootstrapCache", () => {
  it("rejects corrupt cache envelopes", () => {
    expect(parseBootstrapCache("{broken")).toBeNull();
    expect(parseBootstrapCache(JSON.stringify({ data: { projects: [] }, settings: {} }))).toBeNull();
  });

  it("normalizes cached data, settings, and replay metadata before use", () => {
    const cachedData = data("2026-06-19T00:00:00Z", "valid") as any;
    cachedData.tasks.push(null);
    cachedData.aiMemories = undefined;
    const parsed = parseBootstrapCache(JSON.stringify({
      data: cachedData,
      settings: { language: "invalid", activeMode: "invalid", theme: "dark" },
      dataDirty: "false",
      settingsDirty: true,
      remoteRevision: "7",
    }));

    expect(parsed?.data.tasks).toHaveLength(1);
    expect(parsed?.data.aiMemories).toEqual([]);
    expect(parsed?.settings.language).toBe("en");
    expect(parsed?.settings.activeMode).toBe("execute");
    expect(parsed?.settings.theme).toBe("dark");
    expect(parsed?.dataDirty).toBe(false);
    expect(parsed?.settingsDirty).toBe(true);
    expect(parsed?.remoteRevision).toBeUndefined();
  });
});

describe("recoverAccountSettings", () => {
  it("restores missing profile fields from a snapshot for the same account", () => {
    const current = { ...settings("zh"), displayName: "NavoPath", avatarDataUrl: "" } as Settings;
    const snapshot = { ...current, displayName: "233cxy", avatarDataUrl: "data:image/jpeg;base64,avatar" };
    const result = recoverAccountSettings(current, snapshot, "user-1", "user-1");

    expect(result.recovered).toBe(true);
    expect(result.settings.displayName).toBe("233cxy");
    expect(result.settings.avatarDataUrl).toBe(snapshot.avatarDataUrl);
  });

  it("does not overwrite current profile fields or cross account boundaries", () => {
    const current = { ...settings("zh"), displayName: "Current", avatarDataUrl: "data:image/jpeg;base64,current" } as Settings;
    const snapshot = { ...current, displayName: "Old", avatarDataUrl: "data:image/jpeg;base64,old" };

    expect(recoverAccountSettings(current, snapshot, "user-1", "user-1")).toEqual({ settings: current, recovered: false });
    expect(recoverAccountSettings({ ...current, displayName: "NavoPath", avatarDataUrl: "" }, snapshot, "user-1", "user-2").recovered).toBe(false);
  });
});
