import { describe, expect, it } from "vitest";
import type { Task } from "../types";
import { matchesLevelFilter, normalizeNullableLevel, normalizeTaskCheckTone, normalizeTaskState, taskMetaPatch, validateProjectCompletion } from "./productivityModel";

const baseTask: Task = {
  id: "task-1",
  title: "Task",
  dueDate: "2026-07-01",
  category: "personal",
  priority: null,
  notes: "",
  goalId: "",
  completed: false,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};

describe("productivity model", () => {
  it("keeps empty levels as first-class filterable values", () => {
    expect(normalizeNullableLevel(undefined)).toBeNull();
    expect(normalizeNullableLevel(null)).toBeNull();
    expect(normalizeNullableLevel("high")).toBe("high");
    expect(normalizeNullableLevel("bad", "low")).toBe("low");
    expect(matchesLevelFilter(null, "empty")).toBe(true);
    expect(matchesLevelFilter("medium", "empty")).toBe(false);
    expect(matchesLevelFilter("medium", "medium")).toBe(true);
  });

  it("normalizes task display state for icons", () => {
    expect(normalizeTaskState({ ...baseTask }).workflow).toBe("backlog");
    expect(normalizeTaskState({ ...baseTask, workflowStatus: "doing" }).workflow).toBe("doing");
    expect(normalizeTaskState({ ...baseTask, completed: true }).workflow).toBe("done");
    expect(normalizeTaskState({ ...baseTask, urgency: undefined }).urgency).toBe("low");
  });

  it("marks important or urgent tasks for attention checkboxes", () => {
    expect(normalizeTaskCheckTone(baseTask)).toBe("muted");
    expect(normalizeTaskCheckTone({ ...baseTask, importance: "high" })).toBe("attention");
    expect(normalizeTaskCheckTone({ ...baseTask, urgency: "high" })).toBe("attention");
    expect(normalizeTaskCheckTone({ ...baseTask, importance: "medium", urgency: "medium" })).toBe("muted");
  });

  it("builds task setting patches for importance and urgency controls", () => {
    expect(taskMetaPatch("importance", "high")).toEqual({ importance: "high" });
    expect(taskMetaPatch("importance", "")).toEqual({ importance: null });
    expect(taskMetaPatch("urgency", "medium")).toEqual({ urgency: "medium" });
    expect(taskMetaPatch("urgency", "")).toEqual({ urgency: "low" });
  });

  it("blocks project completion while child tasks remain open", () => {
    expect(validateProjectCompletion("project-1", [{ ...baseTask, projectId: "project-1" }])).toEqual({
      ok: false,
      openTasks: [{ ...baseTask, projectId: "project-1" }],
    });
    expect(validateProjectCompletion("project-1", [{ ...baseTask, projectId: "project-1", completed: true }])).toEqual({ ok: true });
  });
});
