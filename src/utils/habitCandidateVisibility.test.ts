import { describe, expect, it } from "vitest";
import type { Settings } from "../types";
import { shouldShowHabitCandidates } from "./habitCandidateVisibility";

describe("shouldShowHabitCandidates", () => {
  it("keeps existing profiles visible by default and honors the candidate-only preference", () => {
    const enabled: Pick<Settings, "featureHabitsEnabled" | "featureHabitCandidatesEnabled"> = {
      featureHabitsEnabled: true,
    };

    expect(shouldShowHabitCandidates(enabled)).toBe(true);
    expect(shouldShowHabitCandidates({ ...enabled, featureHabitCandidatesEnabled: false })).toBe(false);
    expect(shouldShowHabitCandidates({ ...enabled, featureHabitsEnabled: false, featureHabitCandidatesEnabled: true })).toBe(false);
  });
});
