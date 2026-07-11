import { describe, expect, it } from "vitest";
import {
  DEFAULT_WIDGET_TIMER_PREFERENCES,
  advanceWidgetTimer,
  createWidgetTimerRuntime,
  normalizeWidgetTimerPreferences,
} from "./widgetTimer";

describe("widget timer preferences", () => {
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
});
