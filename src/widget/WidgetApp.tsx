import React, { type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Cherry, MoreHorizontal, Pause, Pin, PinOff, Play, RotateCcw, Sprout, X } from "lucide-react";
import type { WidgetAction, WidgetBounds, WidgetResizeFixedEdges, WidgetSnapshot, WidgetTimerMode, WidgetTimerPreferences } from "../types";
import {
  DEFAULT_WIDGET_APPEARANCE,
  getWidgetDensity,
  hexToRgbTriplet,
  migrateLegacyWidgetAppearance,
  normalizeWidgetAppearance,
  type WidgetDensity,
} from "./widgetPreferences";
import { DEFAULT_WIDGET_TIMER_PREFERENCES } from "./widgetTimer";
import { generateDeadlineAlignedPomodoroPlan } from "./pomodoroPlan";
import "./widget.css";

const LEGACY_WIDGET_PREFS_KEY = "navopath-widget-prefs";
const WIDGET_MIN_WIDTH = 128;
const WIDGET_MIN_HEIGHT = 56;
const WIDGET_MAX_WIDTH = 860;
const WINDOW_MARGIN = 6;

export type WidgetResizeDirection = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

const WIDGET_RESIZE_DIRECTIONS: WidgetResizeDirection[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];

export function getWidgetResizeDirection(point: { x: number; y: number }, bounds: WidgetBounds, handleSize: number): WidgetResizeDirection | null {
  const west = point.x <= bounds.x + handleSize;
  const east = point.x >= bounds.x + bounds.width - handleSize;
  const north = point.y <= bounds.y + handleSize;
  const south = point.y >= bounds.y + bounds.height - handleSize;
  if (north && west) return "nw";
  if (north && east) return "ne";
  if (south && east) return "se";
  if (south && west) return "sw";
  if (north) return "n";
  if (east) return "e";
  if (south) return "s";
  if (west) return "w";
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function resizeWidgetBounds(initial: WidgetBounds, direction: WidgetResizeDirection, delta: { x: number; y: number }, workArea: WidgetBounds): WidgetBounds {
  const maxWidth = Math.min(WIDGET_MAX_WIDTH, Math.max(WIDGET_MIN_WIDTH, workArea.width - WINDOW_MARGIN * 2));
  const maxHeight = Math.min(Math.max(320, Math.round(workArea.height * 0.7)), Math.max(WIDGET_MIN_HEIGHT, workArea.height - WINDOW_MARGIN * 2));
  const right = initial.x + initial.width;
  const bottom = initial.y + initial.height;
  let left = initial.x;
  let top = initial.y;
  let nextRight = right;
  let nextBottom = bottom;
  if (direction.includes("w")) left = clamp(initial.x + delta.x, Math.max(workArea.x, right - maxWidth), right - WIDGET_MIN_WIDTH);
  if (direction.includes("e")) nextRight = clamp(right + delta.x, left + WIDGET_MIN_WIDTH, Math.min(workArea.x + workArea.width - WINDOW_MARGIN, left + maxWidth));
  if (direction.includes("n")) top = clamp(initial.y + delta.y, Math.max(workArea.y, bottom - maxHeight), bottom - WIDGET_MIN_HEIGHT);
  if (direction.includes("s")) nextBottom = clamp(bottom + delta.y, top + WIDGET_MIN_HEIGHT, Math.min(workArea.y + workArea.height - WINDOW_MARGIN, top + maxHeight));
  return { x: Math.round(left), y: Math.round(top), width: Math.round(nextRight - left), height: Math.round(nextBottom - top) };
}

export function getWidgetResizeFixedEdges(direction: WidgetResizeDirection): WidgetResizeFixedEdges {
  return {
    ...(direction.includes("w") ? { horizontal: "right" as const } : direction.includes("e") ? { horizontal: "left" as const } : {}),
    ...(direction.includes("n") ? { vertical: "bottom" as const } : direction.includes("s") ? { vertical: "top" as const } : {}),
  };
}

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

export function withPopoverState(snapshot: WidgetSnapshot, popoverOpen: boolean): WidgetSnapshot {
  return { ...snapshot, popoverOpen };
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
  } as CSSProperties;
}

