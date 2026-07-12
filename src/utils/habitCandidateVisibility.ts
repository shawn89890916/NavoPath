import type { Settings } from "../types";

export function shouldShowHabitCandidates(settings: Pick<Settings, "featureHabitsEnabled" | "featureHabitCandidatesEnabled">): boolean {
  return settings.featureHabitsEnabled !== false && settings.featureHabitCandidatesEnabled !== false;
}
