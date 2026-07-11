import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { WidgetSnapshot } from "../types";
import { WidgetPopoverView, WidgetView, didWidgetPointerDrag, getAdjacentTimerMode, getWidgetResizeDirection, opacityAction, resizeWidgetBounds, shouldToggleTimerClick, withPopoverState } from "./WidgetApp";

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
    shadowEnabled: true,
    version: 2,
  },
  timerPreferences: { mode: "pomodoro", focusMinutes: 25, breakMinutes: 5, rounds: 4, countdownSeconds: 900 },
  timerRuntime: { mode: "pomodoro", phase: "focus", running: true, round: 1, phaseStartedAt: 1, phaseEndsAt: 2 },
  timerDisplaySeconds: 125,
  timerPhase: "focus",
  popoverOpen: false,
};

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

  it("renders eight no-drag resize handles without a localStorage bounds loop", () => {
    const html = renderToStaticMarkup(<WidgetView snapshot={snapshot} density="full" onToggleTimer={() => undefined} onTogglePopover={() => undefined} onCloseWidget={() => undefined} onMove={() => undefined} onResize={() => undefined} />);
    for (const direction of ["n", "ne", "e", "se", "s", "sw", "w", "nw"]) expect(html).toContain(`df-widget-resize-handle is-${direction}`);
    const source = readFileSync(new URL("./WidgetApp.tsx", import.meta.url), "utf8");
    expect(source).not.toContain("navopath-widget-bounds");
    expect(source).not.toContain("restoreStoredWidgetBounds");
  });

  it("renders only task, timer, and More at full density", () => {
    const html = renderToStaticMarkup(<WidgetView snapshot={snapshot} density="full" onToggleTimer={() => undefined} onTogglePopover={() => undefined} onCloseWidget={() => undefined} onMove={() => undefined} onResize={() => undefined} />);
    expect(html).toContain(snapshot.taskTitle);
    expect(html).toContain("2:05");
    expect(html).toContain('aria-label="More"');
    expect(html).not.toContain("Working");
    expect(html).not.toContain("Play");
    expect(html).not.toContain("project-footer");
  });

  it("renders only the timer at time-only density", () => {
    const html = renderToStaticMarkup(<WidgetView snapshot={snapshot} density="timerOnly" onToggleTimer={() => undefined} onTogglePopover={() => undefined} onCloseWidget={() => undefined} onMove={() => undefined} onResize={() => undefined} />);
    expect(html).toContain("2:05");
    expect(html).not.toContain(snapshot.taskTitle);
    expect(html).not.toContain('aria-label="More"');
  });

  it("uses the active theme, overrun phase, and red close-widget affordance", () => {
    const html = renderToStaticMarkup(<WidgetView snapshot={{ ...snapshot, theme: "dark", timerPhase: "overrun", popoverOpen: true }} density="full" onToggleTimer={() => undefined} onTogglePopover={() => undefined} onCloseWidget={() => undefined} onMove={() => undefined} onResize={() => undefined} />);
    expect(html).toContain('data-theme="dark"');
    expect(html).toContain('data-phase="overrun"');
    expect(html).toContain('aria-label="Close widget"');
    expect(html).toContain("df-widget-close-widget-btn");
  });

  it("lets native popover events override stale snapshot state in both directions", () => {
    expect(withPopoverState(snapshot, true).popoverOpen).toBe(true);
    expect(withPopoverState({ ...snapshot, popoverOpen: true }, false).popoverOpen).toBe(false);
  });

  it("treats movement beyond 5px as drag, but not exactly 5px", () => {
    expect(didWidgetPointerDrag({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(false);
    expect(didWidgetPointerDrag({ x: 0, y: 0 }, { x: 4, y: 4 })).toBe(true);
  });

  it("allows keyboard/click timer activation while suppressing the click after a drag", () => {
    expect(shouldToggleTimerClick(false)).toBe(true);
    expect(shouldToggleTimerClick(true)).toBe(false);
    const source = readFileSync(new URL("./WidgetApp.tsx", import.meta.url), "utf8");
    expect(source).toMatch(/className="df-widget-timer"[\s\S]*?onClick=/);
  });

  it("normalizes opacity updates into a widget action", () => {
    expect(opacityAction(2)).toEqual({ type: "updateWidgetAppearance", patch: { opacity: 1 } });
    expect(opacityAction(-1)).toEqual({ type: "updateWidgetAppearance", patch: { opacity: 0 } });
  });
});

describe("WidgetPopoverView", () => {
  const render = (next: WidgetSnapshot) => renderToStaticMarkup(<WidgetPopoverView snapshot={next} onClosePopover={() => undefined} onSetMode={() => undefined} onUpdateTimerPreferences={() => undefined} onToggleAlwaysOnTop={() => undefined} onToggleShadow={() => undefined} onOpacityChange={() => undefined} />);

  it("renders a flat three-mode selector and only pomodoro focus, break, and rounds", () => {
    const html = render(snapshot);
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain("Stopwatch");
    expect(html).toContain("Pomodoro");
    expect(html).toContain("Countdown");
    expect(html).toContain("Focus");
    expect(html).toContain("Break");
    expect(html).toContain("Rounds");
    expect(html).not.toContain("Long break");
    expect(html).toContain('aria-label="Close More"');
    expect((html.match(/tabindex="0"/g) ?? [])).toHaveLength(1);
    expect((html.match(/tabindex="-1"/g) ?? [])).toHaveLength(2);
  });

  it("wraps radiogroup keyboard selection in both directions", () => {
    expect(getAdjacentTimerMode("stopwatch", "ArrowRight")).toBe("pomodoro");
    expect(getAdjacentTimerMode("stopwatch", "ArrowLeft")).toBe("countdown");
    expect(getAdjacentTimerMode("pomodoro", "ArrowDown")).toBe("countdown");
    expect(getAdjacentTimerMode("pomodoro", "ArrowUp")).toBe("stopwatch");
    expect(getAdjacentTimerMode("pomodoro", "Enter")).toBeNull();
  });

  it("shows countdown presets and keeps More limited to opacity, topmost, and shadow", () => {
    const html = render({ ...snapshot, timerPreferences: { ...snapshot.timerPreferences, mode: "countdown" } });
    for (const minutes of [15, 25, 45, 60]) expect(html).toContain(`>${minutes}<`);
    expect(html).toContain("Custom");
    expect(html).toContain("Background opacity");
    expect(html).toContain("Always on top");
    expect(html).toContain("Shadow");
    expect(html).not.toContain("Font family");
    expect(html).not.toContain("Reset position");
  });

  it("shows no duration input for stopwatch", () => {
    const html = render({ ...snapshot, timerPreferences: { ...snapshot.timerPreferences, mode: "stopwatch" } });
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
    expect(css).toMatch(/\.df-widget-icon-btn,[^}]*width:\s*clamp\(44px,/);
    expect(css).toMatch(/\.df-widget-icon-btn,[^}]*height:\s*clamp\(44px,/);
  });
});