interface WidgetViewProps {
  snapshot: WidgetSnapshot;
  density: WidgetDensity;
  onToggleTimer: () => void;
  onTogglePopover: () => void;
  onMove: (deltaX: number, deltaY: number) => void;
  onResize: (direction: WidgetResizeDirection, deltaX: number, deltaY: number) => void;
}

function WidgetResizeHandles({ onResize }: { onResize: WidgetViewProps["onResize"] }) {
  const beginResize = (event: ReactPointerEvent<HTMLDivElement>, direction: WidgetResizeDirection) => {
    event.preventDefault();
    const handle = event.currentTarget;
    let lastX = event.screenX;
    let lastY = event.screenY;
    handle.setPointerCapture(event.pointerId);
    const onMove = (moveEvent: PointerEvent) => {
      onResize(direction, moveEvent.screenX - lastX, moveEvent.screenY - lastY);
      lastX = moveEvent.screenX;
      lastY = moveEvent.screenY;
    };
    const finish = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  };
  return <div className="df-widget-resize-layer" aria-hidden="true">
    {WIDGET_RESIZE_DIRECTIONS.map((direction) => <div key={direction} className={`df-widget-resize-handle is-${direction}`} onPointerDown={(event) => beginResize(event, direction)} />)}
  </div>;
}

export function WidgetView({ snapshot, density, onToggleTimer, onTogglePopover, onMove, onResize }: WidgetViewProps) {
  const zh = snapshot.lang === "zh";
  const pointer = useRef<{ startX: number; startY: number; lastX: number; lastY: number; dragged: boolean } | null>(null);
  const suppressNextClick = useRef(false);
  const showTask = density === "full";
  const showPrimaryControl = density === "full" && !(snapshot.timerRuntime.mode === "countdown" && snapshot.timerRuntime.running);
  const showMoreControl = density !== "timerOnly";
  const effectiveRunning = snapshot.timerRuntime.mode === "stopwatch" ? snapshot.timerRunning : snapshot.timerRuntime.running;
  const runningPomodoro = snapshot.timerRuntime.mode === "pomodoro" && effectiveRunning;
  const pomodoroBreak = runningPomodoro && snapshot.timerRuntime.phase === "break";
  const controlLabel = runningPomodoro
    ? pomodoroBreak ? (zh ? "正在休息，点击暂停" : "Resting — click to pause") : (zh ? "正在专注，点击暂停" : "Focusing — click to pause")
    : effectiveRunning ? (zh ? "暂停计时" : "Pause timer") : (zh ? "开始计时" : "Start timer");

  const onTimerPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointer.current = { startX: event.screenX, startY: event.screenY, lastX: event.screenX, lastY: event.screenY, dragged: false };
  };
  const onTimerPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = pointer.current;
    if (!active) return;
    if (!active.dragged && didWidgetPointerDrag({ x: active.startX, y: active.startY }, { x: event.screenX, y: event.screenY })) active.dragged = true;
    if (active.dragged) onMove(event.screenX - active.lastX, event.screenY - active.lastY);
    active.lastX = event.screenX;
    active.lastY = event.screenY;
  };
  const onTimerPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragged = pointer.current?.dragged ?? false;
    pointer.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    suppressNextClick.current = dragged;
    window.setTimeout(() => { suppressNextClick.current = false; }, 0);
  };
  return (
    <main className="df-widget-root" data-density={density} data-theme={snapshot.theme} data-phase={snapshot.timerPhase} style={appearanceStyle(snapshot)}>
      <section className="df-widget-card" aria-label={zh ? "桌面小组件" : "Desktop widget"}>
        {showTask && <span className="df-widget-task-title" title={snapshot.taskTitle}>{snapshot.taskTitle || (zh ? "暂无任务" : "No active task")}</span>}
        <div className="df-widget-right">
          <div className="df-widget-timer" onPointerDown={onTimerPointerDown} onPointerMove={onTimerPointerMove} onPointerUp={onTimerPointerUp} onPointerCancel={() => { pointer.current = null; suppressNextClick.current = false; }}>
            {formatTimer(snapshot.timerDisplaySeconds)}
          </div>
          {showPrimaryControl && <button type="button" className="df-widget-icon-btn" aria-label={controlLabel} title={controlLabel} onClick={onToggleTimer}>{runningPomodoro ? (pomodoroBreak ? <Sprout size={18} strokeWidth={1.8} aria-hidden="true" /> : <Cherry size={18} strokeWidth={1.8} aria-hidden="true" />) : effectiveRunning ? <Pause size={18} strokeWidth={1.8} aria-hidden="true" /> : <Play size={18} strokeWidth={1.8} aria-hidden="true" />}</button>}
          {showMoreControl && <button type="button" className="df-widget-icon-btn" aria-label={zh ? "更多" : "More"} aria-haspopup="dialog" aria-expanded={snapshot.popoverOpen} onClick={onTogglePopover}><MoreHorizontal size={18} strokeWidth={1.8} aria-hidden="true" /></button>}
        </div>
      </section>
      <WidgetResizeHandles onResize={onResize} />
    </main>
  );
}

