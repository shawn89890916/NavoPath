import React, { type CSSProperties, type ReactNode } from "react";

export type TaskBlockVariant = "candidate" | "planning" | "scheduled" | "allDay" | "compact" | "habit-child";
export type TaskBlockDensity = "normal" | "compact" | "dense";
export type TaskBlockAppearance = "calm" | "medium" | "custom";
export type TaskBlockPriority = "low" | "normal" | "high" | "urgent";
export type TaskBlockDragState = "overlay" | "source-placeholder";

export type TaskBlockClassOptions = {
  variant?: TaskBlockVariant;
  appearance?: TaskBlockAppearance;
  priority?: TaskBlockPriority;
  checked?: boolean;
  selected?: boolean;
  dragging?: boolean;
  dragState?: TaskBlockDragState;
  disabled?: boolean;
  className?: string;
};

export type TaskBlockStyleOptions = {
  projectColor?: string;
  density?: TaskBlockDensity;
  style?: CSSProperties;
};

const DEFAULT_APPEARANCE: TaskBlockAppearance = "calm";

export function taskBlockClassNames(options: TaskBlockClassOptions) {
  return [
    "df-task-block",
    `df-task-block--${options.variant || "candidate"}`,
    `df-task-block--appearance-${options.appearance || DEFAULT_APPEARANCE}`,
    options.priority ? `df-task-block--priority-${options.priority}` : "",
    options.checked ? "is-checked" : "",
    options.selected ? "is-selected" : "",
    options.dragging ? "is-dragging" : "",
    options.disabled ? "is-disabled" : "",
    options.className || "",
  ].filter(Boolean).join(" ");
}

export function taskBlockStyle(options: TaskBlockStyleOptions): CSSProperties {
  const projectColor = options.projectColor || "var(--accent-active)";
  return {
    "--task-project-color": projectColor,
    "--cat": projectColor,
    "--task-block-density": options.density || "normal",
    ...options.style,
  } as CSSProperties;
}

export function taskBlockDataAttrs(options: TaskBlockClassOptions): Record<string, string | undefined> {
  return {
    "data-task-appearance": options.appearance || DEFAULT_APPEARANCE,
    "data-task-variant": options.variant || "candidate",
    "data-task-priority": options.priority,
    "data-task-checked": options.checked ? "true" : undefined,
    "data-task-selected": options.selected ? "true" : undefined,
    "data-drag-state": options.dragState,
  };
}

type TaskBlockProps = TaskBlockClassOptions & TaskBlockStyleOptions & {
  as?: "article" | "div" | "button" | "section";
  children?: ReactNode;
  leading?: ReactNode;
  main?: ReactNode;
  trailing?: ReactNode;
  accent?: ReactNode;
  role?: string;
  title?: string;
  type?: "button" | "submit" | "reset";
  tabIndex?: number;
  draggable?: boolean;
  dataAttrs?: Record<string, string | undefined>;
  ariaLabel?: string;
  ariaPressed?: boolean;
  ariaGrabbed?: boolean;
  onClick?: React.MouseEventHandler<HTMLElement>;
  onDoubleClick?: React.MouseEventHandler<HTMLElement>;
  onMouseEnter?: React.MouseEventHandler<HTMLElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLElement>;
  onPointerDown?: React.PointerEventHandler<HTMLElement>;
  onPointerMove?: React.PointerEventHandler<HTMLElement>;
  onPointerUp?: React.PointerEventHandler<HTMLElement>;
  onPointerCancel?: React.PointerEventHandler<HTMLElement>;
  onDragStart?: React.DragEventHandler<HTMLElement>;
  onDragEnd?: React.DragEventHandler<HTMLElement>;
};

export const TaskBlock = React.forwardRef<HTMLElement, TaskBlockProps>(function TaskBlock({
  as = "article",
  children,
  leading,
  main,
  trailing,
  accent,
  dataAttrs,
  ariaLabel,
  ariaPressed,
  ...props
}: TaskBlockProps, ref) {
  const Component = as;
  const className = taskBlockClassNames(props);
  const style = taskBlockStyle(props);
  const baseData = taskBlockDataAttrs(props);
  const extraData = Object.fromEntries(
    Object.entries(dataAttrs || {}).map(([key, value]) => [`data-${key}`, value])
  );

  return (
    <Component
      ref={ref as never}
      className={className}
      style={style}
      role={props.role}
      title={props.title}
      type={props.type}
      tabIndex={props.tabIndex}
      draggable={props.draggable}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      aria-grabbed={props.ariaGrabbed}
      onClick={props.onClick}
      onDoubleClick={props.onDoubleClick}
      onMouseEnter={props.onMouseEnter}
      onMouseLeave={props.onMouseLeave}
      onPointerDown={props.onPointerDown}
      onPointerMove={props.onPointerMove}
      onPointerUp={props.onPointerUp}
      onPointerCancel={props.onPointerCancel}
      onDragStart={props.onDragStart}
      onDragEnd={props.onDragEnd}
      {...baseData}
      {...extraData}
    >
      {accent ?? <span className="df-task-block-accent" aria-hidden="true" />}
      {children || (
        <span className="df-task-block-grid">
          {leading ? <span className="df-task-block-leading">{leading}</span> : null}
          <span className="df-task-block-main">{main}</span>
          {trailing ? <span className="df-task-block-trailing">{trailing}</span> : null}
        </span>
      )}
    </Component>
  );
});

