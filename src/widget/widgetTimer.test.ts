import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  DEFAULT_WIDGET_TIMER_PREFERENCES,
  advanceTaskElapsedSeconds,
  advanceWidgetTimer,
  accumulateWidgetWorkTime,
  calculateWidgetWorkSeconds,
  countsWidgetTimerPhaseAsWork,
  createWidgetTimerModeTransition,
  createWidgetTimerRuntime,
  getWidgetTimerNotificationDescriptor,
  getWidgetTimerSnapshotDisplaySeconds,
  getStopwatchTaskTimerAction,
  getWidgetTimerModeChangeTaskAction,
  normalizeStoredTaskTimer,
  normalizeWidgetTimerRuntime,
  normalizeWidgetTimerPreferences,
  normalizeWidgetTimerMode,
  resetWidgetTimerRuntime,
  resolveWidgetCountdownTarget,
  taskDueDateTargetAt,
  scheduleWidgetCountdown,
  createDeadlineAlignedPomodoroRuntime,
} from "./widgetTimer";
import type { Task } from "../types";

describe("widget timer preferences", () => {
  it("normalizes a stored active task timer before restoring it", () => {
    expect(normalizeStoredTaskTimer({ taskId: "task-1", elapsed: 12.9 })).toEqual({
      taskId: "task-1",
      elapsedSeconds: 12,
    });
    expect(normalizeStoredTaskTimer({ taskId: "task-1", elapsed: "oops" })).toEqual({
      taskId: "task-1",
      elapsedSeconds: 0,
    });
    expect(normalizeStoredTaskTimer({ taskId: "task-1", elapsed: -5 })).toEqual({
      taskId: "task-1",
      elapsedSeconds: 0,
    });
    expect(normalizeStoredTaskTimer({ taskId: "task-1", elapsed: 1e308 })).toEqual({
      taskId: "task-1",
      elapsedSeconds: 0,
    });
    expect(normalizeStoredTaskTimer({ taskId: {}, elapsed: 10 })).toBeNull();
    expect(normalizeStoredTaskTimer({ taskId: "  ", elapsed: 10 })).toBeNull();
  });

  it("advances through a deadline-aligned plan and enters overtime after its final work phase", () => {
    const runtime = createDeadlineAlignedPomodoroRuntime(0, 70 * 60_000, DEFAULT_WIDGET_TIMER_PREFERENCES);
    expect(runtime.pomodoroPlan?.at(-1)).toMatchObject({ type: "work", endAt: 70 * 60_000 });
    const running = { ...runtime, running: true }; delete running.pausedAt;
    const advanced = advanceWidgetTimer(running, DEFAULT_WIDGET_TIMER_PREFERENCES, 70 * 60_000 + 1_000);
    expect(advanced).toMatchObject({ phase: "overrun", displaySeconds: 1 });
  });
  it("routes detailed settings timer Save and Reset through shared widget actions", () => {
    const mainSource = readFileSync(new URL("../main.tsx", import.meta.url), "utf8");
    expect(mainSource).toContain('onWidgetAction({ type: "saveTimerSettings", draft: widgetTimerDraft })');
    expect(mainSource).toContain('onWidgetAction({ type: "resetWidgetTimer", draft: widgetTimerDraft })');
    expect(mainSource).toContain('onClick={() => setWidgetTimerDraft(widgetTimerSettings)}');
  });

  it("uses the user-entered duration to schedule the active task from now", () => {
    const task = { id: "task-1" } as Task;
    const result = scheduleWidgetCountdown(task, new Date("2026-07-11T10:15:00"), 45);
    expect(result.record).toMatchObject({ scheduledDate: "2026-07-11", scheduledStart: "10:15", scheduledEndDate: "2026-07-11", scheduledEnd: "11:00", executionStatus: "scheduled" });
    expect(result.countdownTargetAt).toBe(new Date("2026-07-11T11:00:00").getTime());
  });

  it("keeps a schedule-now countdown across midnight", () => {
    const task = { id: "task-1" } as Task;
    const result = scheduleWidgetCountdown(task, new Date("2026-12-31T23:50:00"), 20);
    expect(result.record).toMatchObject({
      scheduledDate: "2026-12-31",
      scheduledStart: "23:50",
      scheduledEndDate: "2027-01-01",
      scheduledEnd: "00:10",
    });
    expect(result.countdownTargetAt).toBe(new Date("2027-01-01T00:10:00").getTime());
  });

  it("preserves a schedule-now target when saving a no-deadline countdown", () => {
    const task = { id: "task-1", dueDate: "" } as Task;
    const scheduled = scheduleWidgetCountdown(task, new Date("2026-07-11T10:15:00"), 45);
    const runtime = { ...createWidgetTimerRuntime("countdown", 1, DEFAULT_WIDGET_TIMER_PREFERENCES, scheduled.countdownTargetAt), countdownTaskId: task.id };
    expect(resolveWidgetCountdownTarget(task.dueDate, task.id, runtime)).toBe(scheduled.countdownTargetAt);
  });

  it("creates a paused Pomodoro reset runtime from the current draft", () => {
    const { runtime } = createWidgetTimerModeTransition("pomodoro", {
      ...DEFAULT_WIDGET_TIMER_PREFERENCES,
      mode: "pomodoro",
      focusMinutes: 10,
    }, 5_000);
    expect(runtime).toMatchObject({ mode: "pomodoro", phase: "focus", running: false, phaseEndsAt: 605_000, pausedAt: 5_000 });
  });

  it("creates one paused fresh runtime when switching modes", () => {
    expect(createWidgetTimerModeTransition("countdown", {
      ...DEFAULT_WIDGET_TIMER_PREFERENCES,
      mode: "pomodoro",
      countdownSeconds: 90,
    }, 12_345)).toEqual({
      preferences: { ...DEFAULT_WIDGET_TIMER_PREFERENCES, mode: "countdown", countdownSeconds: 90 },
      runtime: {
        mode: "countdown",
        phase: "countdown",
        running: false,
        round: 1,
        phaseStartedAt: 12_345,
        pausedAt: 12_345,
      },
    });
  });

  it("normalizes invalid durations and clamps supported ranges", () => {
    expect(normalizeWidgetTimerPreferences({
      mode: "invalid" as never,
      focusMinutes: 0,
      breakMinutes: Number.NaN,
      rounds: 100,
      countdownSeconds: -5,
    })).toEqual({
      ...DEFAULT_WIDGET_TIMER_PREFERENCES,
      rounds: 12,
    });
  });
});

