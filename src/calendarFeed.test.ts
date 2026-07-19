import { describe, expect, it } from "vitest";
import { buildCalendarFeed } from "../mcp-worker/src/calendarFeed";

const generatedAt = new Date("2026-07-19T08:00:00.000Z");

describe("buildCalendarFeed", () => {
  it("exports scheduled blocks, all-day deadlines, and calendar events", () => {
    const feed = buildCalendarFeed({
      projects: [{ id: "project-1", title: "ESAT" }],
      tasks: [
        {
          id: "scheduled",
          title: "Mock exam, paper 1",
          projectId: "project-1",
          notes: "Bring calculator; review errors.",
          dueDate: "2026-07-21",
          updatedAt: "2026-07-19T06:00:00Z",
          timelineRecords: [{ id: "record-1", scheduledDate: "2026-07-20", scheduledStart: "23:30", scheduledEnd: "00:30", executionStatus: "scheduled", createdAt: "2026-07-18T06:00:00Z" }],
        },
        { id: "deadline", title: "Submit notes", dueDate: "2026-07-22", completed: false, createdAt: "2026-07-19T06:00:00Z", updatedAt: "2026-07-19T07:00:00Z" },
      ],
      events: [{ id: "event-1", title: "School meeting", date: "2026-07-23", startTime: "10:00", endTime: "11:00", createdAt: "2026-07-19T06:00:00Z" }],
    }, generatedAt);

    expect(feed).toContain("UID:task-scheduled-record-1@navopath.app\r\n");
    expect(feed).toContain("DTSTART:20260720T233000\r\nDTEND:20260721T003000");
    expect(feed).toContain("DESCRIPTION:Project: ESAT\\nBring calculator\\; review errors.");
    expect(feed).not.toContain("task-scheduled-due");
    expect(feed).toContain("UID:task-deadline-due@navopath.app");
    expect(feed).toContain("DTSTART;VALUE=DATE:20260722\r\nDTEND;VALUE=DATE:20260723");
    expect(feed).toContain("TRANSP:TRANSPARENT");
    expect(feed).toContain("UID:event-event-1@navopath.app");
  });

  it("skips cancelled, completed, and malformed items and folds unicode lines", () => {
    const feed = buildCalendarFeed({ tasks: [
      { id: "done", title: "Done", dueDate: "2026-07-20", completed: true },
      { id: "cancelled", title: "Cancelled", dueDate: "2026-07-20", timelineRecords: [{ id: "cancelled-record", scheduledDate: "2026-07-20", scheduledStart: "10:00", scheduledEnd: "11:00", executionStatus: "cancelled" }] },
      { id: "bad", title: "Bad", dueDate: "tomorrow" },
      { id: "long", title: "这是一个很长的中文日历标题，用来确认输出会按照字节安全折行且不会破坏任何 Unicode 字符", dueDate: "2026-07-24", completed: false },
    ] }, generatedAt);

    expect(feed).not.toContain("task-done-due");
    expect(feed).not.toContain("cancelled-record");
    expect(feed).not.toContain("task-bad-due");
    expect(feed).toMatch(/SUMMARY:[^\r]+\r\n [^\r]+/);
    for (const line of feed.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });
});
