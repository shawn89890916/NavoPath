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
  it("does not expose unfinished, importance, or urgency badges", () => {
    expect(buildTaskMetaBadges({ ...baseTask, importance: "high", urgency: "high" }, "zh")).toEqual([]);
  });

  it("only exposes completed status", () => {
    expect(buildTaskMetaBadges({ ...baseTask, completed: true, importance: "high", urgency: "high" }, "en")).toEqual([
      { key: "status", label: "Done", className: "df-task-meta-badge status-done" },
    ]);
  });
});
