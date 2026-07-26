import { describe, expect, it } from "vitest";
import { buildPlannerBackupJson, buildTasksCsv, parseTaskCsvRows, parseTasksCsv } from "./dataExport";
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
