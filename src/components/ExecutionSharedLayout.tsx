import React, { type CSSProperties } from "react";
import { TaskBlock } from "./TaskBlock";
import type { Language } from "../types";

/**
 * ExecutionSharedLayout — the real shared layout primitives used by BOTH the
 * execution page and the template modal.
 *
 * These components are extracted into their own module so that reuse is
 * enforced via real ES-module `import` statements, not by being in the same
 * file scope. The execution page render path and the `ScheduleTemplateModal`
 * render path both `import` from this module — if either caller stops
 * importing these components, that is a real regression visible in the import
 * graph, not just a styling drift.
 *
 * Exported components:
 *   - ExecutionSplitLayout   (the `<main class="df-execute">` 2-column grid)
 *   - CandidatePanelShell    (`<section class="df-candidate-panel">`)
 *   - CandidatePanelHeader   (`<div class="df-panel-title">`)
 *   - CandidateBlock         (list-row primitive over `TaskBlock variant="candidate"`)
 *   - TimelineCanvas         (`df-timeline-scroll` + `df-timeline-canvas` container)
 *   - TimelineEventBlock     (scheduled-block primitive over `TaskBlock variant="scheduled"`)
 *
 * Every component renders a `data-reuse` attribute so the actual DOM path
 * can be inspected to prove the reused component is on screen.
 */

/**
 * ExecutionSplitLayout — the real execution-page 2-column grid
 * (`<main className="df-execute">`). The grid template, column widths, gap,
 * padding and height all come from the single `.df-execute` CSS rule.
 *
 * Used by BOTH the execution page and the template modal so the outer layout
 * is identical by construction.
 */
export function ExecutionSplitLayout({
  left,
  right,
  className,
  children,
}: {
  left?: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <main
      className={`df-execute${className ? ` ${className}` : ""}`}
      data-reuse="execution-split-layout"
    >
      {children ?? (
        <>
          {left}
          {right}
        </>
      )}
    </main>
  );
}

/**
 * CandidatePanelShell — the shared left-panel section wrapper.
 * Renders `<section className="df-candidate-panel">` — the SAME CSS class the
 * execution page uses for Today's Candidates. Both callers wrap their panel
 * content in this shell so the panel border, radius, surface, padding, and
 * width are identical by construction.
 */
export function CandidatePanelShell({
  className,
  ariaHidden,
  ariaLabel,
  onDragOver,
  onDrop,
  children,
}: {
  className?: string;
  ariaHidden?: boolean;
  ariaLabel?: string;
  onDragOver?: React.DragEventHandler<HTMLElement>;
  onDrop?: React.DragEventHandler<HTMLElement>;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`df-candidate-panel${className ? ` ${className}` : ""}`}
      aria-hidden={ariaHidden}
      aria-label={ariaLabel}
      onDragOver={onDragOver}
      onDrop={onDrop}
      data-reuse="candidate-panel-shell"
    >
      {children}
    </section>
  );
}

/**
 * CandidatePanelHeader — the shared panel title strip.
 * Renders `<div className="df-panel-title"><h2>{title}</h2><div>{actions}</div></div>`
 * — the SAME structure the execution page uses for its candidate panel header.
 */
export function CandidatePanelHeader({
  title,
  actions,
}: {
  title: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="df-panel-title" data-reuse="candidate-panel-header">
      <h2>{title}</h2>
      {actions ? <div>{actions}</div> : null}
    </div>
  );
}

/**
 * CandidateBlock — the shared list-row visual primitive for items inside a
 * candidate panel. Renders `<TaskBlock variant="candidate">` — the SAME
 * shared component that `TaskCard` (execution page candidate items) composes.
 *
 * mode="template"      — a selectable template row (title + meta + actions)
 * mode="template-new"  — the "+ new template" row (icon + title + meta)
 */
