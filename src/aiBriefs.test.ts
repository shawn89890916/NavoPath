import { describe, expect, it } from "vitest";
import { nextDueAiBrief } from "./aiBriefs";

describe("proactive AI brief schedule", () => {
  it("catches up once per kind and local day", () => {
    const base = { date: "2026-08-20", startTime: "08:00", endTime: "21:30" };
    expect(nextDueAiBrief({ ...base, minutes: 7 * 60 + 59 })).toBeNull();
    expect(nextDueAiBrief({ ...base, minutes: 9 * 60 })).toBe("start");
    expect(nextDueAiBrief({ ...base, minutes: 22 * 60, lastStartDate: base.date })).toBe("review");
    expect(nextDueAiBrief({ ...base, minutes: 22 * 60, lastStartDate: base.date, lastEndDate: base.date })).toBeNull();
  });

  it("falls back safely when stored times are malformed", () => {
    expect(nextDueAiBrief({ date: "2026-08-20", minutes: 8 * 60, startTime: "bad" })).toBe("start");
  });
});
