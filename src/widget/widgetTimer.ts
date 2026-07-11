import type {
  Language,
  WidgetTimerMode,
  WidgetTimerPhase,
  WidgetTimerPreferences,
  WidgetTimerRuntime,
  WidgetTimerTick,
} from "../types";

type WidgetTimerTransition = WidgetTimerTick["transitions"][number];

export interface WidgetTimerNotificationDescriptor {
  title: string;
  body: string;
}

export function advanceTaskElapsedSeconds(baseSeconds: number, startedAt: number, now: number): number {
  return Math.max(0, Math.floor(baseSeconds + Math.max(0, now - startedAt) / 1_000));
}

export type StopwatchTaskTimerAction = {
  type: "start" | "resume" | "pause";
  elapsedSeconds: number;
};

export function getStopwatchTaskTimerAction(
  taskId: string | null,
  elapsedBaseSeconds: number,
  startedAt: number | null,
  now: number,
): StopwatchTaskTimerAction {
  if (!taskId) return { type: "start", elapsedSeconds: 0 };
  if (startedAt === null) return { type: "resume", elapsedSeconds: Math.max(0, Math.floor(elapsedBaseSeconds)) };
  return {
    type: "pause",
    elapsedSeconds: advanceTaskElapsedSeconds(elapsedBaseSeconds, startedAt, now),
  };
}

export function getWidgetTimerModeChangeTaskAction(
  currentMode: WidgetTimerMode,
  taskId: string | null,
  elapsedBaseSeconds: number,
  startedAt: number | null,
  now: number,
): StopwatchTaskTimerAction | null {
  if (currentMode !== "stopwatch" || startedAt === null) return null;
  return getStopwatchTaskTimerAction(taskId, elapsedBaseSeconds, startedAt, now);
}

export function normalizeWidgetTimerMode(value: unknown, fallback: WidgetTimerMode): WidgetTimerMode {
  return value === "stopwatch" || value === "pomodoro" || value === "countdown" ? value : fallback;
}

export function getWidgetTimerSnapshotDisplaySeconds(
  mode: WidgetTimerMode,
  widgetDisplaySeconds: number,
  taskElapsedBase: number,
  taskRunning: boolean,
  taskStartedAt: number | null,
  now: number,
): number {
  if (mode !== "stopwatch") return widgetDisplaySeconds;
  return taskRunning && taskStartedAt !== null
    ? advanceTaskElapsedSeconds(taskElapsedBase, taskStartedAt, now)
    : Math.max(0, Math.floor(taskElapsedBase));
}

export function countsWidgetTimerPhaseAsWork(phase: WidgetTimerPhase): boolean {
  return phase !== "break";
}

export function getWidgetTimerNotificationDescriptor(
  transition: WidgetTimerTransition,
  lang: Language,
): WidgetTimerNotificationDescriptor {
  const descriptors: Record<Language, Record<WidgetTimerTransition, WidgetTimerNotificationDescriptor>> = {
    en: {
      focusComplete: { title: "Focus complete", body: "Time for a break." },
      breakComplete: { title: "Break complete", body: "Ready for the next focus round." },
      countdownComplete: { title: "Countdown complete", body: "Overrun timing has started." },
    },
    zh: {
      focusComplete: { title: "专注结束", body: "该休息一下了。" },
      breakComplete: { title: "休息结束", body: "准备开始下一轮专注。" },
      countdownComplete: { title: "倒计时结束", body: "已开始超时计时。" },
    },
  };
  return descriptors[lang][transition];
}

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

function isValidCountdownTarget(value: unknown): value is number {
  return Number.isFinite(value) && Number(value) > 0;
}

export function taskDueDateTargetAt(dueDate?: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate || "")) return undefined;
  const target = new Date(`${dueDate}T23:59:59.999`);
  return Number.isFinite(target.getTime()) ? target.getTime() : undefined;
}

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

export function createWidgetTimerModeTransition(
  modeValue: unknown,
  currentPreferences: WidgetTimerPreferences,
  now: number,
  countdownTargetAt?: number,
) {
  const mode = normalizeWidgetTimerMode(modeValue, currentPreferences.mode);
  const preferences = normalizeWidgetTimerPreferences({ ...currentPreferences, mode });
  return {
    preferences,
    runtime: {
      ...createWidgetTimerRuntime(mode, now, preferences, countdownTargetAt),
      running: false,
      pausedAt: now,
    } satisfies WidgetTimerRuntime,
  };
}

