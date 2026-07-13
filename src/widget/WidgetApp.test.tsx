import { readFileSync } from "node:fs";
import { Children, isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it } from "vitest";
import type { WidgetSnapshot } from "../types";
import { TimerModeTabs, WidgetPopoverUtilities, WidgetPopoverView, WidgetTimerSettingsView, WidgetView, didWidgetPointerDrag, getAdjacentTimerMode, getWidgetResizeDirection, getWidgetResizeFixedEdges, opacityAction, requiresRunningTimerModeConfirmation, resizeWidgetBounds, shouldToggleTimerClick, withPopoverState } from "./WidgetApp";

const snapshot: WidgetSnapshot = {
  taskId: "task-1",
  taskTitle: "Write a long application essay title",
  elapsedSeconds: 125,
  timerRunning: true,
  candidateCount: 3,
  lang: "en",
  alwaysOnTop: true,
  appearanceConfigured: true,
  theme: "light",
  appearance: {
    light: { backgroundColor: "#FBF9FF", fontColor: "#27231E", timerColor: "#5D9B63", overrunColor: "#B34F47" },
    dark: { backgroundColor: "#27231E", fontColor: "#EEE9DF", timerColor: "#70D978", overrunColor: "#E27C68" },
    opacity: 0.96,
    fontFamily: "system-ui, sans-serif",
    fontScale: 1,
    version: 2,
  },
  timerPreferences: { mode: "pomodoro", focusMinutes: 25, breakMinutes: 5, rounds: 4, countdownSeconds: 900 },
  timerRuntime: { mode: "pomodoro", phase: "focus", running: true, round: 1, phaseStartedAt: 1, phaseEndsAt: 2 },
  timerDisplaySeconds: 125,
  timerPhase: "focus",
  popoverOpen: false,
};

it("requires confirmation only when switching away from a running mode", () => {
  expect(requiresRunningTimerModeConfirmation(true, "stopwatch", "pomodoro")).toBe(true);
  expect(requiresRunningTimerModeConfirmation(false, "stopwatch", "pomodoro")).toBe(false);
  expect(requiresRunningTimerModeConfirmation(true, "pomodoro", "pomodoro")).toBe(false);
});

const reactActEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };

