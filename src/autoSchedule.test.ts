import { describe, expect, it } from "vitest";
import { autoScheduleTasks } from "./autoSchedule";

const future = "2099-01-05";

function task(id: string, projectId: string, estimatedMinutes = 45) {
  return { id, title: id, projectId, priority: "medium" as const, estimatedMinutes };
}

describe("autoScheduleTasks", () => {
  it("keeps fixed events as anchors and stays inside the work window", () => {
    const result = autoScheduleTasks({
      tasks: [task("prepare", "study", 60)],
      scheduledEvents: [{ id: "class", title: "Class", date: future, startTime: "09:00", endTime: "10:00" }],
      dateRange: [future],
      settings: { dayStart: "08:00", dayEnd: "12:00", bufferMinutes: 0, allowTaskSplitting: false },
    });
    const proposed = result.proposedEvents[0];
    expect(proposed).toBeDefined();
    expect(proposed.scheduledStart >= "08:00").toBe(true);
    expect(proposed.scheduledEnd <= "12:00").toBe(true);
    expect(proposed.scheduledEnd <= "09:00" || proposed.scheduledStart >= "10:00").toBe(true);
  });

  it("honors the selected ordering strategy", () => {
    const tasks = [task("p1-a", "p1"), task("p2-a", "p2"), task("p1-b", "p1")];
    const common = { tasks, scheduledEvents: [], dateRange: [future], settings: { dayStart: "08:00", dayEnd: "13:00", bufferMinutes: 0 } };
    const grouped = autoScheduleTasks({ ...common, settings: { ...common.settings, strategy: "byProject" } });
    const alternating = autoScheduleTasks({ ...common, settings: { ...common.settings, strategy: "alternativeProject" } });
    expect(grouped.proposedEvents.map((event) => event.taskId)).toEqual(["p1-a", "p1-b", "p2-a"]);
    expect(alternating.proposedEvents.map((event) => event.taskId)).toEqual(["p1-a", "p2-a", "p1-b"]);
  });

  it("offers reviewable segments while preserving total duration", () => {
    const result = autoScheduleTasks({
      tasks: [task("long", "study", 150)],
      scheduledEvents: [
        { id: "anchor-1", title: "Anchor", date: future, startTime: "09:00", endTime: "10:00" },
        { id: "anchor-2", title: "Anchor", date: future, startTime: "11:00", endTime: "12:00" },
      ],
      dateRange: [future],
      settings: { dayStart: "08:00", dayEnd: "13:00", bufferMinutes: 0, allowTaskSplitting: true },
    });
    expect(result.proposedEvents.length).toBeGreaterThan(1);
    expect(result.proposedEvents.reduce((sum, event) => sum + event.durationMinutes, 0)).toBe(150);
    expect(result.proposedEvents.every((event) => event.segmentCount === result.proposedEvents.length)).toBe(true);
  });

  it("does not mutate source tasks during preview generation", () => {
    const tasks = [task("safe", "study")];
    const before = structuredClone(tasks);
    autoScheduleTasks({ tasks, scheduledEvents: [], dateRange: [future] });
    expect(tasks).toEqual(before);
  });
});
