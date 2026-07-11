import React, { type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from "react";
import type { WidgetAction, WidgetSnapshot, WidgetTimerMode, WidgetTimerPreferences } from "../types";
import {
  DEFAULT_WIDGET_APPEARANCE,
  getWidgetDensity,
  hexToRgbTriplet,
  migrateLegacyWidgetAppearance,
  normalizeWidgetAppearance,
  restoreStoredWidgetBounds,
  type WidgetDensity,
} from "./widgetPreferences";
import { DEFAULT_WIDGET_TIMER_PREFERENCES } from "./widgetTimer";
import "./widget.css";

const WIDGET_BOUNDS_KEY = "navopath-widget-bounds";
const LEGACY_WIDGET_PREFS_KEY = "navopath-widget-prefs";

type WidgetApiWithPopover = NonNullable<NonNullable<Window["desktopApi"]>["widget"]>;

function getWidgetApi(): WidgetApiWithPopover | undefined {
  return window.desktopApi?.widget;
}

function formatTimer(seconds: number): string {
  const value = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const remaining = value % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`
    : `${minutes}:${String(remaining).padStart(2, "0")}`;
}

export function didWidgetPointerDrag(start: { x: number; y: number }, current: { x: number; y: number }): boolean {
  return Math.hypot(current.x - start.x, current.y - start.y) > 5;
}

export function shouldToggleTimerClick(wasDragged: boolean): boolean {
  return !wasDragged;
}

export function opacityAction(value: number): WidgetAction {
  return { type: "updateWidgetAppearance", patch: { opacity: Math.min(1, Math.max(0, value)) } };
}

function appearanceStyle(snapshot: WidgetSnapshot): CSSProperties {
  const appearance = normalizeWidgetAppearance(snapshot.appearance);
  const colors = appearance[snapshot.theme];
  return {
    "--widget-bg-rgb": hexToRgbTriplet(colors.backgroundColor),
    "--widget-opacity": String(appearance.opacity),
    "--widget-ink": colors.fontColor,
    "--widget-timer": colors.timerColor,
    "--widget-overrun": colors.overrunColor,
    "--widget-font": appearance.fontFamily,
    "--widget-font-scale": String(appearance.fontScale),
    "--widget-shadow": appearance.shadowEnabled ? "0 8px 24px rgb(39 35 30 / .13)" : "none",
  } as CSSProperties;
}

interface WidgetViewProps {
  snapshot: WidgetSnapshot;
  density: WidgetDensity;
  onToggleTimer: () => void;
  onTogglePopover: () => void;
  onCloseWidget: () => void;
  onMove: (deltaX: number, deltaY: number) => void;
}

export function WidgetView({ snapshot, density, onToggleTimer, onTogglePopover, onCloseWidget, onMove }: WidgetViewProps) {
  const zh = snapshot.lang === "zh";
  const pointer = useRef<{ startX: number; startY: number; lastX: number; lastY: number; dragged: boolean } | null>(null);
  const suppressNextClick = useRef(false);
  const showTask = density === "full";
  const showControls = density !== "timerOnly";

  const onTimerPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointer.current = { startX: event.screenX, startY: event.screenY, lastX: event.screenX, lastY: event.screenY, dragged: false };
  };
  const onTimerPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const active = pointer.current;
    if (!active) return;
    if (!active.dragged && didWidgetPointerDrag({ x: active.startX, y: active.startY }, { x: event.screenX, y: event.screenY })) active.dragged = true;
    if (active.dragged) onMove(event.screenX - active.lastX, event.screenY - active.lastY);
    active.lastX = event.screenX;
    active.lastY = event.screenY;
  };
  const onTimerPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const dragged = pointer.current?.dragged ?? false;
    pointer.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    suppressNextClick.current = dragged;
    window.setTimeout(() => { suppressNextClick.current = false; }, 0);
  };
  const onTimerClick = () => {
    const shouldToggle = shouldToggleTimerClick(suppressNextClick.current);
    suppressNextClick.current = false;
    if (shouldToggle) onToggleTimer();
  };

  return (
    <main className="df-widget-root" data-density={density} data-theme={snapshot.theme} data-phase={snapshot.timerPhase} style={appearanceStyle(snapshot)}>
      <section className="df-widget-card" aria-label={zh ? "桌面小组件" : "Desktop widget"}>
        {showTask && <span className="df-widget-task-title" title={snapshot.taskTitle}>{snapshot.taskTitle || (zh ? "暂无任务" : "No active task")}</span>}
        <button type="button" className="df-widget-timer" aria-label={snapshot.timerRunning ? (zh ? "暂停计时" : "Pause timer") : (zh ? "开始计时" : "Start timer")} onClick={onTimerClick} onPointerDown={onTimerPointerDown} onPointerMove={onTimerPointerMove} onPointerUp={onTimerPointerUp} onPointerCancel={() => { pointer.current = null; suppressNextClick.current = false; }}>
          {formatTimer(snapshot.timerDisplaySeconds)}
        </button>
        {showControls && (snapshot.popoverOpen ? (
          <button type="button" className="df-widget-icon-btn df-widget-close-widget-btn" aria-label={zh ? "关闭小组件" : "Close widget"} onClick={onCloseWidget}>×</button>
        ) : (
          <button type="button" className="df-widget-icon-btn df-widget-more-btn" aria-label={zh ? "更多" : "More"} aria-haspopup="dialog" onClick={onTogglePopover} />
        ))}
      </section>
    </main>
  );
}

interface WidgetPopoverViewProps {
  snapshot: WidgetSnapshot;
  onClosePopover: () => void;
  onSetMode: (mode: WidgetTimerMode) => void;
  onUpdateTimerPreferences: (patch: Partial<Omit<WidgetTimerPreferences, "mode">>) => void;
  onToggleAlwaysOnTop: () => void;
  onToggleShadow: () => void;
  onOpacityChange: (value: number) => void;
}

const TIMER_MODES: Array<{ mode: WidgetTimerMode; zh: string; en: string }> = [
  { mode: "stopwatch", zh: "正计时", en: "Stopwatch" },
  { mode: "pomodoro", zh: "番茄钟", en: "Pomodoro" },
  { mode: "countdown", zh: "倒计时", en: "Countdown" },
];

export function getAdjacentTimerMode(mode: WidgetTimerMode, key: string): WidgetTimerMode | null {
  const direction = key === "ArrowRight" || key === "ArrowDown" ? 1 : key === "ArrowLeft" || key === "ArrowUp" ? -1 : 0;
  if (!direction) return null;
  const index = TIMER_MODES.findIndex((item) => item.mode === mode);
  return TIMER_MODES[(index + direction + TIMER_MODES.length) % TIMER_MODES.length].mode;
}

function NumberSetting({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="df-widget-number-row"><span>{label}</span><input type="number" min="1" value={value} onChange={(event) => onChange(Math.max(1, Number(event.target.value) || 1))} /></label>;
}

export function WidgetPopoverView({ snapshot, onClosePopover, onSetMode, onUpdateTimerPreferences, onToggleAlwaysOnTop, onToggleShadow, onOpacityChange }: WidgetPopoverViewProps) {
  const zh = snapshot.lang === "zh";
  const prefs = snapshot.timerPreferences;
  const appearance = normalizeWidgetAppearance(snapshot.appearance);
  const onModeKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, mode: WidgetTimerMode) => {
    const nextMode = getAdjacentTimerMode(mode, event.key);
    if (!nextMode) return;
    event.preventDefault();
    onSetMode(nextMode);
    event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-mode="${nextMode}"]`)?.focus();
  };
  return (
    <main className="df-widget-popover-root" data-theme={snapshot.theme} style={appearanceStyle(snapshot)}>
      <section className="df-widget-popover-surface" role="dialog" aria-label={zh ? "小组件控制" : "Widget controls"}>
        <div className="df-widget-popover-header">
          <div className="df-widget-mode-switch" role="radiogroup" aria-label={zh ? "计时模式" : "Timer mode"}>
            {TIMER_MODES.map(({ mode, zh: zhLabel, en }) => <button key={mode} type="button" role="radio" aria-checked={prefs.mode === mode} data-mode={mode} tabIndex={prefs.mode === mode ? 0 : -1} className={prefs.mode === mode ? "is-selected" : ""} autoFocus={prefs.mode === mode} onClick={() => onSetMode(mode)} onKeyDown={(event) => onModeKeyDown(event, mode)}>{zh ? zhLabel : en}</button>)}
          </div>
          <button type="button" className="df-widget-close-more" aria-label={zh ? "关闭更多" : "Close More"} onClick={onClosePopover}>×</button>
        </div>

        <div className="df-widget-mode-settings">
          {prefs.mode === "stopwatch" && <p className="df-widget-no-duration">{zh ? "无需设置时长" : "No duration"}</p>}
          {prefs.mode === "pomodoro" && <>
            <NumberSetting label={zh ? "专注" : "Focus"} value={prefs.focusMinutes} onChange={(focusMinutes) => onUpdateTimerPreferences({ focusMinutes })} />
            <NumberSetting label={zh ? "休息" : "Break"} value={prefs.breakMinutes} onChange={(breakMinutes) => onUpdateTimerPreferences({ breakMinutes })} />
            <NumberSetting label={zh ? "轮数" : "Rounds"} value={prefs.rounds} onChange={(rounds) => onUpdateTimerPreferences({ rounds })} />
          </>}
          {prefs.mode === "countdown" && <div className="df-widget-countdown-settings">
            <div className="df-widget-presets">{[15, 25, 45, 60].map((minutes) => <button type="button" key={minutes} className={prefs.countdownSeconds === minutes * 60 ? "is-selected" : ""} onClick={() => onUpdateTimerPreferences({ countdownSeconds: minutes * 60 })}>{minutes}</button>)}</div>
            <NumberSetting label={zh ? "自定义（秒）" : "Custom"} value={prefs.countdownSeconds} onChange={(countdownSeconds) => onUpdateTimerPreferences({ countdownSeconds })} />
          </div>}
        </div>

        <label className="df-widget-opacity-row"><span>{zh ? "背景透明度" : "Background opacity"}</span><output>{Math.round(appearance.opacity * 100)}%</output><input type="range" min="0" max="1" step="0.01" value={appearance.opacity} onChange={(event) => onOpacityChange(Number(event.target.value))} /></label>
        <button type="button" className="df-widget-popover-action" onClick={onToggleAlwaysOnTop}><span>{zh ? "始终置顶" : "Always on top"}</span><span aria-hidden>{snapshot.alwaysOnTop ? "✓" : ""}</span></button>
        <button type="button" className="df-widget-popover-action" onClick={onToggleShadow}><span>{zh ? "显示阴影" : "Shadow"}</span><span aria-hidden>{appearance.shadowEnabled ? "✓" : ""}</span></button>
      </section>
    </main>
  );
}

