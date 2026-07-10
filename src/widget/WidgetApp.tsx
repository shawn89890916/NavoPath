import React, { type CSSProperties, type Ref, useCallback, useEffect, useRef, useState } from "react";
import type { WidgetAction, WidgetBounds, WidgetSnapshot } from "../types";
import {
  DEFAULT_WIDGET_APPEARANCE,
  clampWidgetBounds,
  getExpandedWidgetBounds,
  getWidgetLayout,
  hexToRgbTriplet,
  migrateLegacyWidgetAppearance,
  normalizeWidgetAppearance,
} from "./widgetPreferences";
import "./widget.css";

const WIDGET_BOUNDS_KEY = "navopath-widget-bounds";
const LEGACY_WIDGET_PREFS_KEY = "navopath-widget-prefs";

function formatTimer(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`
    : `${minutes}:${String(remaining).padStart(2, "0")}`;
}

export function opacityAction(value: number): WidgetAction {
  return { type: "updateAppearance", patch: { opacity: Math.min(1, Math.max(0.35, value)) } };
}

interface WidgetViewProps {
  snapshot: WidgetSnapshot;
  elapsedSeconds: number;
  layout: "strip" | "stacked";
  panelOpen: boolean;
  firstPanelActionRef?: Ref<HTMLButtonElement>;
  onToggleTimer: () => void;
  onTogglePanel: () => void;
  onClosePanel: () => void;
  onToggleAlwaysOnTop: () => void;
  onOpacityChange: (value: number) => void;
  onResetPosition: () => void;
  onCloseWidget: () => void;
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
    "--widget-project": snapshot.taskProjectColor || appearance.accentColor,
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
            aria-expanded={props.panelOpen}
            aria-controls="df-widget-controls-panel"
            onClick={props.onTogglePanel}
          />
        </div>
        <span className="df-widget-accent-line" aria-hidden />
      </section>

      {props.panelOpen && (
        <>
          <button className="df-widget-panel-overlay" type="button" aria-label={zh ? "关闭更多设置" : "Close widget controls"} onClick={props.onClosePanel} />
          <section id="df-widget-controls-panel" className="df-widget-panel" aria-label={zh ? "小组件控制" : "Widget controls"}>
            <button ref={props.firstPanelActionRef} type="button" className="df-widget-panel-action" onClick={props.onToggleAlwaysOnTop}>
              <span>{zh ? "始终置顶" : "Always on top"}</span>
              <span className="df-widget-panel-state" aria-hidden>{snapshot.alwaysOnTop ? "✓" : ""}</span>
            </button>
            <label className="df-widget-opacity-row">
              <span>{zh ? "透明度" : "Opacity"}</span>
              <output>{Math.round(appearance.opacity * 100)}%</output>
              <input
                type="range"
                min="0.35"
                max="1"
                step="0.01"
                value={appearance.opacity}
                aria-label={zh ? "小组件透明度" : "Widget opacity"}
                onChange={(event) => props.onOpacityChange(Number(event.target.value))}
              />
            </label>
            <button type="button" className="df-widget-panel-action" onClick={props.onResetPosition}>{zh ? "重置位置" : "Reset position"}</button>
            <button type="button" className="df-widget-panel-action is-danger" onClick={props.onCloseWidget}>{zh ? "关闭小组件" : "Close widget"}</button>
          </section>
        </>
      )}
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

export function WidgetApp() {
  const [snapshot, setSnapshot] = useState<WidgetSnapshot>(EMPTY_SNAPSHOT);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [layout, setLayout] = useState<"strip" | "stacked">(() => getWidgetLayout(window.innerWidth, window.innerHeight));
  const firstPanelActionRef = useRef<HTMLButtonElement>(null);
  const migrationAttemptedRef = useRef(false);
  const autoExpansionRef = useRef<{ previousHeight: number; expandedHeight: number } | null>(null);
  const send = useCallback((action: WidgetAction) => window.desktopApi?.widget?.sendAction(action), []);

  useEffect(() => {
    const unsubscribe = window.desktopApi?.widget?.onSnapshot((next) => {
      const appearance = normalizeWidgetAppearance(next.appearance);
      setSnapshot({ ...next, appearance });
      setElapsedSeconds(next.elapsedSeconds);
      if (!migrationAttemptedRef.current && !next.appearanceConfigured) {
        migrationAttemptedRef.current = true;
        const migrated = migrateLegacyWidgetAppearance(localStorage.getItem(LEGACY_WIDGET_PREFS_KEY), 0) || appearance;
        send({ type: "updateAppearance", patch: migrated });
      }
    });
    send({ type: "requestSnapshot" });
    return unsubscribe;
  }, [send]);

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
    const api = window.desktopApi?.widget;
    if (!api) return;
    try {
      const saved = JSON.parse(localStorage.getItem(WIDGET_BOUNDS_KEY) || "null") as WidgetBounds | null;
      if (saved) void api.getWorkArea().then((workArea) => api.setBounds(clampWidgetBounds(saved, workArea)));
    } catch { /* Ignore invalid saved geometry. */ }
    const poller = window.setInterval(() => {
      void api.getBounds().then((bounds) => {
        if (bounds) localStorage.setItem(WIDGET_BOUNDS_KEY, JSON.stringify(bounds));
      });
    }, 1200);
    return () => window.clearInterval(poller);
  }, []);

  const openPanel = useCallback(async () => {
    const api = window.desktopApi?.widget;
    setPanelOpen(true);
    if (!api) return;
    const [current, workArea] = await Promise.all([api.getBounds(), api.getWorkArea()]);
    if (!current) return;
    const expansion = getExpandedWidgetBounds(current, workArea);
    if (expansion.autoExpanded) {
      autoExpansionRef.current = { previousHeight: expansion.previousHeight, expandedHeight: expansion.bounds.height };
      await api.setBounds(expansion.bounds);
    }
  }, []);

  const closePanel = useCallback(async () => {
    setPanelOpen(false);
    const api = window.desktopApi?.widget;
    const expansion = autoExpansionRef.current;
    autoExpansionRef.current = null;
    if (!api || !expansion) return;
    const current = await api.getBounds();
    if (current?.height === expansion.expandedHeight) await api.setBounds({ ...current, height: expansion.previousHeight });
  }, []);

  useEffect(() => {
    if (!panelOpen) return;
    firstPanelActionRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") void closePanel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closePanel, panelOpen]);

  const togglePanel = useCallback(() => {
    if (panelOpen) void closePanel();
    else void openPanel();
  }, [closePanel, openPanel, panelOpen]);

  return (
    <WidgetView
      snapshot={snapshot}
      elapsedSeconds={elapsedSeconds}
      layout={layout}
      panelOpen={panelOpen}
      firstPanelActionRef={firstPanelActionRef}
      onToggleTimer={() => send({ type: snapshot.timerRunning ? "timerPause" : "timerResume" })}
      onTogglePanel={togglePanel}
      onClosePanel={() => { void closePanel(); }}
      onToggleAlwaysOnTop={() => send({ type: "setAlwaysOnTop", enabled: !snapshot.alwaysOnTop })}
      onOpacityChange={(value) => send(opacityAction(value))}
      onResetPosition={() => { send({ type: "resetPosition" }); void closePanel(); }}
      onCloseWidget={() => { void window.desktopApi?.widget?.close(); }}
    />
  );
}
