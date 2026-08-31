import { describe, expect, it } from "vitest";
import { recordGapActivity } from "./proactiveAssistant";
import type { PlannerData, Task } from "./types";

const task: Task = { id: "task-1", title: "Physics", dueDate: "2026-08-31", category: "personal", priority: "medium", notes: "", goalId: "", completed: false, estimatedHours: 1, order: 0, subtasks: [], createdAt: "1", updatedAt: "1" };
const data = (): PlannerData => ({ version: 1, importedSeedVersion: "test", generatedAt: "1", goals: [], projects: [], tasks: [task], longTasks: [], events: [], notes: [], drafts: [], chat: [], aiMemories: [], timeEntries: [] });

describe("proactive gap activity", () => {
  it("logs an existing task without completing it", () => {
    const result = recordGapActivity(data(), { taskId: "task-1", date: "2026-08-31", startTime: "10:00", endTime: "10:45" });
    expect(result.tasks[0].completed).toBe(false);
    expect(result.tasks[0].timelineRecords?.[0].executionStatus).toBe("completed");
    expect(result.timeEntries?.[0]).toMatchObject({ taskId: "task-1", durationMinutes: 45, source: "manual" });
  });

  it("creates a completed historical task when no task is selected", () => {
    const result = recordGapActivity(data(), { newTaskTitle: "整理笔记", date: "2026-08-31", startTime: "11:00", endTime: "11:30" });
    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[1]).toMatchObject({ title: "整理笔记", completed: true });
    expect(result.timeEntries?.[0].taskId).toBe(result.tasks[1].id);
  });
});