/**
 * TaskBlockRow — the shared grid anatomy: [ checkbox ][ content ][ duration ][ actions ].
 * Layout stays consistent across variants; only visual intensity changes via appearance tokens.
 */
export function TaskBlockRow({
  children,
  className,
  align = "center",
}: {
  children?: ReactNode;
  className?: string;
  align?: "center" | "start";
}) {
  return (
    <span
      className={["df-task-block-row", align === "start" ? "is-align-start" : "", className || ""].filter(Boolean).join(" ")}
    >
      {children}
    </span>
  );
}

/**
 * TaskBlockContent — title + optional metadata/tags. min-width: 0 so title can truncate.
 */
export function TaskBlockContent({
  children,
  className,
  title,
}: {
  children?: ReactNode;
  className?: string;
  title?: ReactNode;
}) {
  return (
    <span className={["df-task-block-content", className || ""].filter(Boolean).join(" ")}>
      {title != null ? <span className="df-task-block-title">{title}</span> : null}
      {children}
    </span>
  );
}

/**
 * TaskBlockDuration — right-aligned, nowrap duration pill.
 */
export function TaskBlockDuration({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  if (children == null) return null;
  return <span className={["df-task-block-duration", className || ""].filter(Boolean).join(" ")}>{children}</span>;
}

/**
 * TaskBlockActions — inline-flex action group, aligned center, no shrink.
 */
export function TaskActions({ children, className, onClick }: { children?: ReactNode; className?: string; onClick?: React.MouseEventHandler<HTMLSpanElement> }) {
  if (!children) return null;
  return <span className={["df-task-actions", "df-task-block-actions", className || ""].filter(Boolean).join(" ")} onClick={onClick}>{children}</span>;
}

/**
 * TaskBlockAccent — project accent visual layer (bottom line / full border / left rule).
 * Rendered separately from content so project color never dominates title/duration/icons.
 */
export function TaskBlockAccent({ position = "bottom" }: { position?: "bottom" | "left" | "full" }) {
  return <span className={`df-task-block-accent df-task-block-accent--${position}`} aria-hidden="true" />;
}

/**
 * TaskGroup — neutral container for grouped items (habits, project groups, etc.).
 * Keeps child task blocks visually subordinate and avoids conflicting borders.
 */
export function TaskGroup({
  children,
  className,
  title,
  count,
  onClick,
  ariaLabel,
}: {
  children?: ReactNode;
  className?: string;
  title?: ReactNode;
  count?: ReactNode;
  onClick?: React.MouseEventHandler<HTMLElement>;
  ariaLabel?: string;
}) {
  return (
    <section className={["df-task-group", className || ""].filter(Boolean).join(" ")} onClick={onClick} aria-label={ariaLabel}>
      {(title != null || count != null) && (
        <header className="df-task-group-header">
          {title != null ? <span className="df-task-group-title">{title}</span> : null}
          {count != null ? <span className="df-task-group-count">{count}</span> : null}
        </header>
      )}
      <div className="df-task-group-list">{children}</div>
    </section>
  );
}

export function TaskCheckbox({
  checked,
  tone = "muted",
  returned,
  importance,
  urgency,
  children,
  className,
  title,
  ariaLabel,
  onClick,
  onMouseDown,
  onPointerDown,
}: {
  checked?: boolean;
  tone?: string;
  returned?: boolean;
  importance?: "high" | "medium" | "low" | null;
  urgency?: "high" | "medium" | "low" | null;
  children?: ReactNode;
  className?: string;
  title?: string;
  ariaLabel?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  onMouseDown?: React.MouseEventHandler<HTMLButtonElement>;
  onPointerDown?: React.PointerEventHandler<HTMLButtonElement>;
}) {
  const imp = importance || "unset";
  const urg = urgency || "unset";
  return (
    <span className="df-task-checkbox-wrap" data-importance={imp} data-urgency={urg}>
      <button
        type="button"
        className={[
          "df-block-check",
          "df-task-block-check",
          `check-${tone}`,
          checked ? "completed" : "",
          returned ? "returned-unfinished" : "",
          className || "",
        ].filter(Boolean).join(" ")}
        title={title}
        aria-label={ariaLabel}
        aria-pressed={checked}
        onClick={onClick}
        onMouseDown={onMouseDown}
        onPointerDown={onPointerDown}
      >
        {children}
      </button>
      {urg !== "unset" && !checked && (
        <span className="df-task-urgency-mark" data-urgency={urg} aria-hidden="true">!</span>
      )}
    </span>
  );
}
