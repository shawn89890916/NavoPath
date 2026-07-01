import { describe, expect, it } from "vitest";
import type { Task } from "../types";
import { buildTaskMetaBadges } from "./taskMetaBadges";

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

describe("task meta badges", () => {
  it("uses explicit empty importance with default low urgency and backlog status", () => {
    expect(buildTaskMetaBadges(baseTask, "zh")).toEqual([
      { key: "status", label: "未开始", className: "df-task-meta-badge status-backlog" },
      { key: "importance", label: "空重要", className: "df-task-meta-badge importance-empty" },
      { key: "urgency", label: "不紧急", className: "df-task-meta-badge urgency-low" },
    ]);
  });

  it("uses red high importance and urgency, and green done status", () => {
    expect(buildTaskMetaBadges({ ...baseTask, completed: true, importance: "high", urgency: "high" }, "en")).toEqual([
      { key: "status", label: "Done", className: "df-task-meta-badge status-done" },
      { key: "importance", label: "Important", className: "df-task-meta-badge importance-high" },
      { key: "urgency", label: "Urgent", className: "df-task-meta-badge urgency-high" },
    ]);
  });
});
