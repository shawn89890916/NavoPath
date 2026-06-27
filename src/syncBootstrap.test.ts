import { describe, expect, it } from "vitest";
import type { PlannerData, Settings } from "./types";
import { resolveBootstrap, type BootstrapCache } from "./syncBootstrap";

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
