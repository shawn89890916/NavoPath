import React, { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import type { WidgetAction, WidgetSnapshot } from "../types";
import {
  DEFAULT_WIDGET_APPEARANCE,
  getWidgetLayout,
  hexToRgbTriplet,
  migrateLegacyWidgetAppearance,
  normalizeWidgetAppearance,
  restoreStoredWidgetBounds,
} from "./widgetPreferences";
import "./widget.css";

const WIDGET_BOUNDS_KEY = "navopath-widget-bounds";
const LEGACY_WIDGET_PREFS_KEY = "navopath-widget-prefs";

type WidgetApiWithPopover = NonNullable<NonNullable<Window["desktopApi"]>["widget"]> & {
  togglePopover?: () => Promise<boolean>;
  closePopover?: () => Promise<boolean>;
};

function getWidgetApi(): WidgetApiWithPopover | undefined {
  return window.desktopApi?.widget as WidgetApiWithPopover | undefined;
}

function formatTimer(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`
    : `${minutes}:${String(remaining).padStart(2, "0")}`;
}

export function opacityAction(value: number): WidgetAction {
  return { type: "updateAppearance", patch: { opacity: Math.min(1, Math.max(0, value)) } };
}

interface WidgetViewProps {
  snapshot: WidgetSnapshot;
  elapsedSeconds: number;
  layout: "strip" | "stacked";
  onToggleTimer: () => void;
  onTogglePopover: () => void;
}

export function WidgetView(props: WidgetViewProps) {
  const { snapshot } = props;
  const zh = snapshot.lang === "zh";
  const hasTask = Boolean(snapshot.taskId);
  const appearance = normalizeWidgetAppearance(snapshot.appearance);
  const status = hasTask ? (zh ? "正在做" : "Working") : (zh ? "空闲" : "Idle");
  const title = hasTask ? snapshot.taskTitle : (zh ? "暂无进行中的任务" : "No active task");
  const style = {
    "--widget-bg-rgb": hexToRgbTriplet(appearance.backgroundColor),
    "--widget-opacity": String(appearance.opacity),
    "--widget-ink": appearance.fontColor,
    "--widget-accent": appearance.accentColor,
  } as CSSProperties;

  return (
    <main className="df-widget-root" data-layout={props.layout} data-lang={snapshot.lang} style={style}>
      <section className="df-widget-card" aria-label={zh ? "桌面小组件" : "Desktop widget"}>
        <div className="df-widget-task-copy">
          <span className="df-widget-status">{status}</span>
          <span className="df-widget-task-title" title={title}>{title}</span>
        </div>
        <div className="df-widget-controls">
          <time className="df-widget-timer">{formatTimer(props.elapsedSeconds)}</time>
          <button
            type="button"
            className={`df-widget-icon-btn df-widget-play-btn ${snapshot.timerRunning ? "is-paused" : ""}`}
            aria-label={snapshot.timerRunning ? (zh ? "暂停" : "Pause") : (zh ? "播放" : "Play")}
            onClick={props.onToggleTimer}
            disabled={!hasTask}
          />
          <button
            type="button"
            className="df-widget-icon-btn df-widget-more-btn"
            aria-label={zh ? "更多" : "More"}
            aria-haspopup="dialog"
            onClick={props.onTogglePopover}
          />
        </div>
      </section>
    </main>
  );
}

interface WidgetPopoverViewProps {
  snapshot: WidgetSnapshot;
  onToggleAlwaysOnTop: () => void;
  onOpacityChange: (value: number) => void;
  onResetPosition: () => void;
  onCloseWidget: () => void;
}

export function WidgetPopoverView(props: WidgetPopoverViewProps) {
  const { snapshot } = props;
  const zh = snapshot.lang === "zh";
  const appearance = normalizeWidgetAppearance(snapshot.appearance);
  const style = {
    "--widget-bg-rgb": hexToRgbTriplet(appearance.backgroundColor),
    "--widget-ink": appearance.fontColor,
    "--widget-accent": appearance.accentColor,
  } as CSSProperties;

  return (
    <main className="df-widget-popover-root" data-lang={snapshot.lang} style={style}>
      <section className="df-widget-popover-surface" role="dialog" aria-label={zh ? "小组件控制" : "Widget controls"}>
        <button type="button" className="df-widget-popover-action" autoFocus onClick={props.onToggleAlwaysOnTop}>
          <span>{zh ? "始终置顶" : "Always on top"}</span>
          <span className="df-widget-popover-state" aria-hidden>{snapshot.alwaysOnTop ? "✓" : ""}</span>
        </button>
        <label className="df-widget-opacity-row">
          <span>{zh ? "背景透明度" : "Background opacity"}</span>
          <output>{Math.round(appearance.opacity * 100)}%</output>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={appearance.opacity}
            aria-label={zh ? "小组件背景透明度" : "Widget background opacity"}
            onChange={(event) => props.onOpacityChange(Number(event.target.value))}
          />
        </label>
        <button type="button" className="df-widget-popover-action" onClick={props.onResetPosition}>{zh ? "重置位置" : "Reset position"}</button>
        <button type="button" className="df-widget-popover-action is-danger" onClick={props.onCloseWidget}>{zh ? "关闭小组件" : "Close widget"}</button>
      </section>
    </main>
  );
}

const EMPTY_SNAPSHOT: WidgetSnapshot = {
  taskTitle: "",
  elapsedSeconds: 0,
  timerRunning: false,
  candidateCount: 0,
  lang: "zh",
  alwaysOnTop: true,
  appearance: DEFAULT_WIDGET_APPEARANCE,
  appearanceConfigured: false,
};

function useWidgetSnapshot() {
  const [snapshot, setSnapshot] = useState<WidgetSnapshot>(EMPTY_SNAPSHOT);
  const migrationAttemptedRef = useRef(false);
  const send = useCallback((action: WidgetAction) => getWidgetApi()?.sendAction(action), []);

  useEffect(() => {
    const unsubscribe = getWidgetApi()?.onSnapshot((next) => {
      const appearance = normalizeWidgetAppearance(next.appearance);
      setSnapshot({ ...next, appearance });
      if (!migrationAttemptedRef.current && !next.appearanceConfigured) {
        migrationAttemptedRef.current = true;
        const migrated = migrateLegacyWidgetAppearance(localStorage.getItem(LEGACY_WIDGET_PREFS_KEY), 0) || appearance;
        send({ type: "updateAppearance", patch: migrated });
      }
    });
    send({ type: "requestSnapshot" });
    return unsubscribe;
  }, [send]);

  return { snapshot, send };
}

export function WidgetApp() {
  const { snapshot, send } = useWidgetSnapshot();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [layout, setLayout] = useState<"strip" | "stacked">(() => getWidgetLayout(window.innerWidth, window.innerHeight));

  useEffect(() => setElapsedSeconds(snapshot.elapsedSeconds), [snapshot.elapsedSeconds]);

  useEffect(() => {
    if (!snapshot.timerRunning) return;
    const timer = window.setInterval(() => setElapsedSeconds((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, [snapshot.timerRunning]);

  useEffect(() => {
    const updateLayout = () => setLayout(getWidgetLayout(window.innerWidth, window.innerHeight));
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  useEffect(() => {
    const api = getWidgetApi();
    if (!api) return;
    try {
      const raw = localStorage.getItem(WIDGET_BOUNDS_KEY);
      if (raw) {
        void api.getWorkArea().then((workArea) => {
          const restored = restoreStoredWidgetBounds(raw, workArea);
          if (restored) return api.setBounds(restored);
        });
      }
    } catch { /* Ignore unavailable storage. */ }
    const poller = window.setInterval(() => {
      void api.getBounds().then((bounds) => {
        if (bounds) localStorage.setItem(WIDGET_BOUNDS_KEY, JSON.stringify(bounds));
      });
    }, 1200);
    return () => window.clearInterval(poller);
  }, []);

  return (
    <WidgetView
      snapshot={snapshot}
      elapsedSeconds={elapsedSeconds}
      layout={layout}
      onToggleTimer={() => send({ type: snapshot.timerRunning ? "timerPause" : "timerResume" })}
      onTogglePopover={() => { void getWidgetApi()?.togglePopover?.(); }}
    />
  );
}

export function WidgetPopoverApp() {
  const { snapshot, send } = useWidgetSnapshot();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") void getWidgetApi()?.closePopover?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const closePopover = () => { void getWidgetApi()?.closePopover?.(); };

  return (
    <WidgetPopoverView
      snapshot={snapshot}
      onToggleAlwaysOnTop={() => send({ type: "setAlwaysOnTop", enabled: !snapshot.alwaysOnTop })}
      onOpacityChange={(value) => send(opacityAction(value))}
      onResetPosition={() => { send({ type: "resetPosition" }); closePopover(); }}
      onCloseWidget={() => { void getWidgetApi()?.close(); closePopover(); }}
    />
  );
}
