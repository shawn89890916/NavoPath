import { describe, expect, it } from "vitest";
import {
  DAILY_CONTINUOUS_DAY_COUNT,
  buildDailyContinuousDates,
  dailyContinuousBlockTop,
  dailyContinuousSlotLabel,
  dailyContinuousTargetFromContentY,
  getContinuousTimelineDateForOffset,
} from "./continuousTimeline";

describe("continuous daily timeline", () => {
  it("builds a centered vertical date range without requiring boundary switches", () => {
    expect(buildDailyContinuousDates("2026-07-01", true)).toEqual([
      "2026-06-28",
      "2026-06-29",
      "2026-06-30",
      "2026-07-01",
      "2026-07-02",
      "2026-07-03",
      "2026-07-04",
    ]);
    expect(buildDailyContinuousDates("2026-07-01", false)).toEqual(["2026-07-01"]);
  });

  it("maps vertical content past 24:00 to the next date instead of snapping selected date", () => {
    expect(dailyContinuousTargetFromContentY({
      contentY: 23 * 80,
      anchorDate: "2026-07-01",
      dayStartHour: 0,
      dayCount: DAILY_CONTINUOUS_DAY_COUNT,
    })).toMatchObject({ date: "2026-07-01", startTime: "23:00" });

    expect(dailyContinuousTargetFromContentY({
      contentY: 24 * 80,
      anchorDate: "2026-07-01",
      dayStartHour: 0,
      dayCount: DAILY_CONTINUOUS_DAY_COUNT,
    })).toMatchObject({ date: "2026-07-02", startTime: "00:00" });

    expect(dailyContinuousTargetFromContentY({
      contentY: 25 * 80,
      anchorDate: "2026-07-01",
      dayStartHour: 0,
      dayCount: DAILY_CONTINUOUS_DAY_COUNT,
    })).toMatchObject({ date: "2026-07-02", startTime: "01:00" });
  });

  it("offsets blocks and labels the day boundary in the same vertical flow", () => {
    expect(dailyContinuousBlockTop("2026-07-02", "01:00", "2026-07-01", 0)).toBe(25 * 80);
    expect(dailyContinuousSlotLabel({
      index: 96,
      anchorDate: "2026-07-01",
      dayStartHour: 0,
    })).toBe("7.2 0:00");
    expect(dailyContinuousSlotLabel({
      index: 96,
      anchorDate: "2026-07-01",
      dayStartHour: 0,
      dateStep: 3,
    })).toBe("7.4 0:00");
  });

  it("maps scroll offsets to the visible date window for daily, 3-day, and week views", () => {
    expect(getContinuousTimelineDateForOffset("2026-07-01", 0, 1)).toBe("2026-07-01");
    expect(getContinuousTimelineDateForOffset("2026-07-01", -1, 1)).toBe("2026-06-30");
    expect(getContinuousTimelineDateForOffset("2026-07-01", 1, 3)).toBe("2026-07-04");
    expect(getContinuousTimelineDateForOffset("2026-07-01", -1, 7)).toBe("2026-06-24");
  });
});
