export type PomodoroPhase = {
  id: string;
  type: "work" | "short-break" | "long-break";
  startAt: Date;
  endAt: Date;
  durationMinutes: number;
  index: number;
};

export type PomodoroPlanOptions = {
  startAt: Date; endAt: Date;
  preferredWorkMinutes: number; minWorkMinutes: number; maxWorkMinutes: number;
  preferredShortBreakMinutes: number; minShortBreakMinutes: number;
  preferredLongBreakMinutes: number; minLongBreakMinutes: number; longBreakEvery: number;
};

const positive = (value: number, fallback: number) => Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;

export function generateDeadlineAlignedPomodoroPlan(input: PomodoroPlanOptions): PomodoroPhase[] {
  const total = Math.floor((input.endAt.getTime() - input.startAt.getTime()) / 60_000);
  if (total <= 0) return [];
  const minWork = positive(input.minWorkMinutes, 1);
  const maxWork = Math.max(minWork, positive(input.maxWorkMinutes, minWork));
  if (total < minWork) return build(input.startAt, [{ type: "work", minutes: total }]);
  const preferredWork = Math.min(maxWork, Math.max(minWork, positive(input.preferredWorkMinutes, minWork)));
  const every = positive(input.longBreakEvery, 4);
  const maxCount = Math.max(1, Math.ceil(total / minWork));
  let best: { score: number; parts: Array<{ type: PomodoroPhase["type"]; minutes: number }> } | null = null;

  for (let count = 1; count <= maxCount; count += 1) {
    const breakKinds = Array.from({ length: count - 1 }, (_, index) => (index + 1) % every === 0 ? "long-break" as const : "short-break" as const);
    const preferredBreaks = breakKinds.map((kind) => kind === "long-break" ? positive(input.preferredLongBreakMinutes, 15) : positive(input.preferredShortBreakMinutes, 5));
    const minimumBreaks = breakKinds.map((kind) => kind === "long-break" ? positive(input.minLongBreakMinutes, 1) : positive(input.minShortBreakMinutes, 1));
    for (const breaks of [preferredBreaks, minimumBreaks]) {
      const workTotal = total - breaks.reduce((sum, value) => sum + value, 0);
      const low = Math.floor(workTotal / count);
      const high = Math.ceil(workTotal / count);
      if (workTotal <= 0 || low < minWork || high > maxWork) continue;
      const base = Math.floor(workTotal / count);
      const remainder = workTotal % count;
      const work = Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
      const parts: Array<{ type: PomodoroPhase["type"]; minutes: number }> = [];
      work.forEach((minutes, index) => {
        parts.push({ type: "work", minutes });
        if (index < breaks.length) parts.push({ type: breakKinds[index], minutes: breaks[index] });
      });
      const workPenalty = work.reduce((sum, value) => sum + Math.abs(value - preferredWork), 0);
      const breakPenalty = breaks.reduce((sum, value, index) => sum + Math.abs(value - preferredBreaks[index]), 0);
      const score = workPenalty * 10 + breakPenalty + count * 0.05;
      if (!best || score < best.score) best = { score, parts };
    }
  }
  if (!best) return build(input.startAt, [{ type: "work", minutes: total }]);
  return build(input.startAt, best.parts);
}

function build(startAt: Date, parts: Array<{ type: PomodoroPhase["type"]; minutes: number }>): PomodoroPhase[] {
  let cursor = startAt.getTime();
  return parts.map((part, index) => {
    const start = new Date(cursor);
    cursor += part.minutes * 60_000;
    return { id: `phase-${index}-${cursor}`, type: part.type, startAt: start, endAt: new Date(cursor), durationMinutes: part.minutes, index };
  });
}
