import { describe, expect, it } from "vitest";
import type { Task } from "../types";
import { expandTaskAllDayRecords, expandTaskTimelineSlices } from "./taskTimelineSlices";

const task: Task = {
  id: "task-1",
  title: "Overnight revision",
  dueDate: "2026-07-01",
  category: "exam",
  priority: "medium",
  notes: "",
  goalId: "",
  completed: false,
  estimatedHours: 1,
  timelineRecords: [{
    id: "record-1",
    taskId: "task-1",
    scheduledDate: "2026-07-01",
    scheduledStart: "23:30",
    scheduledEndDate: "2026-07-02",
    scheduledEnd: "00:30",
    executionStatus: "scheduled",
    createdAt: "2026-07-01T00:00:00.000Z",
  }],
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};

describe("expandTaskTimelineSlices", () => {
  it("splits a cross-midnight record into uniquely identified day pieces", () => {
    const result = expandTaskTimelineSlices([task], ["2026-07-01", "2026-07-02"]);

    expect(result.tasks).toMatchObject([
      { id: "record-1__day__2026-07-01", scheduledDate: "2026-07-01", scheduledStart: "23:30", scheduledEnd: "00:00", estimatedHours: 0.5 },
      { id: "record-1__day__2026-07-02", scheduledDate: "2026-07-02", scheduledStart: "00:00", scheduledEnd: "00:30", estimatedHours: 0.5 },
    ]);
  });

  it("maps every display piece back to the same task and record", () => {
    const result = expandTaskTimelineSlices([task], ["2026-07-01", "2026-07-02"]);

    for (const display of result.tasks) {
      expect(result.ownerByDisplayId.get(display.id)?.id).toBe("task-1");
      expect(result.recordByDisplayId.get(display.id)?.id).toBe("record-1");
      expect(result.sourceIdByDisplayId.get(display.id)).toBe("record-1");
    }
  });

  it("exposes only the outer resize edge on each piece", () => {
    const result = expandTaskTimelineSlices([task], ["2026-07-01", "2026-07-02"]);

    expect(result.resizeEdges.get("record-1__day__2026-07-01")).toEqual({ start: true, end: false });
    expect(result.resizeEdges.get("record-1__day__2026-07-02")).toEqual({ start: false, end: true });
  });

  it("keeps an unsplit record ID stable", () => {
    const sameDay = {
      ...task,
      timelineRecords: [{
        ...task.timelineRecords![0],
        scheduledStart: "09:00",
        scheduledEndDate: "2026-07-01",
        scheduledEnd: "10:00",
      }],
    };

    expect(expandTaskTimelineSlices([sameDay], ["2026-07-01"]).tasks[0].id).toBe("record-1");
  });

  it("keeps the end resize handle on a record that ends exactly at midnight", () => {
    const midnightEnd = {
      ...task,
      timelineRecords: [{ ...task.timelineRecords![0], scheduledEnd: "00:00" }],
    };
    const result = expandTaskTimelineSlices([midnightEnd], ["2026-07-01", "2026-07-02"]);

    expect(result.tasks).toHaveLength(1);
    expect(result.resizeEdges.get("record-1")).toEqual({ start: true, end: true });
  });
});

describe("expandTaskAllDayRecords", () => {
  it("keeps a record-based all-day task visible under its record id", () => {
    const allDayTask = {
      ...task,
      timelineRecords: [{
        ...task.timelineRecords![0],
        scheduledDate: "2026-07-02",
        scheduledStart: "",
        scheduledEnd: "",
      }],
    };

    expect(expandTaskAllDayRecords([allDayTask], ["2026-07-02"])).toMatchObject([{
      id: "record-1",
      scheduledDate: "2026-07-02",
      scheduledStart: undefined,
      scheduledEnd: undefined,
      title: task.title,
    }]);
  });

  it("excludes timed, cancelled, and out-of-range records", () => {
    const mixed = {
      ...task,
      timelineRecords: [
        task.timelineRecords![0],
        { ...task.timelineRecords![0], id: "cancelled", scheduledStart: "", scheduledEnd: "", executionStatus: "cancelled" as const },
        { ...task.timelineRecords![0], id: "other-day", scheduledDate: "2026-07-03", scheduledStart: "", scheduledEnd: "" },
      ],
    };

    expect(expandTaskAllDayRecords([mixed], ["2026-07-01"])).toEqual([]);
  });
});
