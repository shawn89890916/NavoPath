import { describe, expect, it } from "vitest";
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
  normalizeWidgetTimerRuntime,
  normalizeWidgetTimerPreferences,
  normalizeWidgetTimerMode,
} from "./widgetTimer";

describe("widget timer preferences", () => {
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
        phaseEndsAt: 102_345,
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
      phaseEndsAt: 110_000,
      pausedAt: 50_000,
    });
  });

  it("coerces an invalid IPC timer mode to the current mode", () => {
    expect(normalizeWidgetTimerMode("invalid", "pomodoro")).toBe("pomodoro");
  });

  it("continues a completed countdown as positive overrun time", () => {
    expect(advanceWidgetTimer(
      createWidgetTimerRuntime("countdown", 0, { ...prefs, countdownSeconds: 60 }),
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
    const running = createWidgetTimerRuntime("countdown", 0, { ...prefs, countdownSeconds: 60 });
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
