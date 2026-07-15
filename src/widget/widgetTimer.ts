import type {
  Language,
  Task,
  TimelineRecord,
  WidgetTimerMode,
  WidgetTimerPhase,
  WidgetTimerPreferences,
  WidgetTimerRuntime,
  WidgetTimerTick,
} from "../types";
import { generateDeadlineAlignedPomodoroPlan } from "./pomodoroPlan";

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
  minWorkMinutes: 15,
  maxWorkMinutes: 50,
  longBreakMinutes: 15,
  minBreakMinutes: 2,
  minLongBreakMinutes: 5,
  longBreakEvery: 4,
  autoStartNextPhase: false,
  allowWorkAdjustment: true,
  allowBreakShortening: true,
};

export const DEFAULT_WIDGET_RUNTIME: WidgetTimerRuntime = {
  mode: "stopwatch",
  phase: "stopwatch",
  running: false,
  round: 1,
  phaseStartedAt: 0,
};

export function createDeadlineAlignedPomodoroRuntime(startAt: number, endAt: number, value: Partial<WidgetTimerPreferences>): WidgetTimerRuntime {
  const preferences = normalizeWidgetTimerPreferences({ ...value, mode: "pomodoro" });
  const pomodoroPlan = generateDeadlineAlignedPomodoroPlan({ startAt: new Date(startAt), endAt: new Date(endAt), preferredWorkMinutes: preferences.focusMinutes, minWorkMinutes: preferences.minWorkMinutes || 15, maxWorkMinutes: preferences.maxWorkMinutes || 50, preferredShortBreakMinutes: preferences.breakMinutes, minShortBreakMinutes: preferences.minBreakMinutes || 2, preferredLongBreakMinutes: preferences.longBreakMinutes || 15, minLongBreakMinutes: preferences.minLongBreakMinutes || 5, longBreakEvery: preferences.longBreakEvery || 4 }).map((phase) => ({ ...phase, startAt: phase.startAt.getTime(), endAt: phase.endAt.getTime() }));
  const first = pomodoroPlan[0];
  return { mode: "pomodoro", phase: "focus", running: false, round: 1, phaseStartedAt: startAt, phaseEndsAt: first?.endAt || endAt, pausedAt: startAt, pomodoroPlan, currentPomodoroPhaseIndex: 0 };
}

function isValidCountdownTarget(value: unknown): value is number {
  return Number.isFinite(value) && Number(value) > 0;
}

export function taskDueDateTargetAt(dueDate?: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate || "")) return undefined;
  const target = new Date(`${dueDate}T23:59:59.999`);
  return Number.isFinite(target.getTime()) ? target.getTime() : undefined;
}

export function resolveWidgetCountdownTarget(dueDate: string | undefined, taskId: string | undefined, runtime: WidgetTimerRuntime, scheduledEndAt?: number): number | undefined {
  if (isValidCountdownTarget(scheduledEndAt)) return scheduledEndAt;
  const dueDateTarget = taskDueDateTargetAt(dueDate);
  if (dueDateTarget !== undefined) return dueDateTarget;
  return runtime.mode === "countdown" && runtime.countdownTaskId === taskId && isValidCountdownTarget(runtime.countdownTargetAt)
    ? runtime.countdownTargetAt
    : undefined;
}

export function scheduleWidgetCountdown(task: Task, now: Date, durationMinutes: number): { record: TimelineRecord; countdownTargetAt: number } {
  const duration = Math.min(1_440, Math.max(1, Math.round(durationMinutes)));
  const start = new Date(now);
  start.setSeconds(0, 0);
  const end = new Date(start.getTime() + duration * 60_000);
  const date = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  const time = (value: Date) => `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  return { record: { id: `${task.id}_widget_${start.getTime().toString(36)}`, taskId: task.id, scheduledDate: date, scheduledStart: time(start), scheduledEnd: time(end), executionStatus: "scheduled", createdAt: start.toISOString() }, countdownTargetAt: end.getTime() };
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
    minWorkMinutes: normalizeInteger(value?.minWorkMinutes, DEFAULT_WIDGET_TIMER_PREFERENCES.minWorkMinutes!, 1, 180),
    maxWorkMinutes: normalizeInteger(value?.maxWorkMinutes, DEFAULT_WIDGET_TIMER_PREFERENCES.maxWorkMinutes!, 1, 240),
    longBreakMinutes: normalizeInteger(value?.longBreakMinutes, DEFAULT_WIDGET_TIMER_PREFERENCES.longBreakMinutes!, 1, 120),
    minBreakMinutes: normalizeInteger(value?.minBreakMinutes, DEFAULT_WIDGET_TIMER_PREFERENCES.minBreakMinutes!, 1, 60),
    minLongBreakMinutes: normalizeInteger(value?.minLongBreakMinutes, DEFAULT_WIDGET_TIMER_PREFERENCES.minLongBreakMinutes!, 1, 120),
    longBreakEvery: normalizeInteger(value?.longBreakEvery, DEFAULT_WIDGET_TIMER_PREFERENCES.longBreakEvery!, 1, 12),
    autoStartNextPhase: value?.autoStartNextPhase === true,
    allowWorkAdjustment: value?.allowWorkAdjustment !== false,
    allowBreakShortening: value?.allowBreakShortening !== false,
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
    pomodoro: ["focus", "break", "overrun"],
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
  if (mode === "pomodoro" && Array.isArray(value?.pomodoroPlan)) {
    runtime.pomodoroPlan = value!.pomodoroPlan;
    runtime.currentPomodoroPhaseIndex = Math.max(0, Math.min(runtime.pomodoroPlan.length - 1, Math.round(value?.currentPomodoroPhaseIndex || 0)));
  }
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
      if (typeof value?.countdownRecordId === "string") runtime.countdownRecordId = value.countdownRecordId;
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
  if (value.pomodoroPlan?.length) {
    return value.pomodoroPlan.filter((phase) => phase.type === "work").reduce((total, phase) => total + Math.max(0, Math.min(now, phase.endAt) - Math.max(from, phase.startAt)), 0);
  }
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
  if (runtime.mode === "countdown" && runtime.countdownRecordId) reset.countdownRecordId = runtime.countdownRecordId;
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
      if (runtime.mode === "pomodoro" && runtime.pomodoroPlan?.length) {
        const currentIndex = runtime.currentPomodoroPhaseIndex || 0;
        const next = runtime.pomodoroPlan[currentIndex + 1];
        if (!next) {
          runtime = { ...runtime, phase: "overrun", phaseStartedAt: transitionAt };
          delete runtime.phaseEndsAt;
          break;
        }
        transitions.push(runtime.phase === "focus" ? "focusComplete" : "breakComplete");
        runtime = { ...runtime, phase: next.type === "work" ? "focus" : "break", phaseStartedAt: next.startAt, phaseEndsAt: next.endAt, currentPomodoroPhaseIndex: currentIndex + 1, round: next.type === "work" ? runtime.round + 1 : runtime.round };
        continue;
      }
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
