import { describe, expect, it } from "vitest";
import { extendActiveTimelineRecord, timelineRecordBounds } from "./widgetSchedule";
import type { Task } from "../types";

const task = { id: "task-1", estimatedHours: 1, timelineRecords: [{ id: "record-1", taskId: "task-1", scheduledDate: "2026-07-13", scheduledStart: "14:00", scheduledEndDate: "2026-07-13", scheduledEnd: "15:00", executionStatus: "scheduled", createdAt: "now" }] } as Task;

describe("widget timeline schedule", () => {
  it("resolves absolute bounds from the active record", () => expect(timelineRecordBounds(task)).toMatchObject({ recordId: "record-1", startAt: new Date("2026-07-13T14:00:00").getTime(), endAt: new Date("2026-07-13T15:00:00").getTime() }));
  it("extends only the active record and preserves its start", () => {
    const later = { ...task.timelineRecords![0], id: "later", scheduledStart: "15:00", scheduledEnd: "16:00" };
    const result = extendActiveTimelineRecord({ ...task, timelineRecords: [...task.timelineRecords!, later] }, "record-1", new Date("2026-07-13T15:12:00").getTime());
    expect(result.timelineRecords?.[0]).toMatchObject({ scheduledStart: "14:00", scheduledEnd: "15:12" });
    expect(result.timelineRecords?.[1]).toEqual(later);
    expect(result.estimatedHours).toBe(1.2);
  });
  it("does not shorten a record", () => expect(extendActiveTimelineRecord(task, "record-1", new Date("2026-07-13T14:30:00").getTime())).toBe(task));
});