export function CandidateBlock({
  mode,
  selected,
  title,
  meta,
  actions,
  icon,
  badge,
  onClick,
  onDoubleClick,
  onPointerDown,
  children,
}: {
  mode: "template" | "template-new";
  selected?: boolean;
  title: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLElement>;
  onDoubleClick?: React.MouseEventHandler<HTMLElement>;
  onPointerDown?: React.PointerEventHandler<HTMLElement>;
  children?: React.ReactNode;
}) {
  return (
    <TaskBlock
      as="div"
      variant="candidate"
      appearance="calm"
      selected={selected}
      className={`df-candidate-block df-candidate-block--${mode}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onPointerDown={onPointerDown}
      main={
        <span className="df-candidate-block-content">
          {children}
          <span className="df-candidate-block-title">{title}</span>
          {meta ? <small className="df-candidate-block-meta">{meta}</small> : null}
        </span>
      }
      trailing={
        <>
          {badge ? <span className="df-candidate-block-badge">{badge}</span> : null}
          {actions ? <span className="df-candidate-block-actions">{actions}</span> : null}
          {icon ? <span className="df-candidate-block-icon">{icon}</span> : null}
        </>
      }
    />
  );
}

/**
 * TimelineCanvas — the shared timeline scroll container + positioned canvas.
 * Renders `df-timeline-scroll` (scroll container) wrapping `df-timeline-canvas`
 * (the absolutely-positioned canvas whose height sets the total scrollable
 * range). The hour grid, event blocks, now-line, etc. are passed as `children`
 * so each caller keeps its own grid logic.
 *
 * Used by BOTH the execution page daily timeline and the template modal
 * timeline.
 */
export function TimelineCanvas({
  scrollRef,
  canvasRef,
  height,
  canvasClassName,
  onScrollPointerDown,
  onScrollPointerMove,
  onScrollPointerUp,
  onScrollDragOver,
  onScrollDrop,
  onScrollDragLeave,
  onCanvasPointerDown,
  onCanvasPointerMove,
  onCanvasPointerUp,
  onCanvasPointerCancel,
  onCanvasMouseDown,
  onCanvasClick,
  children,
}: {
  scrollRef?: React.Ref<HTMLDivElement>;
  canvasRef?: React.Ref<HTMLDivElement>;
  height: number;
  canvasClassName?: string;
  onScrollPointerDown?: React.PointerEventHandler<HTMLDivElement>;
  onScrollPointerMove?: React.PointerEventHandler<HTMLDivElement>;
  onScrollPointerUp?: React.PointerEventHandler<HTMLDivElement>;
  onScrollDragOver?: React.DragEventHandler<HTMLDivElement>;
  onScrollDrop?: React.DragEventHandler<HTMLDivElement>;
  onScrollDragLeave?: React.DragEventHandler<HTMLDivElement>;
  onCanvasPointerDown?: React.PointerEventHandler<HTMLDivElement>;
  onCanvasPointerMove?: React.PointerEventHandler<HTMLDivElement>;
  onCanvasPointerUp?: React.PointerEventHandler<HTMLDivElement>;
  onCanvasPointerCancel?: React.PointerEventHandler<HTMLDivElement>;
  onCanvasMouseDown?: React.MouseEventHandler<HTMLDivElement>;
  onCanvasClick?: React.MouseEventHandler<HTMLDivElement>;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="df-timeline-scroll"
      ref={scrollRef}
      onPointerDown={onScrollPointerDown}
      onPointerMove={onScrollPointerMove}
      onPointerUp={onScrollPointerUp}
      onDragOver={onScrollDragOver}
      onDrop={onScrollDrop}
      onDragLeave={onScrollDragLeave}
      data-reuse="timeline-canvas"
    >
      <div
        ref={canvasRef}
        className={`df-timeline-canvas${canvasClassName ? ` ${canvasClassName}` : ""}`}
        style={{ height: `${height}px` }}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={onCanvasPointerUp}
        onPointerCancel={onCanvasPointerCancel}
        onMouseDown={onCanvasMouseDown}
        onClick={onCanvasClick}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * TimelineEventBlock — the shared scheduled-block visual primitive for
 * timeline events. Renders `<TaskBlock variant="scheduled">` — the SAME
 * shared component that `TimeBlock` (execution page scheduled blocks)
 * composes. Template period blocks use this so the visual language matches
 * execution scheduled blocks by construction.
 *
 * mode="template"    — a template period block (resize dots + title + time range + delete)
 * mode="execution"   — reserved for future use; execution currently uses `TimeBlock`
 *                      which composes the same `TaskBlock variant="scheduled"` primitive.
 */
export function TimelineEventBlock({
  mode,
  title,
  timeRange,
  selected,
  style,
  className,
  dataAttrs,
  onPointerDown,
  onClick,
  onResizeStart,
  onDelete,
  editing,
  editingTitle,
  onTitleChange,
  onTitleCommit,
  onTitleCancel,
  lang,
  children,
}: {
  mode: "template" | "execution";
  title: string;
  timeRange?: string;
  selected?: boolean;
  style?: CSSProperties;
  className?: string;
  dataAttrs?: Record<string, string | undefined>;
  onPointerDown?: React.PointerEventHandler<HTMLElement>;
  onClick?: React.MouseEventHandler<HTMLElement>;
  onResizeStart?: (edge: "top" | "bottom") => React.PointerEventHandler<HTMLElement>;
  onDelete?: React.MouseEventHandler<HTMLElement>;
  editing?: boolean;
  editingTitle?: string;
  onTitleChange?: (value: string) => void;
  onTitleCommit?: () => void;
  onTitleCancel?: () => void;
  lang?: Language;
  children?: React.ReactNode;
}) {
  const untitled = lang === "zh" ? "未命名" : "Untitled";
  return (
    <TaskBlock
      as="div"
      variant="scheduled"
      appearance="calm"
      selected={selected}
      className={className}
      style={style}
      dataAttrs={{ ...dataAttrs, reuse: "timeline-event-block" }}
      onPointerDown={onPointerDown}
      onClick={onClick}
      main={
        <>
          {onResizeStart ? (
            <div className="df-resize-dot top" onPointerDown={onResizeStart("top")} />
          ) : null}
          <div className="df-time-block-body">
            {editing && onTitleChange ? (
              <input
                className="df-template-period-title-input"
                autoFocus
                value={editingTitle}
                onChange={(e) => onTitleChange(e.target.value)}
                onBlur={onTitleCommit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onTitleCommit?.();
                  if (e.key === "Escape") onTitleCancel?.();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="df-time-block-title">{title || untitled}</span>
            )}
            {timeRange ? <span className="df-time-block-time">{timeRange}</span> : null}
            {children}
          </div>
          {onResizeStart ? (
            <div className="df-resize-dot bottom" onPointerDown={onResizeStart("bottom")} />
          ) : null}
          {onDelete ? (
            <button
              type="button"
              className="df-template-period-delete"
              aria-label={lang === "zh" ? "删除时间段" : "Delete period"}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onDelete(e); }}
            >×</button>
          ) : null}
        </>
      }
    />
  );
}