interface WidgetPopoverViewProps {
  snapshot: WidgetSnapshot;
  onClosePopover: () => void;
  onCloseWidget: () => void;
  onSaveTimerSettings: (draft: WidgetTimerPreferences) => void;
  onResetTimer: (draft: WidgetTimerPreferences) => void;
  onSchedule: (durationMinutes: number) => void;
  onToggleAlwaysOnTop: () => void;
  onOpacityChange: (value: number) => void;
}

const TIMER_MODES: Array<{ mode: WidgetTimerMode; zh: string; en: string }> = [
  { mode: "stopwatch", zh: "正计时", en: "Stopwatch" },
  { mode: "pomodoro", zh: "番茄钟", en: "Pomodoro" },
  { mode: "countdown", zh: "倒计时", en: "Countdown" },
];

const TIMER_MODE_DESCRIPTIONS: Record<WidgetTimerMode, { zh: string; en: string }> = {
  stopwatch: { zh: "从当前时间开始累计。超过任务结束时间后，会按实际工作时间自动延长。", en: "Counts actual work time from now and extends the task after its planned end." },
  pomodoro: { zh: "根据当前时间与任务结束时间生成工作和休息周期，最后一段专注恰好对齐截止时间。", en: "Builds work and break phases to the task deadline, ending with focus exactly on time." },
  countdown: { zh: "默认倒计时到任务在时间轴上的结束时间；继续工作时自动进入超时并延长任务。", en: "Counts down to the timeline deadline, then enters overtime and extends the task." },
};

export function getAdjacentTimerMode(mode: WidgetTimerMode, key: string): WidgetTimerMode | null {
  const direction = key === "ArrowRight" || key === "ArrowDown" ? 1 : key === "ArrowLeft" || key === "ArrowUp" ? -1 : 0;
  if (!direction) return null;
  const index = TIMER_MODES.findIndex((item) => item.mode === mode);
  return TIMER_MODES[(index + direction + TIMER_MODES.length) % TIMER_MODES.length].mode;
}

