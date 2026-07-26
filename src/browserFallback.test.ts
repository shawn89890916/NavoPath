import { describe, expect, it } from "vitest";
import {
  createResilientStorage,
  fallbackData,
  normalizeData,
  parseLocalPreviewData,
  parseLocalPreviewSettings,
  shouldUseLocalPreviewByDefault,
} from "./browserFallback";

describe("browser fallback preview mode", () => {
  it("keeps session writes usable when browser storage is unavailable", () => {
    const storage = createResilientStorage({
      getItem: () => "stale",
      setItem: () => {
        throw new Error("Quota exceeded");
      },
      removeItem: () => {
        throw new Error("Storage blocked");
      },
    });

    expect(storage.getItem("planner")).toBe("stale");
    storage.setItem("planner", "latest");
    expect(storage.getItem("planner")).toBe("latest");
    storage.removeItem("planner");
    expect(storage.getItem("planner")).toBeNull();
  });

  it("defaults localhost dev app routes to local preview unless cloud mode is explicit", () => {
    expect(shouldUseLocalPreviewByDefault("127.0.0.1", "/app", null)).toBe(true);
    expect(shouldUseLocalPreviewByDefault("localhost", "/app", null)).toBe(true);
    expect(shouldUseLocalPreviewByDefault("127.0.0.1", "/app", "cloud")).toBe(false);
    expect(shouldUseLocalPreviewByDefault("navopath.app", "/app", null)).toBe(false);
  });

  it("uses canonical migrations while preserving local preview defaults", () => {
    const settings = parseLocalPreviewSettings(JSON.stringify({
      language: "zh",
      model: "deepseek-chat",
      executeAccentColor: "#C69CF9",
      _apiKey: "1234567890",
    }));

    expect(settings.displayName).toBe("NavoPath Preview");
    expect(settings.panelWidths).toEqual({ left: 310, right: 360 });
    expect(settings.language).toBe("zh");
    expect(settings.model).toBe("deepseek-ai/DeepSeek-V3.2");
    expect(settings.executeAccentColor).toBe("");
    expect(settings.hasApiKey).toBe(false);
    expect(settings.apiKeyPreview).toBe("");
    expect(settings).not.toHaveProperty("_apiKey");
  });

  it("recovers from a corrupt local settings snapshot", () => {
    const settings = parseLocalPreviewSettings("{broken");

    expect(settings.displayName).toBe("NavoPath Preview");
    expect(settings.activeMode).toBe("execute");
    expect(settings.widgetTimerPreferences?.mode).toBe("stopwatch");
  });

  it("scrubs legacy local API key fields", () => {
    const settings = parseLocalPreviewSettings(JSON.stringify({
      _apiKey: "legacy-secret",
      apiKey: "duplicate-secret",
      clearApiKey: true,
      hasApiKey: true,
      apiKeyPreview: "legacy...cret",
    }));

    expect(settings).not.toHaveProperty("_apiKey");
    expect(settings).not.toHaveProperty("apiKey");
    expect(settings).not.toHaveProperty("clearApiKey");
    expect(settings.hasApiKey).toBe(false);
    expect(settings.apiKeyPreview).toBe("");
  });

  it("rejects corrupt planner snapshots and migrates valid legacy snapshots", () => {
    expect(parseLocalPreviewData("{broken")).toBeNull();
    expect(parseLocalPreviewData(JSON.stringify({ projects: [] }))).toBeNull();

    const legacy = fallbackData();
    delete (legacy as Partial<typeof legacy>).aiMemories;
    const parsed = parseLocalPreviewData(JSON.stringify(legacy));

    expect(parsed).not.toBeNull();
    expect(parsed?.tasks.length).toBeGreaterThan(0);
    expect(parsed?.aiMemories).toEqual([]);
  });

  it("drops malformed collection entries without discarding valid planner data", () => {
    const malformed = fallbackData() as any;
    const validTaskCount = malformed.tasks.length;
    const damagedTaskId = malformed.tasks[0].id;
    malformed.projects.push(null, "bad", {});
    malformed.tasks.push(null, 42, { id: "missing-title" });
    malformed.events = [null];
    malformed.notes.push(null);
    malformed.chat = [null, { role: "user", content: "Keep me" }];
    malformed.aiConversations = [{ id: "conversation", title: "Valid", messages: [null] }];
    malformed.aiMemories = [{ id: "memory", content: "Valid", tags: [null, "keep"], sourceMessages: [null] }];
    malformed.scheduleTemplates = [{ id: "template", title: "Valid", slots: [null] }];
    malformed.tasks[0].subtasks = [null, { id: "subtask", title: "Keep", subtasks: [null] }];
    malformed.tasks[0].timelineRecords = [null];

    const normalized = normalizeData(malformed);
    const damagedTask = normalized.tasks.find((task) => task.id === damagedTaskId);

    expect(normalized.tasks).toHaveLength(validTaskCount);
    expect(normalized.projects.every((project) => Boolean(project.id && project.title))).toBe(true);
    expect(normalized.notes).not.toContain(null);
    expect(normalized.chat).toHaveLength(1);
    expect(normalized.aiConversations?.[0].messages).toEqual([]);
    expect(normalized.aiMemories[0].tags).toEqual(["keep"]);
    expect(normalized.scheduleTemplates?.[0].slots).toEqual([]);
    expect(damagedTask?.subtasks).toHaveLength(1);
    expect(damagedTask?.subtasks?.[0].subtasks).toEqual([]);
    expect(damagedTask?.timelineRecords).toEqual([]);
  });
});