const EMPTY_SNAPSHOT: WidgetSnapshot = {
  taskTitle: "", elapsedSeconds: 0, timerRunning: false, candidateCount: 0, lang: "zh", alwaysOnTop: true,
  appearance: DEFAULT_WIDGET_APPEARANCE, appearanceConfigured: false, theme: "light",
  timerPreferences: DEFAULT_WIDGET_TIMER_PREFERENCES,
  timerRuntime: { mode: "stopwatch", phase: "stopwatch", running: false, round: 1, phaseStartedAt: 0, pausedAt: 0 },
  timerDisplaySeconds: 0, timerPhase: "stopwatch", popoverOpen: false,
};

function useWidgetSnapshot() {
  const [snapshot, setSnapshot] = useState<WidgetSnapshot>(EMPTY_SNAPSHOT);
  const migrationAttemptedRef = useRef(false);
  const send = useCallback((action: WidgetAction) => getWidgetApi()?.sendAction(action), []);
  useEffect(() => {
    const unsubscribe = getWidgetApi()?.onSnapshot((next) => {
      setSnapshot({ ...next, appearance: normalizeWidgetAppearance(next.appearance) });
      if (!migrationAttemptedRef.current && !next.appearanceConfigured) {
        migrationAttemptedRef.current = true;
        const migrated = migrateLegacyWidgetAppearance(localStorage.getItem(LEGACY_WIDGET_PREFS_KEY), 0);
        if (migrated) send({ type: "updateWidgetAppearance", patch: migrated });
      }
    });
    send({ type: "requestSnapshot" });
    return unsubscribe;
  }, [send]);
  return { snapshot, send };
}