describe("WidgetView", () => {
  it("identifies all eight handles and keeps the opposite edge stable", () => {
    const bounds = { x: 0, y: 0, width: 400, height: 80 };
    const workArea = { x: 0, y: 0, width: 1280, height: 720 };
    expect(getWidgetResizeDirection({ x: 0, y: 0 }, bounds, 8)).toBe("nw");
    expect(getWidgetResizeDirection({ x: 399, y: 0 }, bounds, 8)).toBe("ne");
    expect(getWidgetResizeDirection({ x: 399, y: 40 }, bounds, 8)).toBe("e");
    expect(getWidgetResizeDirection({ x: 399, y: 79 }, bounds, 8)).toBe("se");
    expect(getWidgetResizeDirection({ x: 200, y: 79 }, bounds, 8)).toBe("s");
    expect(getWidgetResizeDirection({ x: 0, y: 79 }, bounds, 8)).toBe("sw");
    expect(getWidgetResizeDirection({ x: 0, y: 40 }, bounds, 8)).toBe("w");
    expect(getWidgetResizeDirection({ x: 200, y: 0 }, bounds, 8)).toBe("n");
    expect(resizeWidgetBounds({ x: 100, y: 100, width: 400, height: 80 }, "w", { x: 30, y: 0 }, workArea)).toMatchObject({ x: 130, width: 370 });
    expect(resizeWidgetBounds({ x: 100, y: 100, width: 128, height: 80 }, "w", { x: 30, y: 0 }, workArea)).toMatchObject({ x: 100, width: 128 });
  });

  it("labels the opposite edges as fixed for native resize clamping", () => {
    expect(getWidgetResizeFixedEdges("nw")).toEqual({ horizontal: "right", vertical: "bottom" });
    expect(getWidgetResizeFixedEdges("e")).toEqual({ horizontal: "left" });
    expect(getWidgetResizeFixedEdges("s")).toEqual({ vertical: "top" });
  });

  it("renders eight no-drag resize handles without a localStorage bounds loop", () => {
    const html = renderToStaticMarkup(<WidgetView snapshot={snapshot} density="full" onToggleTimer={() => undefined} onTogglePopover={() => undefined} onMove={() => undefined} onResize={() => undefined} />);
    for (const direction of ["n", "ne", "e", "se", "s", "sw", "w", "nw"]) expect(html).toContain(`df-widget-resize-handle is-${direction}`);
    const source = readFileSync(new URL("./WidgetApp.tsx", import.meta.url), "utf8");
    expect(source).not.toContain("navopath-widget-bounds");
    expect(source).not.toContain("restoreStoredWidgetBounds");
  });

  it("keeps both settings reset paths aligned with the native compact default", () => {
    const mainSource = readFileSync(new URL("../main.tsx", import.meta.url), "utf8");
    expect(mainSource).not.toContain('localStorage.removeItem("navopath-widget-bounds")');
    expect(mainSource.match(/setBounds\(\{ x: 80, y: 80, width: 400, height: 80 \}\)/g)).toHaveLength(2);
    expect(mainSource).not.toContain("Restore 500");
  });

  it("blocks legacy duration countdowns without an absolute task target", () => {
    const mainSource = readFileSync(new URL("../main.tsx", import.meta.url), "utf8");
    expect(mainSource).toContain('if (current.mode === "countdown" && current.countdownTargetAt === undefined) break;');
  });

  it("renders task, timer, Pause, and More at full density", () => {
    const html = renderToStaticMarkup(<WidgetView snapshot={snapshot} density="full" onToggleTimer={() => undefined} onTogglePopover={() => undefined} onMove={() => undefined} onResize={() => undefined} />);
    expect(html).toContain(snapshot.taskTitle);
    expect(html).toContain("2:05");
    expect(html).toContain('aria-label="Focusing — click to pause"');
    expect(html).toContain('aria-label="More"');
    expect(html).not.toContain("Working");
    expect(html).not.toContain("project-footer");
  });

  it("renders timer and More without title or primary control at timer-controls density", () => {
    const html = renderToStaticMarkup(<WidgetView snapshot={snapshot} density="timerControls" onToggleTimer={() => undefined} onTogglePopover={() => undefined} onMove={() => undefined} onResize={() => undefined} />);
    expect(html).toContain("2:05");
    expect(html).toContain('aria-label="More"');
    expect(html).not.toContain(snapshot.taskTitle);
    expect(html).not.toContain('aria-label="Pause timer"');
  });

  it("renders only the timer at time-only density", () => {
    const html = renderToStaticMarkup(<WidgetView snapshot={snapshot} density="timerOnly" onToggleTimer={() => undefined} onTogglePopover={() => undefined} onMove={() => undefined} onResize={() => undefined} />);
    expect(html).toContain("2:05");
    expect(html).not.toContain(snapshot.taskTitle);
    expect(html).not.toContain('aria-label="More"');
  });

  it("uses the active theme and overrun phase without replacing More", () => {
    const html = renderToStaticMarkup(<WidgetView snapshot={{ ...snapshot, theme: "dark", timerPhase: "overrun", popoverOpen: true }} density="full" onToggleTimer={() => undefined} onTogglePopover={() => undefined} onMove={() => undefined} onResize={() => undefined} />);
    expect(html).toContain('data-theme="dark"');
    expect(html).toContain('data-phase="overrun"');
    expect(html).toContain('aria-label="More"');
  });

  it("lets native popover events override stale snapshot state in both directions", () => {
    expect(withPopoverState(snapshot, true).popoverOpen).toBe(true);
    expect(withPopoverState({ ...snapshot, popoverOpen: true }, false).popoverOpen).toBe(false);
  });

  it("treats movement beyond 5px as drag, but not exactly 5px", () => {
    expect(didWidgetPointerDrag({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(false);
    expect(didWidgetPointerDrag({ x: 0, y: 0 }, { x: 4, y: 4 })).toBe(true);
  });

  it("keeps drag detection separate from the Play/Pause action", () => {
    expect(shouldToggleTimerClick(false)).toBe(true);
    expect(shouldToggleTimerClick(true)).toBe(false);
    const source = readFileSync(new URL("./WidgetApp.tsx", import.meta.url), "utf8");
    expect(source).toContain('type: "toggleWidgetTimer"');
  });

  it("normalizes opacity updates into a widget action", () => {
    expect(opacityAction(2)).toEqual({ type: "updateWidgetAppearance", patch: { opacity: 1 } });
    expect(opacityAction(-1)).toEqual({ type: "updateWidgetAppearance", patch: { opacity: 0 } });
  });
});

describe("WidgetPopoverView", () => {
  const render = (next: WidgetSnapshot) => renderToStaticMarkup(<WidgetPopoverView snapshot={next} onClosePopover={() => undefined} onCloseWidget={() => undefined} onSaveTimerSettings={() => undefined} onResetTimer={() => undefined} onSchedule={() => undefined} onToggleAlwaysOnTop={() => undefined} onOpacityChange={() => undefined} />);

  it("renders Reset, Pin, PinOff, and close icon controls for the More panel", () => {
    expect(render({ ...snapshot, alwaysOnTop: false })).toContain('aria-label="Pin widget"');
    const pinnedHtml = render(snapshot);
    expect(pinnedHtml).toContain('aria-label="Unpin widget"');
    expect(pinnedHtml).toContain('aria-label="Close widget"');
    expect(pinnedHtml).toContain('aria-label="Reset timer"');
    expect(pinnedHtml.indexOf('aria-label="Reset timer"')).toBeLessThan(pinnedHtml.indexOf('aria-label="Unpin widget"'));
    const source = readFileSync(new URL("./WidgetApp.tsx", import.meta.url), "utf8");
    expect(source).toContain("<Pin ");
    expect(source).toContain("<PinOff ");
    expect(source).toContain("<X ");
    expect(source).toContain("<RotateCcw ");
  });

  const countdownWithoutDeadline: WidgetSnapshot = {
    ...snapshot,
    taskId: "task-without-deadline",
    timerPreferences: { ...snapshot.timerPreferences, mode: "countdown" },
    timerRuntime: { mode: "countdown", phase: "countdown", running: false, round: 1, phaseStartedAt: 1, pausedAt: 1 },
  };

  it("renders the compact resting controls without a visible More heading", () => {
    const html = render(countdownWithoutDeadline);
    expect(html).not.toContain(">More<");
    expect(html).not.toContain("Timer settings");
    expect(html).toContain('class="df-widget-popover-utilities"');
    expect(html).toContain('class="df-widget-opacity-row"');
    expect(html).not.toContain('class="df-widget-mode-description"');
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain("Stopwatch");
    expect(html).toContain("Pomodoro");
    expect(html).toContain("Countdown");
    expect(html).toContain('aria-label="Close widget"');
    expect(html).not.toContain('aria-label="Close More"');
  });

  it("selects a mode through the tab interaction and reveals its inline details state", () => {
    let selected = snapshot.timerPreferences.mode;
    const tabs = TimerModeTabs({ lang: "en", mode: selected, onSelect: (mode) => { selected = mode; } });
    const pomodoro = Children.toArray(tabs.props.children).find((child) => isValidElement<{ "data-mode": string }>(child) && child.props["data-mode"] === "pomodoro") as ReactElement<{ onClick: () => void }>;
    pomodoro.props.onClick();
    expect(selected).toBe("pomodoro");
    const html = renderToStaticMarkup(<WidgetTimerSettingsView snapshot={{ ...snapshot, timerPreferences: { ...snapshot.timerPreferences, mode: selected } }} onSave={() => undefined} onCancel={() => undefined} onReset={() => undefined} onSchedule={() => undefined} />);
    expect(html).toContain("Preferred focus");
    expect(html).toContain("Short break");
    expect(html).toContain("Long break every");
  });

  it("uses Pomodoro phase icons only for a running Pomodoro and does not pause countdowns", () => {
    const renderWidget = (next: WidgetSnapshot) => renderToStaticMarkup(<WidgetView snapshot={next} density="full" onToggleTimer={() => undefined} onTogglePopover={() => undefined} onMove={() => undefined} onResize={() => undefined} />);
    expect(renderWidget(snapshot)).toContain('lucide-cherry');
    expect(renderWidget({ ...snapshot, timerRuntime: { ...snapshot.timerRuntime, phase: "break" }, timerPhase: "break" })).toContain('lucide-sprout');
    const countdown = renderWidget({ ...snapshot, timerPreferences: { ...snapshot.timerPreferences, mode: "countdown" }, timerRuntime: { mode: "countdown", phase: "countdown", running: true, round: 1, phaseStartedAt: 1, phaseEndsAt: 2 }, timerPhase: "countdown", timerRunning: false });
    expect(countdown).not.toContain('aria-label="Pause timer"');
    expect(countdown).not.toContain('lucide-pause');
    expect(countdown).not.toContain('lucide-cherry');
  });

  it("previews hovered mode guidance at the pointer without changing the selected mode", async () => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(timerSettings({ ...snapshot, timerPreferences: { ...snapshot.timerPreferences, mode: "stopwatch" } })); });
    const pomodoro = renderer.root.findByProps({ "data-mode": "pomodoro" });
    await act(async () => { pomodoro.props.onPointerEnter({ clientX: 80, clientY: 42 }); });
    const tooltip = renderer.root.findByProps({ role: "tooltip" });
    expect(tooltip.children.join("")).toContain("task deadline");
    expect(tooltip.props.style).toMatchObject({ left: 88, top: 50 });
    expect(renderer.root.findByProps({ "data-mode": "stopwatch" }).props["aria-checked"]).toBe(true);
    await act(async () => { pomodoro.props.onPointerLeave(); });
    expect(renderer.root.findAllByProps({ role: "tooltip" })).toHaveLength(0);
    await act(async () => { renderer.unmount(); });
  });

  it("previews a deadline-aligned Pomodoro plan inside the same popover", () => {
    const start = new Date("2026-07-13T14:00:00").getTime();
    const html = renderToStaticMarkup(<WidgetTimerSettingsView snapshot={{ ...snapshot, taskScheduleStartAt: start, taskScheduleEndAt: start + 70 * 60_000, timerPreferences: { ...snapshot.timerPreferences, mode: "pomodoro" } } as WidgetSnapshot} onSave={() => undefined} onCancel={() => undefined} onReset={() => undefined} onSchedule={() => undefined} />);
    expect(html).toContain("Plan preview");
    expect(html).toContain("Focus cycles");
    expect(html).toContain("15:10");
  });

  it("routes reset and close utility callbacks", () => {
    let closedWidget = false;
    let reset = false;
    const utilities = WidgetPopoverUtilities({ lang: "en", alwaysOnTop: false, onResetTimer: () => { reset = true; }, onToggleAlwaysOnTop: () => undefined, onCloseWidget: () => { closedWidget = true; } });
    const buttons = Children.toArray(utilities.props.children).filter(isValidElement) as ReactElement<{ onClick: () => void; "aria-label": string }>[];
    expect(buttons.map((button) => button.props["aria-label"])).toEqual(["Reset timer", "Pin widget", "Close widget"]);
    buttons[0].props.onClick();
    buttons[2].props.onClick();
    expect(reset).toBe(true);
    expect(closedWidget).toBe(true);
  });

  const timerSettings = (next: WidgetSnapshot) => <WidgetTimerSettingsView snapshot={next} onSave={() => undefined} onCancel={() => undefined} onReset={() => undefined} onSchedule={() => undefined} />;

  it("preserves unsaved mode, number, and duration edits across equal-preference rerenders", async () => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(timerSettings(snapshot)); });
    await act(async () => { renderer.root.findByProps({ "data-mode": "countdown" }).props.onClick(); });
    const inputs = renderer.root.findAllByType("input");
    await act(async () => {
      inputs[0].props.onChange({ target: { value: "1234" } });
      inputs[1].props.onChange({ target: { value: "37" } });
    });
    await act(async () => { renderer.update(timerSettings({ ...snapshot, elapsedSeconds: 126, timerPreferences: { ...snapshot.timerPreferences } })); });
    expect(renderer.root.findByProps({ "data-mode": "countdown" }).props["aria-checked"]).toBe(true);
    expect(renderer.root.findAllByType("input").map((input) => input.props.value)).toEqual([1234, "37"]);
    await act(async () => { renderer.unmount(); });
  });

  it("resets the mounted draft when timer preference primitive values change", async () => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(timerSettings(snapshot)); });
    await act(async () => { renderer.root.findByProps({ "data-mode": "countdown" }).props.onClick(); });
    const changed = { ...snapshot, timerPreferences: { ...snapshot.timerPreferences, mode: "stopwatch" as const, countdownSeconds: 1800 } };
    await act(async () => { renderer.update(timerSettings(changed)); });
    expect(renderer.root.findByProps({ "data-mode": "stopwatch" }).props["aria-checked"]).toBe(true);
    expect(renderer.root.findByProps({ className: "df-widget-no-duration" }).children).toEqual(["No duration"]);
    await act(async () => { renderer.unmount(); });
  });

  it("keeps tabs and actions outside the fields-only scrolling region", () => {
    const html = renderToStaticMarkup(<WidgetTimerSettingsView snapshot={countdownWithoutDeadline} onSave={() => undefined} onCancel={() => undefined} onReset={() => undefined} onSchedule={() => undefined} />);
    const tabs = html.indexOf('class="df-widget-mode-switch"');
    const detailsOpen = html.indexOf('class="df-widget-mode-details"');
    const guidance = html.indexOf('class="df-widget-schedule-guidance"');
    const detailsClose = html.indexOf('</div><div class="df-widget-timer-settings-actions"');
    const actions = html.indexOf('class="df-widget-timer-settings-actions"');
    expect(tabs).toBeLessThan(detailsOpen);
    expect(guidance).toBeGreaterThan(detailsOpen);
    expect(detailsClose).toBeGreaterThan(guidance);
    expect(actions).toBeGreaterThan(detailsClose);
  });

  it("shows scheduling guidance for a countdown without a task deadline", () => {
    const html = renderToStaticMarkup(<WidgetTimerSettingsView snapshot={countdownWithoutDeadline} onSave={() => undefined} onCancel={() => undefined} onReset={() => undefined} onSchedule={() => undefined} />);
    expect(html).toContain("Please schedule it on the timeline first");
    expect(html).toContain("Schedule for now");
  });

  it("does not require scheduling when a task due date can supply a countdown target", () => {
    const html = renderToStaticMarkup(<WidgetTimerSettingsView snapshot={{ ...countdownWithoutDeadline, taskDueDate: "2026-07-12" }} onSave={() => undefined} onCancel={() => undefined} onReset={() => undefined} onSchedule={() => undefined} />);
    expect(html).not.toContain("Please schedule it on the timeline first");
    expect(html).not.toContain("Schedule for now");
  });

  it("renders timer mode fields only in the draft settings view", () => {
    const html = renderToStaticMarkup(<WidgetTimerSettingsView snapshot={snapshot} onSave={() => undefined} onCancel={() => undefined} onReset={() => undefined} onSchedule={() => undefined} />);
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain("Stopwatch");
    expect(html).toContain("Pomodoro");
    expect(html).toContain("Countdown");
    expect(html).toContain("Preferred focus");
    expect(html).toContain("Short break");
    expect(html).toContain("Long break every");
    expect(render(snapshot)).toContain('aria-label="Close widget"');
    expect((html.match(/tabindex="0"/g) ?? [])).toHaveLength(1);
    expect((html.match(/tabindex="-1"/g) ?? [])).toHaveLength(2);
  });

  it("wraps radiogroup keyboard selection in both directions", () => {
    expect(getAdjacentTimerMode("stopwatch", "ArrowRight")).toBe("pomodoro");
    expect(getAdjacentTimerMode("stopwatch", "ArrowLeft")).toBe("countdown");
    expect(getAdjacentTimerMode("pomodoro", "ArrowDown")).toBe("countdown");
    expect(getAdjacentTimerMode("pomodoro", "ArrowUp")).toBe("stopwatch");
    expect(getAdjacentTimerMode("pomodoro", "Enter")).toBeNull();
    const source = readFileSync(new URL("./WidgetApp.tsx", import.meta.url), "utf8");
    expect(source).toContain("onKeyDown={(event) => onKeyDown(event, itemMode)}");
  });

  it("shows countdown presets only in the timer settings view", () => {
    const html = renderToStaticMarkup(<WidgetTimerSettingsView snapshot={{ ...snapshot, timerPreferences: { ...snapshot.timerPreferences, mode: "countdown" }, timerRuntime: { mode: "countdown", phase: "countdown", running: false, round: 1, phaseStartedAt: 1, countdownTargetAt: Date.now() + 60_000 } }} onSave={() => undefined} onCancel={() => undefined} onReset={() => undefined} onSchedule={() => undefined} />);
    for (const minutes of [15, 25, 45, 60]) expect(html).toContain(`>${minutes}<`);
    expect(html).toContain("Temporary duration");
    const restingHtml = render(snapshot);
    expect(restingHtml).toContain("Background opacity");
    expect(restingHtml).toContain('aria-label="Unpin widget"');
    expect(restingHtml).not.toContain("Shadow");
    expect(restingHtml).not.toContain("Font family");
    expect(restingHtml).not.toContain("Reset position");
  });

  it("shows no duration input for stopwatch settings", () => {
    const html = renderToStaticMarkup(<WidgetTimerSettingsView snapshot={{ ...snapshot, timerPreferences: { ...snapshot.timerPreferences, mode: "stopwatch" } }} onSave={() => undefined} onCancel={() => undefined} onReset={() => undefined} onSchedule={() => undefined} />);
    expect(html).toContain("No duration");
    expect(html).not.toContain('type="number"');
  });

  it("uses scoped container scaling and reduced-motion overrun styling", () => {
    const css = readFileSync(new URL("./widget.css", import.meta.url), "utf8");
    expect(css).toContain("container-type: size");
    expect(css).toMatch(/font-size:\s*clamp\([^;]*cqh/);
    expect(css).toContain("data-phase=\"overrun\"");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toMatch(/\.df-widget-number-row input\s*\{[^}]*min-height:\s*44px/);
    expect(css).toMatch(/\.df-widget-presets button\s*\{[^}]*min-height:\s*44px/);
    expect(css).toMatch(/\.df-widget-opacity-row input\s*\{[^}]*min-height:\s*44px/);
    expect(css).toMatch(/\.df-widget-timer\s*\{[^}]*min-height:\s*44px/);
    expect(css).toMatch(/\.df-widget-icon-btn\s*\{[^}]*width:\s*clamp\(44px,/);
    expect(css).toMatch(/\.df-widget-icon-btn\s*\{[^}]*height:\s*clamp\(44px,/);
  });

  it("uses a compact token-driven inline popover without purple, shadow, lift, or filled tabs", () => {
    const css = readFileSync(new URL("./widget.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.df-widget-popover-surface\s*\{[^}]*overflow:\s*hidden/);
    expect(css).toMatch(/\.df-widget-popover-utilities\s*\{[^}]*justify-content:\s*flex-end/);
    expect(css).toMatch(/\.df-widget-opacity-row\s*\{[^}]*grid-template-columns:\s*auto minmax\(0, 1fr\) auto/);
    expect(css).toMatch(/\.df-widget-mode-switch button\.is-selected\s*\{[^}]*border-bottom:\s*1px solid var\(--widget-ink\)/);
    expect(css).toMatch(/\.df-widget-mode-details\s*\{[^}]*overflow-y:\s*auto/);
    expect(css).toMatch(/\.df-widget-timer-settings-view\s*\{[^}]*min-height:\s*0/);
    expect(css).toMatch(/\.df-widget-timer-settings-view > \.df-widget-mode-switch, \.df-widget-timer-settings-actions\s*\{[^}]*flex:\s*0 0 auto/);
    expect(css).not.toMatch(/#[a-f\d]{6}/i);
    expect(css).not.toContain("box-shadow");
    expect(css).not.toContain("translateY");
  });

  it("removes every widget shadow control and visual shadow", () => {
    const source = readFileSync(new URL("./WidgetApp.tsx", import.meta.url), "utf8");
    const css = readFileSync(new URL("./widget.css", import.meta.url), "utf8");
    const mainSource = readFileSync(new URL("../main.tsx", import.meta.url), "utf8");
    expect(source).not.toContain("shadowEnabled");
    expect(source).not.toContain("setWidgetShadow");
    expect(css).not.toContain("box-shadow");
    expect(mainSource).not.toContain("setWidgetShadow");
    expect(mainSource).not.toContain("shadowEnabled");
  });
});
