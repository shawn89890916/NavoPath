import { describe, expect, it } from "vitest";
import { extendActiveTimelineRecord, nextOverrunExtensionEnd, resolveWidgetTimelineSelection, timelineRecordBounds } from "./widgetSchedule";
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

  it("selects the current timeline task, then the next task, without falling back to an expired task", () => {
    const earlier = { ...task, id: "earlier", timelineRecords: [{ ...task.timelineRecords![0], id: "earlier-record", taskId: "earlier", scheduledStart: "12:00", scheduledEnd: "13:00" }] } as Task;
    const later = { ...task, id: "later", timelineRecords: [{ ...task.timelineRecords![0], id: "later-record", taskId: "later", scheduledStart: "16:00", scheduledEnd: "17:00" }] } as Task;
    expect(resolveWidgetTimelineSelection([earlier, task, later], new Date("2026-07-13T14:30:00").getTime())).toMatchObject({ task: { id: "task-1" }, recordId: "record-1", state: "active" });
    expect(resolveWidgetTimelineSelection([earlier, task, later], new Date("2026-07-13T15:30:00").getTime())).toMatchObject({ task: { id: "later" }, recordId: "later-record", state: "upcoming" });
    expect(resolveWidgetTimelineSelection([earlier, task, later], new Date("2026-07-13T18:00:00").getTime())).toBeUndefined();
  });

  it("extends the current deadline only after each complete 15-minute overrun interval", () => {
    const end = new Date("2026-07-13T15:00:00").getTime();
    expect(nextOverrunExtensionEnd(end, new Date("2026-07-13T15:14:59").getTime())).toBeUndefined();
    expect(nextOverrunExtensionEnd(end, new Date("2026-07-13T15:15:00").getTime())).toBe(new Date("2026-07-13T15:15:00").getTime());
    expect(nextOverrunExtensionEnd(end, new Date("2026-07-13T15:46:00").getTime())).toBe(new Date("2026-07-13T15:45:00").getTime());
  });
});
