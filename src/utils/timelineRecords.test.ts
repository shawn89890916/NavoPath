import { describe, expect, it } from "vitest";
import type { TimelineRecord } from "../types";
import { focusTargetForRecord, normalizeTimelineRecord, sliceTimelineRecord } from "./timelineRecords";

const record: TimelineRecord = {
  id: "record-1",
  taskId: "task-1",
  scheduledDate: "2026-07-01",
  scheduledStart: "23:30",
  scheduledEndDate: "2026-07-02",
  scheduledEnd: "07:30",
  executionStatus: "scheduled",
  createdAt: "2026-07-01T00:00:00.000Z",
};

describe("timelineRecords", () => {
  it("normalizes legacy same-day records", () => {
    const legacy = { ...record, scheduledEndDate: undefined, scheduledStart: "09:00", scheduledEnd: "10:00" };
    expect(normalizeTimelineRecord(legacy).scheduledEndDate).toBe("2026-07-01");
  });

  it("slices cross-day records into visible day pieces", () => {
    const slices = sliceTimelineRecord(record, ["2026-07-01", "2026-07-02"]);
    expect(slices).toEqual([
      { recordId: "record-1", taskId: "task-1", date: "2026-07-01", startMinutes: 1410, endMinutes: 1440, continuesBefore: false, continuesAfter: true },
      { recordId: "record-1", taskId: "task-1", date: "2026-07-02", startMinutes: 0, endMinutes: 450, continuesBefore: true, continuesAfter: false },
    ]);
  });

  it("creates a stable focus target", () => {
    expect(focusTargetForRecord(record)).toEqual({ date: "2026-07-01", recordId: "record-1", taskId: "task-1", time: "23:30" });
  });
});