describe("widget wall-clock timer", () => {
  const prefs = DEFAULT_WIDGET_TIMER_PREFERENCES;

  it("uses the end of the local due-date day as countdown target", () => {
    const target = taskDueDateTargetAt("2026-07-11");
    expect(new Date(target!).getHours()).toBe(23);
    expect(new Date(target!).getMinutes()).toBe(59);
  });

  it("enters overrun after an absolute countdown target", () => {
    const runtime = createWidgetTimerRuntime("countdown", 1_000, { ...prefs, mode: "countdown" }, 2_000);
    expect(advanceWidgetTimer(runtime, prefs, 2_001).runtime.phase).toBe("overrun");
  });

  it("keeps a paused deadline countdown pinned to its absolute target when resumed", () => {
    const runtime = createWidgetTimerRuntime("countdown", 1_000, { ...prefs, mode: "countdown" }, 2_000);
    const paused = { ...runtime, running: false, pausedAt: 1_500 };
    expect(advanceWidgetTimer({ ...paused, running: true }, prefs, 1_800).runtime.phaseEndsAt).toBe(2_000);
  });

  it("leaves an unscheduled countdown without a deadline target", () => {
    const runtime = createWidgetTimerRuntime("countdown", 1_000, { ...prefs, mode: "countdown" });
    expect(runtime).not.toHaveProperty("countdownTargetAt");
    expect(runtime).not.toHaveProperty("phaseEndsAt");
  });

  it("resets a deadline countdown as paused without losing its target", () => {
    const running = createWidgetTimerRuntime("countdown", 1_000, { ...prefs, mode: "countdown" }, 2_000);
    expect(resetWidgetTimerRuntime(running, prefs, 1_500)).toMatchObject({
      running: false,
      pausedAt: 1_500,
      countdownTargetAt: 2_000,
      phaseEndsAt: 2_000,
    });
  });

  it("advances task elapsed time by wall clock after a delayed tick", () => {
    expect(advanceTaskElapsedSeconds(12, 1_000, 6_750)).toBe(17);
  });

  it("counts only focus time when catch-up crosses focus and break", () => {
    const shortPrefs = { ...prefs, focusMinutes: 1, breakMinutes: 1 };
    const runtime = createWidgetTimerRuntime("pomodoro", 0, shortPrefs);
    expect(calculateWidgetWorkSeconds(runtime, shortPrefs, 0, 150_000)).toBe(90);
  });

  it("preserves fractional work across multiple delayed ticks", () => {
    const runtime = createWidgetTimerRuntime("pomodoro", 0, { ...prefs, focusMinutes: 1 });
    const first = accumulateWidgetWorkTime(runtime, prefs, 0, 1_500, 0);
    const second = accumulateWidgetWorkTime(runtime, prefs, 1_500, 3_000, first.remainderMs);
    expect(first).toEqual({ wholeSeconds: 1, remainderMs: 500 });
    expect(second).toEqual({ wholeSeconds: 2, remainderMs: 0 });

    let remainderMs = 0;
    let totalSeconds = 0;
    for (let tick = 0; tick < 3; tick += 1) {
      const result = accumulateWidgetWorkTime(runtime, prefs, tick * 400, (tick + 1) * 400, remainderMs);
      totalSeconds += result.wholeSeconds;
      remainderMs = result.remainderMs;
    }
    expect({ totalSeconds, remainderMs }).toEqual({ totalSeconds: 1, remainderMs: 200 });
  });

  it("projects stopwatch display from the existing task timer base", () => {
    expect(getWidgetTimerSnapshotDisplaySeconds("stopwatch", 999, 42, true, 10_000, 13_900)).toBe(45);
  });

  it("pauses a stopwatch from the true running task timer and captures wall-clock time", () => {
    expect(getStopwatchTaskTimerAction("task-1", 42, 10_000, 13_900)).toEqual({
      type: "pause",
      elapsedSeconds: 45,
    });
  });

  it("resumes a stopwatch from the true paused task timer", () => {
    expect(getStopwatchTaskTimerAction("task-1", 45, null, 13_900)).toEqual({
      type: "resume",
      elapsedSeconds: 45,
    });
  });

  it("captures a truly running stopwatch before a mode reset even when widget runtime is stale", () => {
    expect(getWidgetTimerModeChangeTaskAction("stopwatch", "task-1", 42, 10_000, 13_900)).toEqual({
      type: "pause",
      elapsedSeconds: 45,
    });
  });

  it("normalizes an inconsistent persisted runtime against preferences", () => {
    expect(normalizeWidgetTimerRuntime({
      mode: "pomodoro",
      phase: "overrun",
      running: false,
      round: 99,
      phaseStartedAt: Number.NaN,
      phaseEndsAt: -10,
    }, { ...prefs, mode: "countdown", countdownSeconds: 60 }, 50_000)).toEqual({
      mode: "countdown",
      phase: "countdown",
      running: false,
      round: 4,
      phaseStartedAt: 50_000,
      pausedAt: 50_000,
    });
  });

  it("drops a legacy duration countdown endpoint that has no absolute target", () => {
    expect(normalizeWidgetTimerRuntime({
      mode: "countdown",
      phase: "countdown",
      running: false,
      round: 1,
      phaseStartedAt: 1_000,
      phaseEndsAt: 60_000,
    }, { ...prefs, mode: "countdown" }, 2_000)).toMatchObject({
      mode: "countdown",
      phase: "countdown",
      running: false,
    });
    expect(normalizeWidgetTimerRuntime({
      mode: "countdown",
      phase: "countdown",
      running: false,
      round: 1,
      phaseStartedAt: 1_000,
      phaseEndsAt: 60_000,
    }, { ...prefs, mode: "countdown" }, 2_000)).not.toHaveProperty("phaseEndsAt");
  });

  it("pauses a running legacy countdown that has no absolute target", () => {
    expect(normalizeWidgetTimerRuntime({
      mode: "countdown",
      phase: "countdown",
      running: true,
      round: 1,
      phaseStartedAt: 1_000,
      phaseEndsAt: 60_000,
    }, { ...prefs, mode: "countdown" }, 2_000)).toEqual({
      mode: "countdown",
      phase: "countdown",
      running: false,
      round: 1,
      phaseStartedAt: 1_000,
      pausedAt: 2_000,
    });
  });

  it("coerces an invalid IPC timer mode to the current mode", () => {
    expect(normalizeWidgetTimerMode("invalid", "pomodoro")).toBe("pomodoro");
  });

  it("continues a completed countdown as positive overrun time", () => {
    expect(advanceWidgetTimer(
      createWidgetTimerRuntime("countdown", 0, { ...prefs, countdownSeconds: 60 }, 60_000),
      prefs,
      61_000,
    )).toMatchObject({ phase: "overrun", displaySeconds: 1, transitions: ["countdownComplete"] });
  });

  it("moves from focus to break at the focus deadline", () => {
    expect(advanceWidgetTimer(
      createWidgetTimerRuntime("pomodoro", 0, prefs),
      prefs,
      25 * 60_000,
    )).toMatchObject({ phase: "break", round: 1, transitions: ["focusComplete"] });
  });

  it("catches up across multiple pomodoro phases after sleep", () => {
    const focusRuntime = createWidgetTimerRuntime("pomodoro", 0, prefs);
    expect(advanceWidgetTimer(focusRuntime, prefs, 30 * 60_000)).toMatchObject({
      phase: "focus",
      round: 2,
      transitions: ["focusComplete", "breakComplete"],
    });
  });

  it("cycles directly from the final break to focus without a long-break phase", () => {
    const shortPrefs = { ...prefs, focusMinutes: 1, breakMinutes: 1, rounds: 2 };
    expect(advanceWidgetTimer(
      createWidgetTimerRuntime("pomodoro", 0, shortPrefs),
      shortPrefs,
      4 * 60_000,
    )).toMatchObject({
      phase: "focus",
      round: 1,
      transitions: ["focusComplete", "breakComplete", "focusComplete", "breakComplete"],
    });
  });

  it("freezes while paused and shifts timestamps when resumed", () => {
    const running = {
      ...createWidgetTimerRuntime("countdown", 0, { ...prefs, countdownSeconds: 60 }),
      phaseEndsAt: 60_000,
    };
    const paused = { ...running, running: false, pausedAt: 10_000 };
    expect(advanceWidgetTimer(paused, prefs, 40_000)).toMatchObject({
      phase: "countdown",
      displaySeconds: 50,
      transitions: [],
    });

    const resumed = advanceWidgetTimer({ ...paused, running: true }, prefs, 40_000);
    expect(resumed.runtime).toMatchObject({
      phaseStartedAt: 30_000,
      phaseEndsAt: 90_000,
    });
    expect(resumed.runtime).not.toHaveProperty("pausedAt");
    expect(resumed.displaySeconds).toBe(50);
  });

  it.each([
    ["stopwatch", true],
    ["focus", true],
    ["break", false],
    ["countdown", true],
    ["overrun", true],
  ] as const)("reports whether %s counts as task work", (phase, expected) => {
    expect(countsWidgetTimerPhaseAsWork(phase)).toBe(expected);
  });

  it("maps emitted phase transitions to localized notification descriptors", () => {
    const runtime = createWidgetTimerRuntime("pomodoro", 0, prefs);
    const transitions = advanceWidgetTimer(runtime, prefs, 30 * 60_000).transitions;

    expect(transitions.map((transition) => getWidgetTimerNotificationDescriptor(transition, "en"))).toEqual([
      { title: "Focus complete", body: "Time for a break." },
      { title: "Break complete", body: "Ready for the next focus round." },
    ]);
    expect(getWidgetTimerNotificationDescriptor("countdownComplete", "zh")).toEqual({
      title: "倒计时结束",
      body: "已开始超时计时。",
    });
  });
});
