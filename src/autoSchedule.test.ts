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

  it("allows a task to end exactly at the planning boundary", () => {
    const result = autoScheduleTasks({
      tasks: [task("exact-fit", "study", 60)],
      scheduledEvents: [],
      dateRange: [future],
      settings: { dayStart: "08:00", dayEnd: "09:00", bufferMinutes: 5, allowTaskSplitting: false },
    });

    expect(result.proposedEvents).toHaveLength(1);
    expect(result.proposedEvents[0]).toMatchObject({
      scheduledStart: "08:00",
      scheduledEnd: "09:00",
    });
    expect(result.unscheduledTasks).toEqual([]);
  });

  it("still keeps the configured buffer between consecutive tasks", () => {
    const result = autoScheduleTasks({
      tasks: [task("first", "study", 55), task("second", "study", 55)],
      scheduledEvents: [],
      dateRange: [future],
      settings: { dayStart: "08:00", dayEnd: "10:00", bufferMinutes: 5, allowTaskSplitting: false },
    });

    expect(result.proposedEvents.map(({ scheduledStart, scheduledEnd }) => ({ scheduledStart, scheduledEnd }))).toEqual([
      { scheduledStart: "08:00", scheduledEnd: "08:55" },
      { scheduledStart: "09:00", scheduledEnd: "09:55" },
    ]);
  });

  it("snaps the next task to the grid after a non-grid buffer", () => {
    const result = autoScheduleTasks({
      tasks: [task("first", "study", 60), task("second", "study", 60)],
      scheduledEvents: [],
      dateRange: [future],
      settings: {
        dayStart: "08:00",
        dayEnd: "11:00",
        snapMinutes: 15,
        bufferMinutes: 5,
        allowTaskSplitting: false,
      },
    });

    expect(result.proposedEvents.map(({ scheduledStart, scheduledEnd }) => ({ scheduledStart, scheduledEnd }))).toEqual([
      { scheduledStart: "08:00", scheduledEnd: "09:00" },
      { scheduledStart: "09:15", scheduledEnd: "10:15" },
    ]);
  });

  it("places project work at its learned preferred start hour", () => {
    const result = autoScheduleTasks({
      tasks: [task("preferred", "study", 60)],
      scheduledEvents: [],
      dateRange: [future],
      settings: {
        dayStart: "08:00",
        dayEnd: "17:00",
        bufferMinutes: 5,
        preferredStartHourByProject: { study: 14.1 },
        allowTaskSplitting: false,
      },
    });

    expect(result.proposedEvents[0]).toMatchObject({
      scheduledStart: "14:00",
      scheduledEnd: "15:00",
    });
  });

  it("preserves free time before a preferred-hour placement", () => {
    const result = autoScheduleTasks({
      tasks: [
        { ...task("preferred", "study", 60), priority: "high" as const },
        task("earlier", "study", 180),
      ],
      scheduledEvents: [],
      dateRange: [future],
      settings: {
        dayStart: "08:00",
        dayEnd: "17:00",
        bufferMinutes: 15,
        strategy: "byProject",
        preferredStartHourByProject: { study: 14 },
        allowTaskSplitting: false,
      },
    });

    expect(result.proposedEvents.map(({ taskId, scheduledStart, scheduledEnd }) => ({
      taskId,
      scheduledStart,
      scheduledEnd,
    }))).toEqual([
      { taskId: "earlier", scheduledStart: "10:45", scheduledEnd: "13:45" },
      { taskId: "preferred", scheduledStart: "14:00", scheduledEnd: "15:00" },
    ]);
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

  it("uses the full end-of-day capacity when splitting across dates", () => {
    const result = autoScheduleTasks({
      tasks: [task("two-day", "study", 120)],
      scheduledEvents: [],
      dateRange: [future, "2099-01-06"],
      settings: { dayStart: "08:00", dayEnd: "09:00", bufferMinutes: 5, allowTaskSplitting: true },
    });

    expect(result.proposedEvents.map(({ scheduledDate, scheduledStart, scheduledEnd, durationMinutes }) => ({
      scheduledDate,
      scheduledStart,
      scheduledEnd,
      durationMinutes,
    }))).toEqual([
      { scheduledDate: future, scheduledStart: "08:00", scheduledEnd: "09:00", durationMinutes: 60 },
      { scheduledDate: "2099-01-06", scheduledStart: "08:00", scheduledEnd: "09:00", durationMinutes: 60 },
    ]);
    expect(result.unscheduledTasks).toEqual([]);
  });

  it("does not mutate source tasks during preview generation", () => {
    const tasks = [task("safe", "study")];
    const before = structuredClone(tasks);
    autoScheduleTasks({ tasks, scheduledEvents: [], dateRange: [future] });
    expect(tasks).toEqual(before);
  });
});
