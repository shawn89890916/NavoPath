import { describe, expect, it } from "vitest";
import {
  HOUR_HEIGHT,
  SLOT_HEIGHT,
  addDays,
  absoluteMinutesToDateTime,
  dateTimeToAbsoluteMinutes,
  durationMinutes,
  minutesToTime,
  snapMinutes,
  timeBlockHeight,
  timeToMinutes,
} from "./timelineGeometry";

describe("timelineGeometry cross-midnight helpers", () => {
  describe("durationMinutes", () => {
    it("returns the positive difference for same-day spans", () => {
      expect(durationMinutes("09:00", "10:00")).toBe(60);
      expect(durationMinutes("12:00", "12:15")).toBe(15);
    });

    it("treats end ≤ start as next-day (cross-midnight)", () => {
      // 23:30 → 00:30 must be 60 minutes, not -1380.
      expect(durationMinutes("23:30", "00:30")).toBe(60);
      expect(durationMinutes("23:59", "00:00")).toBe(1);
      expect(durationMinutes("00:00", "00:00")).toBe(24 * 60);
    });

    it("does not collapse a 23:30→00:30 span to the slot fallback", () => {
      expect(durationMinutes("23:30", "00:30")).not.toBe(15);
      expect(durationMinutes("23:30", "00:30")).toBeGreaterThan(0);
    });
  });

  describe("dateTimeToAbsoluteMinutes / absoluteMinutesToDateTime", () => {
    it("round-trips a same-day point", () => {
      const abs = dateTimeToAbsoluteMinutes("2026-07-01", "09:30", "2026-07-01");
      expect(abs).toBe(timeToMinutes("09:30"));
      const back = absoluteMinutesToDateTime(abs, "2026-07-01");
      expect(back).toEqual({ date: "2026-07-01", time: "09:30" });
    });

    it("advances the date when absolute minutes cross into the next day", () => {
      // 23:30 on day 1 + 60 minutes = 00:30 on day 2.
      const startAbs = dateTimeToAbsoluteMinutes("2026-07-01", "23:30", "2026-07-01");
      const nextAbs = startAbs + 60;
      const back = absoluteMinutesToDateTime(nextAbs, "2026-07-01");
      expect(back).toEqual({ date: "2026-07-02", time: "00:30" });
    });

    it("maps a 23:30 day-1 pointer and a 00:30 day-2 pointer to a 60m gap", () => {
      const a = dateTimeToAbsoluteMinutes("2026-07-01", "23:30", "2026-07-01");
      const b = dateTimeToAbsoluteMinutes("2026-07-02", "00:30", "2026-07-01");
      expect(b - a).toBe(60);
    });
  });

  describe("snapMinutes", () => {
    it("snaps to the nearest 15-minute slot by default", () => {
      expect(snapMinutes(7)).toBe(0);
      expect(snapMinutes(8)).toBe(15);
      expect(snapMinutes(22)).toBe(15);
      expect(snapMinutes(23)).toBe(30);
    });

    it("supports a custom snap granularity", () => {
      expect(snapMinutes(40, 30)).toBe(30);
      expect(snapMinutes(46, 30)).toBe(60);
    });
  });

  describe("timeBlockHeight (cross-midnight)", () => {
    it("keeps the full 60m height for a 23:30→00:30 span", () => {
      // 60 minutes × 80px/hour = 80px; must not collapse to SLOT_HEIGHT (20px).
      expect(timeBlockHeight("23:30", "00:30")).toBe(80);
    });

    it("still respects the SLOT_HEIGHT floor for tiny spans", () => {
      expect(timeBlockHeight("09:00", "09:05")).toBe(SLOT_HEIGHT);
    });

    it("matches HOUR_HEIGHT for a normal same-day hour", () => {
      expect(timeBlockHeight("09:00", "10:00")).toBe(HOUR_HEIGHT);
    });
  });

  describe("acceptance scenarios from the cross-day fix brief", () => {
    // Mirror the acceptance cases in implementation-notes.md using the
    // geometry helpers directly, so a regression in any helper fails the suite.
    it("case 2: drag 23:30→00:30 preserves 60m duration across midnight", () => {
      const duration = durationMinutes("23:30", "00:30");
      const newStart = "00:30";
      const newEnd = minutesToTime(timeToMinutes(newStart) + duration);
      expect(duration).toBe(60);
      expect(newEnd).toBe("01:30");
    });

    it("case 4: resize 23:30/30m bottom to next-day 00:30 yields 60m", () => {
      const startAbs = dateTimeToAbsoluteMinutes("2026-07-01", "23:30", "2026-07-01");
      const pointerAbs = dateTimeToAbsoluteMinutes("2026-07-02", "00:30", "2026-07-01");
      const newDuration = Math.max(15, pointerAbs - startAbs);
      expect(newDuration).toBe(60);
      const newEnd = minutesToTime(timeToMinutes("23:30") + newDuration);
      // 23:30 + 60m wraps to 00:30 (mod 24h).
      expect(newEnd).toBe("00:30");
    });

    it("addDays cooperates with absoluteMinutesToDateTime for multi-day offsets", () => {
      expect(addDays("2026-07-01", 1)).toBe("2026-07-02");
      expect(absoluteMinutesToDateTime(1440, "2026-07-01").date).toBe("2026-07-02");
    });
  });
});