export function normalizeWidgetTimerRuntime(
  value: Partial<WidgetTimerRuntime> | null | undefined,
  preferenceValue: Partial<WidgetTimerPreferences>,
  now: number,
): WidgetTimerRuntime {
  const preferences = normalizeWidgetTimerPreferences(preferenceValue);
  const allowedPhases: Record<WidgetTimerMode, WidgetTimerPhase[]> = {
    stopwatch: ["stopwatch"],
    pomodoro: ["focus", "break"],
    countdown: ["countdown", "overrun"],
  };
  const mode = preferences.mode;
  const phase = value?.mode === mode && value?.phase && allowedPhases[mode].includes(value.phase)
    ? value.phase
    : mode === "pomodoro" ? "focus" : mode;
  let running = value?.running === true;
  const round = Math.min(preferences.rounds, Math.max(1,
    Number.isFinite(value?.round) ? Math.round(value!.round!) : 1));
  const phaseStartedAt = Number.isFinite(value?.phaseStartedAt) && value!.phaseStartedAt! >= 0
    && value!.phaseStartedAt! <= now ? value!.phaseStartedAt! : now;
  const runtime: WidgetTimerRuntime = { mode, phase, running, round, phaseStartedAt };
  if (phase === "focus" || phase === "break") {
    const fallbackDuration = phase === "focus" ? preferences.focusMinutes * 60_000
      : preferences.breakMinutes * 60_000;
    runtime.phaseEndsAt = Number.isFinite(value?.phaseEndsAt) && value!.phaseEndsAt! >= phaseStartedAt
      ? value!.phaseEndsAt! : phaseStartedAt + fallbackDuration;
  }
  if (mode === "countdown") {
    if (isValidCountdownTarget(value?.countdownTargetAt)) {
      runtime.countdownTargetAt = value!.countdownTargetAt!;
      if (typeof value?.countdownTaskId === "string") runtime.countdownTaskId = value.countdownTaskId;
      if (phase === "countdown") runtime.phaseEndsAt = runtime.countdownTargetAt;
    } else {
      running = false;
      runtime.running = false;
    }
  }
  if (!running) {
    runtime.pausedAt = Number.isFinite(value?.pausedAt) && value!.pausedAt! >= phaseStartedAt
      ? value!.pausedAt! : now;
  } else if (Number.isFinite(value?.pausedAt) && value!.pausedAt! >= phaseStartedAt) {
    runtime.pausedAt = value!.pausedAt!;
  }
  return runtime;
}

function calculateWidgetWorkMilliseconds(
  value: WidgetTimerRuntime,
  preferenceValue: Partial<WidgetTimerPreferences>,
  from: number,
  now: number,
): number {
  if (!value.running || value.pausedAt !== undefined || now <= from) return 0;
  const preferences = normalizeWidgetTimerPreferences(preferenceValue);
  if (value.mode !== "pomodoro") return Math.max(0, now - from);
  let cursor = Math.max(from, value.phaseStartedAt);
  let phase: WidgetTimerPhase = value.phase;
  let phaseEndsAt = Math.max(cursor, value.phaseEndsAt ?? cursor);
  let workMs = 0;
  while (cursor < now) {
    const segmentEnd = Math.min(now, phaseEndsAt);
    if (phase !== "break") workMs += Math.max(0, segmentEnd - cursor);
    cursor = segmentEnd;
    if (cursor >= now) break;
    if (phase === "focus") {
      phase = "break";
      phaseEndsAt += preferences.breakMinutes * 60_000;
    } else {
      phase = "focus";
      phaseEndsAt += preferences.focusMinutes * 60_000;
    }
  }
  return Math.max(0, workMs);
}

export function calculateWidgetWorkSeconds(
  value: WidgetTimerRuntime,
  preferenceValue: Partial<WidgetTimerPreferences>,
  from: number,
  now: number,
): number {
  return Math.floor(calculateWidgetWorkMilliseconds(value, preferenceValue, from, now) / 1_000);
}

export function accumulateWidgetWorkTime(
  value: WidgetTimerRuntime,
  preferenceValue: Partial<WidgetTimerPreferences>,
  from: number,
  now: number,
  priorRemainderMs: number,
): { wholeSeconds: number; remainderMs: number } {
  const totalMs = Math.max(0, priorRemainderMs)
    + calculateWidgetWorkMilliseconds(value, preferenceValue, from, now);
  return {
    wholeSeconds: Math.floor(totalMs / 1_000),
    remainderMs: totalMs % 1_000,
  };
}

function durationMs(runtime: WidgetTimerRuntime, preferences: WidgetTimerPreferences): number | undefined {
  if (runtime.phase === "focus") return preferences.focusMinutes * 60_000;
  if (runtime.phase === "break") return preferences.breakMinutes * 60_000;
  return undefined;
}

export function createWidgetTimerRuntime(
  mode: WidgetTimerMode,
  now: number,
  value: Partial<WidgetTimerPreferences> = DEFAULT_WIDGET_TIMER_PREFERENCES,
  countdownTargetAt?: number,
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
  if (mode === "countdown" && isValidCountdownTarget(countdownTargetAt)) {
    runtime.countdownTargetAt = countdownTargetAt;
    runtime.phaseEndsAt = countdownTargetAt;
  }
  const duration = durationMs(runtime, preferences);
  if (duration !== undefined) runtime.phaseEndsAt = now + duration;
  return runtime;
}

export function resetWidgetTimerRuntime(
  runtime: WidgetTimerRuntime,
  preferenceValue: Partial<WidgetTimerPreferences>,
  now: number,
): WidgetTimerRuntime {
  const reset = createWidgetTimerRuntime(runtime.mode, now, preferenceValue, runtime.countdownTargetAt);
  if (runtime.mode === "countdown" && runtime.countdownTaskId) reset.countdownTaskId = runtime.countdownTaskId;
  return { ...reset, running: false, pausedAt: now };
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
      if (runtime.phaseEndsAt !== undefined && !isValidCountdownTarget(runtime.countdownTargetAt)) {
        runtime.phaseEndsAt += pauseDuration;
      }
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
  const countsAsWork = countsWidgetTimerPhaseAsWork(runtime.phase);
  return { ...runtime, runtime, displaySeconds, transitions, countsAsWork };
}