export function WidgetApp() {
  const { snapshot, send } = useWidgetSnapshot();
  const [density, setDensity] = useState<WidgetDensity>(() => getWidgetDensity(window.innerWidth));
  const moveQueueRef = useRef(Promise.resolve());
  useEffect(() => {
    const update = () => setDensity(getWidgetDensity(window.innerWidth));
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  useEffect(() => {
    const api = getWidgetApi();
    if (!api) return;
    try {
      const restored = restoreStoredWidgetBounds(localStorage.getItem(WIDGET_BOUNDS_KEY));
      if (restored) void api.setBounds(restored);
    } catch { /* storage can be unavailable */ }
    const poller = window.setInterval(() => void api.getBounds().then((bounds) => bounds && localStorage.setItem(WIDGET_BOUNDS_KEY, JSON.stringify(bounds))), 1200);
    return () => window.clearInterval(poller);
  }, []);
  const move = (deltaX: number, deltaY: number) => {
    const api = getWidgetApi();
    if (!api) return;
    moveQueueRef.current = moveQueueRef.current.then(async () => {
      const bounds = await api.getBounds();
      if (bounds) await api.setBounds({ x: bounds.x + deltaX, y: bounds.y + deltaY });
    });
  };
  return <WidgetView snapshot={snapshot} density={density} onToggleTimer={() => send({ type: "toggleWidgetTimer" })} onTogglePopover={() => { void getWidgetApi()?.togglePopover(); }} onCloseWidget={() => { void getWidgetApi()?.close(); }} onMove={move} />;
}

export function WidgetPopoverApp() {
  const { snapshot, send } = useWidgetSnapshot();
  const closePopover = () => { void getWidgetApi()?.closePopover(); };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") closePopover(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  return <WidgetPopoverView snapshot={snapshot} onClosePopover={closePopover} onSetMode={(mode) => send({ type: "setTimerMode", mode })} onUpdateTimerPreferences={(patch) => send({ type: "updateTimerPreferences", patch })} onToggleAlwaysOnTop={() => send({ type: "setAlwaysOnTop", enabled: !snapshot.alwaysOnTop })} onToggleShadow={() => send({ type: "setWidgetShadow", enabled: !snapshot.appearance.shadowEnabled })} onOpacityChange={(value) => send(opacityAction(value))} />;
}