function NumberSetting({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="df-widget-number-row"><span>{label}</span><input type="number" min="1" value={value} onChange={(event) => onChange(Math.max(1, Number(event.target.value) || 1))} /></label>;
}

export function getClampedTooltipPosition({ pointerX, pointerY, tooltipWidth, tooltipHeight, viewportWidth, viewportHeight, offset = 8, margin = 6 }: { pointerX: number; pointerY: number; tooltipWidth: number; tooltipHeight: number; viewportWidth: number; viewportHeight: number; offset?: number; margin?: number }) {
  const preferredLeft = pointerX + offset + tooltipWidth <= viewportWidth - margin ? pointerX + offset : pointerX - offset - tooltipWidth;
  const preferredTop = pointerY + offset + tooltipHeight <= viewportHeight - margin ? pointerY + offset : pointerY - offset - tooltipHeight;
  const maxLeft = Math.max(margin, viewportWidth - tooltipWidth - margin);
  const maxTop = Math.max(margin, viewportHeight - tooltipHeight - margin);
  return {
    left: Math.max(margin, Math.min(preferredLeft, maxLeft)),
    top: Math.max(margin, Math.min(preferredTop, maxTop)),
  };
}

export function requiresRunningTimerModeConfirmation(running: boolean, currentMode: WidgetTimerMode, nextMode: WidgetTimerMode): boolean {
  return running && currentMode !== nextMode;
}

const formatClock = (value: Date) => `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;

export function TimerModeTabs({ lang, mode, onSelect }: { lang: WidgetSnapshot["lang"]; mode: WidgetTimerMode; onSelect: (mode: WidgetTimerMode) => void }) {
  const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, currentMode: WidgetTimerMode) => {
    const nextMode = getAdjacentTimerMode(currentMode, event.key);
    if (!nextMode) return;
    event.preventDefault();
    onSelect(nextMode);
    event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-mode="${nextMode}"]`)?.focus();
  };
  return <div className="df-widget-mode-switch" role="radiogroup" aria-label={lang === "zh" ? "计时模式" : "Timer mode"}>{TIMER_MODES.map(({ mode: itemMode, zh, en }) => <button key={itemMode} type="button" role="radio" aria-checked={mode === itemMode} data-mode={itemMode} tabIndex={mode === itemMode ? 0 : -1} className={mode === itemMode ? "is-selected" : ""} onClick={() => onSelect(itemMode)} onKeyDown={(event) => onKeyDown(event, itemMode)}>{lang === "zh" ? zh : en}</button>)}</div>;
}

export function WidgetPopoverUtilities({ lang, alwaysOnTop, onResetTimer, onToggleAlwaysOnTop, onCloseWidget }: { lang: WidgetSnapshot["lang"]; alwaysOnTop: boolean; onResetTimer: () => void; onToggleAlwaysOnTop: () => void; onCloseWidget: () => void }) {
  const zh = lang === "zh";
  return <div className="df-widget-popover-utilities"><button type="button" className="df-widget-icon-btn" aria-label={zh ? "重置计时器" : "Reset timer"} onClick={onResetTimer}><RotateCcw size={18} strokeWidth={1.8} aria-hidden="true" /></button><button type="button" className="df-widget-icon-btn" aria-label={alwaysOnTop ? (zh ? "取消置顶小组件" : "Unpin widget") : (zh ? "置顶小组件" : "Pin widget")} aria-pressed={alwaysOnTop} onClick={onToggleAlwaysOnTop}>{alwaysOnTop ? <PinOff size={18} strokeWidth={1.8} aria-hidden="true" /> : <Pin size={18} strokeWidth={1.8} aria-hidden="true" />}</button><button type="button" className="df-widget-icon-btn df-widget-close-widget-btn" aria-label={zh ? "关闭小组件" : "Close widget"} onClick={onCloseWidget}><X size={18} strokeWidth={1.8} aria-hidden="true" /></button></div>;
}

interface WidgetTimerSettingsViewProps { snapshot: WidgetSnapshot; onSave: (draft: WidgetTimerPreferences) => void; onCancel: () => void; onReset: (draft: WidgetTimerPreferences) => void; onSchedule: (durationMinutes: number) => void; }

