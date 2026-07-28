import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "../types";
import { calendarEventDurationMinutes, expandTimedCalendarEvent } from "./calendarEventSlices";

const overnightEvent: CalendarEvent = {
  id: "event-1",
  title: "Overnight study",
  date: "2026-07-01",
  startDate: "2026-07-01",
  endDate: "2026-07-02",
  startTime: "23:30",
  endTime: "00:30",
  category: "exam",
  details: "",
  createdAt: "2026-07-01T00:00:00.000Z",
};

describe("calendar event slices", () => {
  it("measures the full event duration independently from a recurrence series end", () => {
    expect(calendarEventDurationMinutes(overnightEvent)).toBe(60);
    expect(calendarEventDurationMinutes({
      ...overnightEvent,
      endDate: "2026-12-31",
      recurrence: {
        mode: "scheduled",
        frequency: "daily",
        startDate: "2026-07-01",
        startTime: "23:30",
        durationMinutes: 60,
        endDate: "2026-12-31",
      },
    })).toBe(60);
  });

  it("splits a timed cross-midnight event across its visible dates", () => {
    expect(expandTimedCalendarEvent(overnightEvent, ["2026-07-01", "2026-07-02"])).toMatchObject([
      { date: "2026-07-01", startTime: "23:30", endTime: "00:00", durationMinutes: 30, continuesBefore: false, continuesAfter: true },
      { date: "2026-07-02", startTime: "00:00", endTime: "00:30", durationMinutes: 30, continuesBefore: true, continuesAfter: false },
    ]);
  });

  it("shows the continuation when only the ending date is visible", () => {
    expect(expandTimedCalendarEvent(overnightEvent, ["2026-07-02"])).toMatchObject([
      { date: "2026-07-02", startTime: "00:00", endTime: "00:30", durationMinutes: 30 },
    ]);
  });

  it("includes the previous occurrence spill for a recurring overnight event", () => {
    const recurring = {
      ...overnightEvent,
      recurrence: {
        mode: "scheduled",
        frequency: "daily",
        startDate: "2026-07-01",
        startTime: "23:30",
        durationMinutes: 60,
      },
    } as CalendarEvent;

    expect(expandTimedCalendarEvent(recurring, ["2026-07-02"])).toMatchObject([
      { date: "2026-07-02", startTime: "00:00", endTime: "00:30", durationMinutes: 30 },
      { date: "2026-07-02", startTime: "23:30", endTime: "00:00", durationMinutes: 30 },
    ]);
  });
});
