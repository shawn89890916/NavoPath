import { describe, expect, it } from "vitest";
import { buildPlannerBackupJson, buildTasksCsv, parsePlannerBackupJson, parseTaskCsvRows, parseTasksCsv } from "./dataExport";
import type { PlannerData, Project, Settings, Task } from "./types";

function task(id: string, title: string, projectId?: string): Task {
  return {
    id,
    title,
    projectId,
    dueDate: "2026-07-26",
    category: "personal",
    priority: "medium",
    notes: "",
    goalId: "",
    completed: false,
    estimatedHours: 1,
    subtasks: [],
    order: 0,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
  };
}

function plannerData(tasks: Task[], projects: Project[] = []): PlannerData {
  return {
    version: 1,
    importedSeedVersion: "test",
    generatedAt: "2026-07-01T00:00:00.000Z",
    goals: [],
    projects,
    tasks,
    longTasks: [],
    events: [],
    notes: [],
    drafts: [],
    chat: [],
    aiMemories: [],
  };
}

describe("planner backup export", () => {
  it("builds a complete timestamped JSON envelope", () => {
    const data = plannerData([]);
    const settings = { language: "zh" } as Settings;
    const exportedAt = "2026-07-26T10:00:00.000Z";

    expect(JSON.parse(buildPlannerBackupJson(data, settings, exportedAt))).toEqual({
      exportedAt,
      version: 1,
      data,
      settings,
    });
  });

  it("normalizes legacy backups before applying them", () => {
    const legacyData = plannerData([task("task", "Legacy task")]);
    delete (legacyData as Partial<PlannerData>).aiMemories;
    const backup = parsePlannerBackupJson(JSON.stringify({
      data: legacyData,
      settings: {
        language: "zh",
        theme: "dark",
        model: "deepseek-chat",
        executeAccentColor: "#C69CF9",
      },
    }));

    expect(backup.data.aiMemories).toEqual([]);
    expect(backup.data.scheduleTemplates).toEqual([]);
    expect(backup.settings.language).toBe("zh");
    expect(backup.settings.theme).toBe("dark");
    expect(backup.settings.model).toBe("deepseek-ai/DeepSeek-V3.2");
    expect(backup.settings.executeAccentColor).toBe("");
  });

  it("rejects corrupt data and replaces invalid settings with safe defaults", () => {
    expect(() => parsePlannerBackupJson("{broken")).toThrow();
    expect(() => parsePlannerBackupJson(JSON.stringify({
      data: { projects: [] },
      settings: {},
    }))).toThrow("required collections");

    const backup = parsePlannerBackupJson(JSON.stringify({
      data: plannerData([]),
      settings: {
        activeMode: "destroy",
        language: 42,
        syncIntervalMinutes: -5,
        panelWidths: { left: -1, right: "wide" },
        widgetTimerPreferences: { mode: "invalid", focusMinutes: -10 },
      },
    }));
    expect(backup.settings.activeMode).toBe("execute");
    expect(backup.settings.language).toBe("en");
    expect(backup.settings.syncIntervalMinutes).toBe(60);
    expect(backup.settings.panelWidths).toEqual({ left: 360, right: 390 });
    expect(backup.settings.widgetTimerPreferences?.mode).toBe("stopwatch");
    expect(backup.settings.widgetTimerPreferences?.focusMinutes).toBe(25);
  });
});

describe("task CSV export", () => {
  it("round-trips commas, quotes, newlines, and project names", () => {
    const project: Project = {
      id: "project",
      title: 'Project, "A"',
      category: "project",
      notes: "",
      completed: false,
      createdAt: "1",
      updatedAt: "1",
    };
    const data = plannerData([task("task", "Line one,\nLine \"two\"", project.id)], [project]);

    const rows = parseTaskCsvRows(buildTasksCsv(data));

    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Line one,\nLine \"two\"");
    expect(rows[0].projectTitle).toBe('Project, "A"');
    expect(parseTasksCsv(buildTasksCsv(data), [project], "2026-07-26T00:00:00.000Z")[0].projectId).toBe(project.id);
  });

  it("neutralizes spreadsheet formulas while preserving app round-trips", () => {
    const data = plannerData([task("task", "=HYPERLINK(\"https://example.com\")")]);

    const csv = buildTasksCsv(data);

    expect(csv).toContain('"\'=HYPERLINK(""https://example.com"")"');
    expect(parseTaskCsvRows(csv)[0].title).toBe('=HYPERLINK("https://example.com")');
  });
});
