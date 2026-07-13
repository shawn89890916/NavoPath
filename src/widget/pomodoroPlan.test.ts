import { describe, expect, it } from "vitest";
import { generateDeadlineAlignedPomodoroPlan } from "./pomodoroPlan";

const at = (minutes: number) => new Date(Date.UTC(2026, 6, 13, 8, minutes));
const options = (minutes: number) => ({ startAt: at(0), endAt: at(minutes), preferredWorkMinutes: 25, minWorkMinutes: 15, maxWorkMinutes: 50, preferredShortBreakMinutes: 5, minShortBreakMinutes: 2, preferredLongBreakMinutes: 15, minLongBreakMinutes: 5, longBreakEvery: 4 });

describe("generateDeadlineAlignedPomodoroPlan", () => {
  it("falls back to one exact work phase when shorter than minimum", () => expect(generateDeadlineAlignedPomodoroPlan(options(8))).toMatchObject([{ type: "work", durationMinutes: 8 }]));
  it("produces one standard work phase", () => expect(generateDeadlineAlignedPomodoroPlan(options(25))).toHaveLength(1));
  it("fits two work phases around a short break", () => expect(generateDeadlineAlignedPomodoroPlan(options(55)).map((phase) => phase.type)).toEqual(["work", "short-break", "work"]));
  it("balances indivisible work minutes", () => {
    const work = generateDeadlineAlignedPomodoroPlan(options(70)).filter((phase) => phase.type === "work").map((phase) => phase.durationMinutes);
    expect(Math.max(...work) - Math.min(...work)).toBeLessThanOrEqual(1);
  });
  it("uses a long break at the configured boundary for a long task", () => expect(generateDeadlineAlignedPomodoroPlan(options(130)).some((phase) => phase.type === "long-break")).toBe(true));
  it("degrades an oversized long break instead of creating an illegal final work phase", () => {
    const plan = generateDeadlineAlignedPomodoroPlan({ ...options(105), preferredLongBreakMinutes: 40, minLongBreakMinutes: 5, longBreakEvery: 2 });
    expect(plan.filter((phase) => phase.type === "work").every((phase) => phase.durationMinutes >= 15)).toBe(true);
  });
  it("keeps every phase contiguous, positive, legal, ending exactly at deadline with work", () => {
    for (const minutes of [1, 24, 56, 71, 130, 360, 900]) {
      const plan = generateDeadlineAlignedPomodoroPlan(options(minutes));
      expect(plan.at(-1)?.type).toBe("work");
      expect(plan.at(-1)?.endAt.getTime()).toBe(at(minutes).getTime());
      plan.forEach((phase, index) => {
        expect(phase.durationMinutes).toBeGreaterThan(0);
        if (minutes >= 15 && phase.type === "work") expect(phase.durationMinutes).toBeGreaterThanOrEqual(15);
        if (phase.type === "work") expect(phase.durationMinutes).toBeLessThanOrEqual(50);
        if (index) expect(phase.startAt.getTime()).toBe(plan[index - 1].endAt.getTime());
      });
    }
  });
  it("returns no phases when the deadline has passed", () => expect(generateDeadlineAlignedPomodoroPlan(options(-1))).toEqual([]));
  it("recalculates against a changed deadline", () => expect(generateDeadlineAlignedPomodoroPlan(options(80)).at(-1)?.endAt.getTime()).toBe(at(80).getTime()));
});