export function WidgetTimerSettingsView({ snapshot, onSave, onSchedule }: WidgetTimerSettingsViewProps) {
  const zh = snapshot.lang === "zh";
  const [draft, setDraft] = useState(snapshot.timerPreferences);
  const [modeTooltip, setModeTooltip] = useState<{ mode: WidgetTimerMode; x: number; y: number } | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ left: number; top: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(String(Math.max(1, Math.round(snapshot.timerPreferences.countdownSeconds / 60))));
  const timerPreferencesSignature = JSON.stringify(snapshot.timerPreferences);
  useEffect(() => {
    setDraft(snapshot.timerPreferences);
    setDuration(String(Math.max(1, Math.round(snapshot.timerPreferences.countdownSeconds / 60))));
  }, [timerPreferencesSignature]);
  useLayoutEffect(() => {
    const tooltip = tooltipRef.current;
    if (!modeTooltip || !tooltip) {
      setTooltipPosition(null);
      return;
    }
    const bounds = tooltip.getBoundingClientRect();
    setTooltipPosition(getClampedTooltipPosition({
      pointerX: modeTooltip.x,
      pointerY: modeTooltip.y,
      tooltipWidth: bounds.width,
      tooltipHeight: bounds.height,
      viewportWidth: typeof window === "undefined" ? 300 : window.innerWidth,
      viewportHeight: typeof window === "undefined" ? 156 : window.innerHeight,
    }));
  }, [modeTooltip]);
  const parsedDuration = Number(duration);
  const needsSchedule = draft.mode === "countdown"
    && snapshot.timerRuntime.countdownTargetAt === undefined
    && !snapshot.taskDueDate
    && !snapshot.taskScheduleEndAt;
  const chooseMode = (mode: WidgetTimerMode) => {
    if (requiresRunningTimerModeConfirmation(snapshot.timerRuntime.running, snapshot.timerRuntime.mode, mode)
      && typeof window !== "undefined" && !window.confirm(zh ? "停止当前计时并切换模式？" : "Stop the current timer and switch modes?")) return;
    const next = { ...draft, mode };
    setDraft(next);
    onSave(next);
  };
  const onModeKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, mode: WidgetTimerMode) => {
    const nextMode = getAdjacentTimerMode(mode, event.key);
    if (!nextMode) return;
    event.preventDefault();
    chooseMode(nextMode);
    event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-mode="${nextMode}"]`)?.focus();
  };
  const previewStart = Math.max(snapshot.taskScheduleStartAt || Date.now(), Date.now());
  const pomodoroPlan = draft.mode === "pomodoro" && snapshot.taskScheduleEndAt && snapshot.taskScheduleEndAt > previewStart
    ? generateDeadlineAlignedPomodoroPlan({ startAt: new Date(previewStart), endAt: new Date(snapshot.taskScheduleEndAt), preferredWorkMinutes: draft.focusMinutes, minWorkMinutes: draft.minWorkMinutes || 15, maxWorkMinutes: draft.maxWorkMinutes || 50, preferredShortBreakMinutes: draft.breakMinutes, minShortBreakMinutes: draft.minBreakMinutes || 2, preferredLongBreakMinutes: draft.longBreakMinutes || 15, minLongBreakMinutes: draft.minLongBreakMinutes || 5, longBreakEvery: draft.longBreakEvery || 4 }) : [];
  const previewWork = pomodoroPlan.filter((phase) => phase.type === "work").reduce((sum, phase) => sum + phase.durationMinutes, 0);
  const previewBreak = pomodoroPlan.filter((phase) => phase.type !== "work").reduce((sum, phase) => sum + phase.durationMinutes, 0);
  return <section className="df-widget-timer-settings-view">
    <div className="df-widget-mode-switch" role="radiogroup" aria-label={zh ? "计时模式" : "Timer mode"}>{TIMER_MODES.map(({ mode, zh: zhLabel, en }) => <button key={mode} type="button" role="radio" aria-checked={draft.mode === mode} data-mode={mode} tabIndex={draft.mode === mode ? 0 : -1} className={draft.mode === mode ? "is-selected" : ""} onPointerEnter={(event) => setModeTooltip({ mode, x: event.clientX, y: event.clientY })} onPointerMove={(event) => setModeTooltip({ mode, x: event.clientX, y: event.clientY })} onPointerLeave={() => setModeTooltip(null)} onClick={() => chooseMode(mode)} onKeyDown={(event) => onModeKeyDown(event, mode)}>{zh ? zhLabel : en}</button>)}</div>
    {modeTooltip && <div ref={tooltipRef} className="df-widget-mode-tooltip" role="tooltip" style={{ left: tooltipPosition?.left ?? 0, top: tooltipPosition?.top ?? 0, visibility: tooltipPosition ? "visible" : "hidden" }}>{zh ? TIMER_MODE_DESCRIPTIONS[modeTooltip.mode].zh : TIMER_MODE_DESCRIPTIONS[modeTooltip.mode].en}</div>}
    <div className="df-widget-mode-details"><div className="df-widget-mode-settings">
      {draft.mode === "stopwatch" && <p className="df-widget-no-duration">{zh ? "无需设置时长" : "No duration"}</p>}
      {draft.mode === "pomodoro" && <><NumberSetting label={zh ? "偏好专注" : "Preferred focus"} value={draft.focusMinutes} onChange={(focusMinutes) => setDraft((current) => ({ ...current, focusMinutes }))} /><NumberSetting label={zh ? "最短专注" : "Minimum focus"} value={draft.minWorkMinutes || 15} onChange={(minWorkMinutes) => setDraft((current) => ({ ...current, minWorkMinutes }))} /><NumberSetting label={zh ? "最长专注" : "Maximum focus"} value={draft.maxWorkMinutes || 50} onChange={(maxWorkMinutes) => setDraft((current) => ({ ...current, maxWorkMinutes }))} /><NumberSetting label={zh ? "短休息" : "Short break"} value={draft.breakMinutes} onChange={(breakMinutes) => setDraft((current) => ({ ...current, breakMinutes }))} /><NumberSetting label={zh ? "长休息" : "Long break"} value={draft.longBreakMinutes || 15} onChange={(longBreakMinutes) => setDraft((current) => ({ ...current, longBreakMinutes }))} /><NumberSetting label={zh ? "长休息周期" : "Long break every"} value={draft.longBreakEvery || 4} onChange={(longBreakEvery) => setDraft((current) => ({ ...current, longBreakEvery }))} />{pomodoroPlan.length > 0 && <div className="df-widget-pomodoro-preview"><strong>{zh ? "计划预览" : "Plan preview"}</strong>{pomodoroPlan.map((phase) => <div key={phase.id}><time>{formatClock(phase.startAt)}–{formatClock(phase.endAt)}</time><span>{phase.type === "work" ? (zh ? "专注" : "Focus") : (zh ? "休息" : "Break")}</span></div>)}<p>{zh ? `专注 ${previewWork} 分钟 · 休息 ${previewBreak} 分钟 · ${pomodoroPlan.filter((phase) => phase.type === "work").length} 个周期` : `Work ${previewWork} min · Break ${previewBreak} min · Focus cycles ${pomodoroPlan.filter((phase) => phase.type === "work").length}`}</p></div>}</>}
      {draft.mode === "countdown" && <div className="df-widget-countdown-settings">{snapshot.taskScheduleEndAt && <p className="df-widget-deadline"><span>{zh ? "任务截止" : "Task deadline"}</span><time>{formatClock(new Date(snapshot.taskScheduleEndAt))}</time></p>}<div className="df-widget-presets">{[15, 25, 45, 60].map((minutes) => <button type="button" key={minutes} className={draft.countdownSeconds === minutes * 60 ? "is-selected" : ""} onClick={() => setDraft((current) => ({ ...current, countdownSeconds: minutes * 60 }))}>{minutes}</button>)}</div><NumberSetting label={zh ? "临时时长（秒）" : "Temporary duration"} value={draft.countdownSeconds} onChange={(countdownSeconds) => setDraft((current) => ({ ...current, countdownSeconds }))} /></div>}
    </div>
    {needsSchedule && <div className="df-widget-schedule-guidance"><p>{zh ? "请先在时间轴安排此任务" : "Please schedule it on the timeline first"}</p><label className="df-widget-number-row"><span>{zh ? "时长（分钟）" : "Duration (minutes)"}</span><input type="number" min="1" max="1440" step="1" value={duration} onChange={(event) => setDuration(event.target.value)} /></label><button type="button" className="df-widget-popover-action" disabled={!Number.isInteger(parsedDuration) || parsedDuration < 1 || parsedDuration > 1_440} onClick={() => onSchedule(parsedDuration)}>{zh ? "立即安排" : "Schedule for now"}</button></div>}</div>
  </section>;
}

export function WidgetPopoverView({ snapshot, onClosePopover, onCloseWidget, onSaveTimerSettings, onResetTimer, onSchedule, onToggleAlwaysOnTop, onOpacityChange }: WidgetPopoverViewProps) {
  const zh = snapshot.lang === "zh";
  const appearance = normalizeWidgetAppearance(snapshot.appearance);
  return <main className="df-widget-popover-root" data-theme={snapshot.theme} style={appearanceStyle(snapshot)}><section className="df-widget-popover-surface" role="dialog" aria-label={zh ? "小组件控制" : "Widget controls"}><WidgetPopoverUtilities lang={snapshot.lang} alwaysOnTop={snapshot.alwaysOnTop} onResetTimer={() => onResetTimer(snapshot.timerPreferences)} onToggleAlwaysOnTop={onToggleAlwaysOnTop} onCloseWidget={onCloseWidget} /><label className="df-widget-opacity-row"><span>{zh ? "背景透明度" : "Background opacity"}</span><input type="range" min="0" max="1" step="0.01" value={appearance.opacity} onChange={(event) => onOpacityChange(Number(event.target.value))} /><output>{Math.round(appearance.opacity * 100)}%</output></label><WidgetTimerSettingsView snapshot={snapshot} onSave={onSaveTimerSettings} onCancel={onClosePopover} onReset={onResetTimer} onSchedule={onSchedule} /></section></main>;
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
  const [nativePopoverOpen, setNativePopoverOpen] = useState<boolean | null>(null);
  const geometryQueueRef = useRef(Promise.resolve());
  useEffect(() => {
    const update = () => setDensity(getWidgetDensity(window.innerWidth));
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  useEffect(() => {
    const unsubscribe = getWidgetApi()?.onPopoverState?.(setNativePopoverOpen);
    return unsubscribe;
  }, []);
  const move = (deltaX: number, deltaY: number) => {
    const api = getWidgetApi();
    if (!api) return;
    geometryQueueRef.current = geometryQueueRef.current.then(async () => {
      const bounds = await api.getBounds();
      if (bounds) await api.setBounds({ x: bounds.x + deltaX, y: bounds.y + deltaY });
    });
  };
  const resize = (direction: WidgetResizeDirection, deltaX: number, deltaY: number) => {
    const api = getWidgetApi();
    if (!api) return;
    geometryQueueRef.current = geometryQueueRef.current.then(async () => {
      const [bounds, workArea] = await Promise.all([api.getBounds(), api.getWorkArea()]);
      if (bounds) await api.setBounds({
        ...resizeWidgetBounds(bounds, direction, { x: deltaX, y: deltaY }, workArea),
        fixedEdges: getWidgetResizeFixedEdges(direction),
      });
    });
  };
  const renderedSnapshot = nativePopoverOpen === null ? snapshot : withPopoverState(snapshot, nativePopoverOpen);
  return <WidgetView snapshot={renderedSnapshot} density={density} onToggleTimer={() => send({ type: "toggleWidgetTimer" })} onTogglePopover={() => { void getWidgetApi()?.togglePopover(); }} onMove={move} onResize={resize} />;
}

export function WidgetPopoverApp() {
  const { snapshot, send } = useWidgetSnapshot();
  const closePopover = () => { void getWidgetApi()?.closePopover(); };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") closePopover(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  return <WidgetPopoverView snapshot={snapshot} onClosePopover={closePopover} onCloseWidget={() => { void getWidgetApi()?.close(); }} onSaveTimerSettings={(draft) => send({ type: "saveTimerSettings", draft })} onResetTimer={(draft) => send({ type: "resetWidgetTimer", draft })} onSchedule={(durationMinutes) => send({ type: "scheduleWidgetCountdown", durationMinutes })} onToggleAlwaysOnTop={() => send({ type: "setAlwaysOnTop", enabled: !snapshot.alwaysOnTop })} onOpacityChange={(value) => send(opacityAction(value))} />;
}
