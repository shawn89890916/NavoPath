import type {
  WidgetTimerMode,
  WidgetTimerPreferences,
  WidgetTimerRuntime,
  WidgetTimerTick,
} from "../types";

export const DEFAULT_WIDGET_TIMER_PREFERENCES: WidgetTimerPreferences = {
  mode: "stopwatch",
  focusMinutes: 25,
  breakMinutes: 5,
  rounds: 4,
  countdownSeconds: 25 * 60,
};

export const DEFAULT_WIDGET_RUNTIME: WidgetTimerRuntime = {
  mode: "stopwatch",
  phase: "stopwatch",
  running: false,
  round: 1,
  phaseStartedAt: 0,
};

function normalizeInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min
    ? Math.min(max, Math.round(parsed))
    : fallback;
}

export function normalizeWidgetTimerPreferences(
  value?: Partial<WidgetTimerPreferences> | null,
): WidgetTimerPreferences {
  const mode = value?.mode;
  return {
    mode: mode === "stopwatch" || mode === "pomodoro" || mode === "countdown"
      ? mode
      : DEFAULT_WIDGET_TIMER_PREFERENCES.mode,
    focusMinutes: normalizeInteger(value?.focusMinutes, DEFAULT_WIDGET_TIMER_PREFERENCES.focusMinutes, 1, 180),
    breakMinutes: normalizeInteger(value?.breakMinutes, DEFAULT_WIDGET_TIMER_PREFERENCES.breakMinutes, 1, 60),
    rounds: normalizeInteger(value?.rounds, DEFAULT_WIDGET_TIMER_PREFERENCES.rounds, 1, 12),
    countdownSeconds: normalizeInteger(value?.countdownSeconds, DEFAULT_WIDGET_TIMER_PREFERENCES.countdownSeconds, 1, 86_400),
  };
}

function durationMs(runtime: WidgetTimerRuntime, preferences: WidgetTimerPreferences): number | undefined {
  if (runtime.phase === "focus") return preferences.focusMinutes * 60_000;
  if (runtime.phase === "break") return preferences.breakMinutes * 60_000;
  if (runtime.phase === "countdown") return preferences.countdownSeconds * 1_000;
  return undefined;
}

export function createWidgetTimerRuntime(
  mode: WidgetTimerMode,
  now: number,
  value: Partial<WidgetTimerPreferences> = DEFAULT_WIDGET_TIMER_PREFERENCES,
): WidgetTimerRuntime {
  const preferences = normalizeWidgetTimerPreferences({ ...value, mode });
  const phase = mode === "pomodoro" ? "focus" : mode;
  const runtime: WidgetTimerRuntime = {
    mode,
    phase,
    running: true,
    round: 1,
    phaseStartedAt: now,
  };
  const duration = durationMs(runtime, preferences);
  if (duration !== undefined) runtime.phaseEndsAt = now + duration;
  return runtime;
}

export function advanceWidgetTimer(
  value: WidgetTimerRuntime,
  preferenceValue: Partial<WidgetTimerPreferences>,
  now: number,
): WidgetTimerTick & WidgetTimerRuntime {
  const preferences = normalizeWidgetTimerPreferences(preferenceValue);
  let runtime = { ...value };
  const transitions: WidgetTimerTick["transitions"] = [];

  if (runtime.pausedAt !== undefined) {
    if (!runtime.running) now = runtime.pausedAt;
    else {
      const pauseDuration = Math.max(0, now - runtime.pausedAt);
      runtime.phaseStartedAt += pauseDuration;
      if (runtime.phaseEndsAt !== undefined) runtime.phaseEndsAt += pauseDuration;
      delete runtime.pausedAt;
    }
  }

  if (runtime.running) {
    for (let index = 0; index < 64 && runtime.phaseEndsAt !== undefined && now >= runtime.phaseEndsAt; index += 1) {
      const transitionAt = runtime.phaseEndsAt;
      if (runtime.phase === "countdown") {
        transitions.push("countdownComplete");
        runtime = { ...runtime, phase: "overrun", phaseStartedAt: transitionAt };
        delete runtime.phaseEndsAt;
        break;
      }
      if (runtime.phase === "focus") {
        transitions.push("focusComplete");
        runtime = {
          ...runtime,
          phase: "break",
          phaseStartedAt: transitionAt,
          phaseEndsAt: transitionAt + preferences.breakMinutes * 60_000,
        };
      } else if (runtime.phase === "break") {
        transitions.push("breakComplete");
        runtime = {
          ...runtime,
          phase: "focus",
          round: runtime.round >= preferences.rounds ? 1 : runtime.round + 1,
          phaseStartedAt: transitionAt,
          phaseEndsAt: transitionAt + preferences.focusMinutes * 60_000,
        };
      }
    }
  }

  let displaySeconds: number;
  if (runtime.phase === "stopwatch" || runtime.phase === "overrun") {
    displaySeconds = Math.max(0, Math.floor((now - runtime.phaseStartedAt) / 1_000));
  } else {
    displaySeconds = Math.max(0, Math.ceil(((runtime.phaseEndsAt ?? now) - now) / 1_000));
  }
  const countsAsWork = runtime.phase !== "break";
  return { ...runtime, runtime, displaySeconds, transitions, countsAsWork };
}
