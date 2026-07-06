import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PlannerData, Project, Settings, Subtask, Task, WorkflowStatus } from "./types";
import { t, type Language } from "./i18n";
import { useInAppDialog } from "./InAppDialog";
import { localIsoDate } from "./utils/localDate";
import { buildTaskMetaBadges } from "./utils/taskMetaBadges";
import { kanbanGroups, WORKFLOW_LABELS } from "./utils/productivity";
import { normalizeTaskCheckTone, normalizeWorkflowStatus, workflowStatusForPatch, type UiWorkflowStatus, type StateFilterValue } from "./utils/productivityModel";
import { normalizeTreeOrder, reorderProjects, reorderSubtasks, reorderTasks, findSubtaskInTree, removeSubtaskFromTree, addSubtaskToTree, countSubtasks, countDoneSubtasks } from "./utils/treeOrder";
import { TaskActions, TaskBlock, TaskBlockContent, TaskBlockDuration, TaskBlockRow, TaskCheckbox, type TaskBlockVariant } from "./components/TaskBlock";
import { TaskDragLayer } from "./unifiedDrag";
import { buildTimeAllocationMetrics, parseDayStartMinutes, type MetricCompletionFilter, type MetricDisplayMetric, type MetricGroupBy, type MetricHabitMode, type MetricRangePreset, type TimeAllocationGroup } from "./metrics/timeAllocation";

type TreeNodeKind = "project" | "task" | "subtask";
type TreeDragNode = { kind: TreeNodeKind; id: string };
type TreeDropTarget = TreeDragNode & { position: "before" | "inside" | "after"; top: number; left: number; width: number };
type PlanningDropContainer = string;

const DEFAULT_PROJECT_COLOR = "var(--accent-plan, #CAFF72)";
const UNASSIGNED_COLOR = "#7B8191";
const DRAG_START_THRESHOLD_PX = 5;
const SUPPRESS_CLICK_AFTER_DRAG_MS = 220;

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

function todayIso() {
  return localIsoDate();
}

function truncate(text: string, max: number) {
  if (!text || text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function alphaColor(color: string, alpha: number) {
  if (!color) return `rgba(202, 255, 114, ${alpha})`;
  const hex = color.trim();
  if (/^#([0-9a-f]{3}){1,2}$/i.test(hex)) {
    const value = hex.slice(1);
    const full = value.length === 3
      ? value.split("").map((ch) => ch + ch).join("")
      : value;
    const r = Number.parseInt(full.slice(0, 2), 16);
    const g = Number.parseInt(full.slice(2, 4), 16);
    const b = Number.parseInt(full.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

function polarPoint(cx: number, cy: number, radius: number, angle: number) {
  const radians = (angle - 90) * Math.PI / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

function donutSegmentPath(cx: number, cy: number, outerRadius: number, innerRadius: number, startAngle: number, endAngle: number) {
  const safeEndAngle = Math.min(endAngle, startAngle + 359.99);
  const outerStart = polarPoint(cx, cy, outerRadius, safeEndAngle);
  const outerEnd = polarPoint(cx, cy, outerRadius, startAngle);
  const innerStart = polarPoint(cx, cy, innerRadius, startAngle);
  const innerEnd = polarPoint(cx, cy, innerRadius, safeEndAngle);
  const largeArc = safeEndAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 0 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 1 ${innerEnd.x} ${innerEnd.y}`,
    "Z",
  ].join(" ");
}

function formatMinutesZh(minutes: number) {
  const safe = Math.max(0, Math.round(minutes || 0));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hours <= 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function localDateTimeLabel(date: Date) {
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function localDateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function metricViewLabel(lang: Language, mode: PlanningViewMode) {
  if (mode === "tree") return lang === "zh" ? "树" : "Tree";
  if (mode === "kanban") return "Kanban";
  if (mode === "eisenhower") return lang === "zh" ? "矩阵" : "Matrix";
  if (mode === "metrics") return lang === "zh" ? "指标" : "Metrics";
  return lang === "zh" ? "列表" : "List";
}

function planningTaskPriority(task: Pick<Task, "importance" | "urgency">) {
  if (task.urgency === "high" && task.importance === "high") return "urgent";
  if (task.importance === "high") return "high";
  if (task.urgency === "low" && task.importance === "low") return "low";
  return "normal";
}

function createProjectShell(title: string): Project {
  return {
    id: "__unassigned__",
    title,
    category: "project",
    notes: "",
    completed: false,
    color: UNASSIGNED_COLOR,
    createdAt: "",
    updatedAt: "",
  };
}

function CheckIcon({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 12 12" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 6.2 4.8 9 10 3" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {open ? <path d="M4 6.5 8 10.5 12 6.5" /> : <path d="M6 4 10 8 6 12" />}
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h8" />
      <path d="M8.5 4.5 12 8l-3.5 3.5" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
      <circle cx="3" cy="8" r="1.3" />
      <circle cx="8" cy="8" r="1.3" />
      <circle cx="13" cy="8" r="1.3" />
    </svg>
  );
}

interface TooltipState {
  text: string;
  x: number;
  y: number;
}

let tooltipTimer: ReturnType<typeof setTimeout> | null = null;

function useTooltip() {
  const [tip, setTip] = useState<TooltipState | null>(null);

  const showTip = useCallback((text: string, target: HTMLElement) => {
    if (tooltipTimer) clearTimeout(tooltipTimer);
    const rect = target.getBoundingClientRect();
    setTip({ text, x: rect.left + rect.width / 2, y: rect.top - 10 });
  }, []);

  const hideTip = useCallback(() => {
    tooltipTimer = setTimeout(() => setTip(null), 80);
  }, []);

  const tooltipEl = tip
    ? createPortal(
        <span className="df-tree-tooltip" style={{ left: tip.x, top: tip.y }}>
          {tip.text}
        </span>,
        document.body,
      )
    : null;

  return { tooltipEl, showTip, hideTip };
}

function TreeMenu(props: {
  open: boolean;
  onClose: () => void;
  actions: Array<{ label: string; danger?: boolean; onClick: () => void }>;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!props.open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current?.contains(event.target as Node)) return;
      props.onClose();
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [props.open, props]);

  if (!props.open) return null;
  return (
    <div className="df-tree-menu" ref={ref} onClick={(event) => event.stopPropagation()}>
      {props.actions.map((action) => (
        <button
          key={action.label}
          className={action.danger ? "danger" : ""}
          onClick={() => {
            action.onClick();
            props.onClose();
          }}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

function PlanningSubtaskNode(props: {
  lang: Language;
  subtask: Subtask;
  projectColor: string;
  onToggle: (subtaskId: string) => void;
  onPromote: (subtaskId: string) => void;
  onRename: (subtaskId: string) => void;
  onSetDate: (subtaskId: string) => void;
  onMoveProject: (subtaskId: string) => void;
  onDelete: (subtaskId: string) => void;
  onAddSubtask: (parentId: string) => void;
  dragging?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const { tooltipEl, showTip, hideTip } = useTooltip();
  const titleRef = useRef<HTMLSpanElement>(null);
  const done = Boolean(props.subtask.completed || props.subtask.done);
  const childSubtasks = props.subtask.subtasks || [];
  const hasChildren = childSubtasks.length > 0;

  return (
    <>
      {tooltipEl}
      <div
        className={`df-plan-subtask-node ${done ? "done" : ""}${hasChildren ? " has-children" : ""}`}
        data-node-id={props.subtask.id}
        data-node-type="subtask"
        aria-grabbed={props.dragging}
        style={{ "--project-color": props.projectColor, "--task-project-color": props.projectColor } as React.CSSProperties}
      >
        <TaskBlock
          as="div"
          variant="habit-child"
          appearance="calm"
          checked={done}
          projectColor={props.projectColor}
          className="df-subtask-inner"
          dragState={props.dragging ? "source-placeholder" : undefined}
          dataAttrs={{ "planning-drag-card": props.subtask.id }}
          ariaGrabbed={props.dragging}
        >
          <TaskBlockRow>
            <TaskCheckbox
              checked={done}
              tone="muted"
              className={`df-subtask-check ${done ? "done" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                props.onToggle(props.subtask.id);
              }}
              ariaLabel={done ? t(props.lang, "planning.markIncomplete") : t(props.lang, "planning.markComplete")}
            >
              {done && <CheckIcon size={10} />}
            </TaskCheckbox>
            <TaskBlockContent
              title={(
                <span
                  className="df-subtask-title"
                  ref={titleRef}
                  onMouseEnter={() => {
                    if (titleRef.current && titleRef.current.scrollWidth > titleRef.current.clientWidth) {
                      showTip(props.subtask.title, titleRef.current);
                    }
                  }}
                  onMouseLeave={hideTip}
                >
                  {props.subtask.title}
                </span>
              )}
            />
            <TaskActions className="df-task-node-actions">
              {hasChildren && (
                <button
                  className="df-task-chevron df-subtask-chevron"
                  onClick={(event) => {
                    event.stopPropagation();
                    setCollapsed((v) => !v);
                  }}
                  aria-label={collapsed ? t(props.lang, "planning.expandSubtasks") : t(props.lang, "planning.collapseSubtasks")}
                >
                  <ChevronIcon open={!collapsed} />
                </button>
              )}
              <button
                className="df-tree-icon-button"
                onClick={(event) => {
                  event.stopPropagation();
                  props.onPromote(props.subtask.id);
                }}
                aria-label={t(props.lang, "planning.addToCandidate")}
              >
                <ArrowRightIcon />
              </button>
              <button
                className="df-tree-icon-button"
                onClick={(event) => {
                  event.stopPropagation();
                  setMenuOpen((open) => !open);
                }}
                aria-label={t(props.lang, "planning.more")}
              >
                <MoreIcon />
              </button>
            </TaskActions>
          </TaskBlockRow>
        </TaskBlock>
        <TreeMenu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          actions={[
            { label: t(props.lang, "planning.editName"), onClick: () => props.onRename(props.subtask.id) },
            { label: t(props.lang, "planning.addSubtask"), onClick: () => { setCollapsed(false); props.onAddSubtask(props.subtask.id); } },
            { label: t(props.lang, "planning.setDate"), onClick: () => props.onSetDate(props.subtask.id) },
            { label: t(props.lang, "planning.moveToProject"), onClick: () => props.onMoveProject(props.subtask.id) },
            { label: t(props.lang, "planning.delete"), danger: true, onClick: () => props.onDelete(props.subtask.id) },
          ]}
        />
        {hasChildren && !collapsed && (
          <div className="df-subtask-children">
            {childSubtasks.map((child) => (
              <PlanningSubtaskNode
                key={child.id}
                lang={props.lang}
                subtask={child}
                projectColor={props.projectColor}
                onToggle={props.onToggle}
                onPromote={props.onPromote}
                onRename={props.onRename}
                onSetDate={props.onSetDate}
                onMoveProject={props.onMoveProject}
                onDelete={props.onDelete}
                onAddSubtask={props.onAddSubtask}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function PlanningTaskNode(props: {
  lang: Language;
  task: Task;
  addedToToday: boolean;
  projectColor: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpen: () => void;
  onToggleTodayCandidate: () => void;
  onRename: () => void;
  onAddSubtask: () => void;
  onSetDate: () => void;
  onMoveProject: () => void;
  onDelete: () => void;
  onToggleComplete: () => void;
  onToggleSubtask: (subtaskId: string) => void;
  dragging?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { tooltipEl, showTip, hideTip } = useTooltip();
  const titleRef = useRef<HTMLSpanElement>(null);
  const done = normalizeWorkflowStatus(props.task) === "done" || Boolean(props.task.completed);
  const hasSubtasks = (props.task.subtasks || []).length > 0;
  const doneCount = countDoneSubtasks(props.task.subtasks);
  const totalCount = countSubtasks(props.task.subtasks);
  const metaBadges = buildTaskMetaBadges(props.task, props.lang);

  return (
    <>
      {tooltipEl}
      <div
        className={`df-plan-task-node${props.addedToToday ? " added-to-today" : ""}`}
        data-node-id={props.task.id}
        data-node-type="task"
        aria-grabbed={props.dragging}
        style={{ "--project-color": props.projectColor, "--task-project-color": props.projectColor } as React.CSSProperties}
      >
        <TaskBlock
          as="div"
          variant="planning"
          appearance="calm"
          priority={planningTaskPriority(props.task)}
          checked={done}
          selected={props.addedToToday}
          projectColor={props.projectColor}
          className="df-task-node-inner"
          dragState={props.dragging ? "source-placeholder" : undefined}
          dataAttrs={{ "planning-drag-card": props.task.id }}
          ariaGrabbed={props.dragging}
          onClick={props.onOpen}
        >
          <TaskBlockRow>
            <TaskCheckbox
              checked={done}
              tone={normalizeTaskCheckTone(props.task)}
              importance={props.task.importance}
              urgency={props.task.urgency}
              className="df-list-status-toggle df-planning-task-check"
              ariaLabel={done ? "Mark open" : "Mark done"}
              onClick={(event) => {
                event.stopPropagation();
                props.onToggleComplete();
              }}
            />
            <TaskBlockContent
              className="df-planning-task-copy"
              title={(
                <span
                  className="df-task-title"
                  ref={titleRef}
                  onMouseEnter={() => {
                    if (titleRef.current && titleRef.current.scrollWidth > titleRef.current.clientWidth) {
                      showTip(props.task.title, titleRef.current);
                    }
                  }}
                  onMouseLeave={hideTip}
                >
                  {props.task.title}
                </span>
              )}
            >
              {(metaBadges.length > 0 || hasSubtasks || props.addedToToday) && (
                <span className="df-task-meta-badges" aria-label={props.lang === "zh" ? "Task status" : "Task status"}>
                  {metaBadges.map((badge) => (
                    <span key={badge.key} className={badge.className}>{badge.label}</span>
                  ))}
                  {hasSubtasks && <span className="df-subtask-progress">{doneCount}/{totalCount}</span>}
                  {props.addedToToday && <span className="df-added-today-label">{props.lang === "zh" ? "Today" : "Today"}</span>}
                </span>
              )}
            </TaskBlockContent>
            <TaskActions className="df-task-node-actions">
              {hasSubtasks && (
                <button
                  className="df-task-chevron"
                  onClick={(event) => {
                    event.stopPropagation();
                    props.onToggleCollapse();
                  }}
                  aria-label={props.collapsed ? t(props.lang, "planning.expandSubtasks") : t(props.lang, "planning.collapseSubtasks")}
                >
                  <ChevronIcon open={!props.collapsed} />
                </button>
              )}
              <button
                className="df-tree-icon-button"
                onClick={(event) => {
                  event.stopPropagation();
                  props.onToggleTodayCandidate();
                }}
                aria-label={props.addedToToday
                  ? (props.lang === "zh" ? "Return to Planning" : "Return to Planning")
                  : t(props.lang, "planning.addToCandidate")}
                aria-pressed={props.addedToToday}
              >
                <ArrowRightIcon />
              </button>
              <button
                className="df-tree-icon-button"
                onClick={(event) => {
                  event.stopPropagation();
                  setMenuOpen((open) => !open);
                }}
                aria-label={t(props.lang, "planning.more")}
              >
                <MoreIcon />
              </button>
            </TaskActions>
          </TaskBlockRow>
          <TreeMenu
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            actions={[
              { label: t(props.lang, "planning.editName"), onClick: props.onRename },
              { label: t(props.lang, "planning.addSubtask"), onClick: props.onAddSubtask },
              { label: t(props.lang, "planning.setDate"), onClick: props.onSetDate },
              { label: t(props.lang, "planning.moveToProject"), onClick: props.onMoveProject },
              { label: t(props.lang, "planning.delete"), danger: true, onClick: props.onDelete },
            ]}
          />
        </TaskBlock>
      </div>
    </>
  );
}

function PlanningProjectNode(props: {
  lang: Language;
  project: Project;
  taskCount: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpen: () => void;
  onAddTask: () => void;
  onComplete?: () => void;
  dragging?: boolean;
}) {
  const { tooltipEl, showTip, hideTip } = useTooltip();
  const titleRef = useRef<HTMLSpanElement>(null);
  const color = props.project.color || DEFAULT_PROJECT_COLOR;

  return (
    <>
      {tooltipEl}
      <div
        className={`df-plan-project-node ${props.collapsed ? "collapsed" : ""}${props.dragging ? " is-dragging-source" : ""}`}
        data-node-id={props.project.id}
        data-node-type="project"
        data-planning-drag-card={props.project.id}
        aria-grabbed={props.dragging}
        style={{
          "--project-color": color,
          "--project-color-soft": alphaColor(color, 0.16),
          "--project-color-border": alphaColor(color, 0.34),
        } as React.CSSProperties}
      >
        <span className="df-project-color-bar" />
        <span
          className="df-project-name"
          ref={titleRef}
          onClick={props.onOpen}
          onMouseEnter={() => {
            if (titleRef.current && titleRef.current.scrollWidth > titleRef.current.clientWidth) {
              showTip(props.project.title, titleRef.current);
            }
          }}
          onMouseLeave={hideTip}
        >
          {props.project.title}
        </span>
        <span className="df-project-badge">{props.taskCount}</span>
        <div className="df-project-node-actions">
          {props.onComplete && !props.project.completed && (
            <button
              className="df-tree-icon-button df-project-complete-btn"
              onClick={(event) => {
                event.stopPropagation();
                props.onComplete?.();
              }}
              aria-label={props.lang === "zh" ? "Complete project" : "Complete project"}
            >
              <CheckIcon />
            </button>
          )}
          <button className="df-tree-icon-button df-project-add-btn" onClick={props.onAddTask} aria-label={t(props.lang, "planning.addTask")}>
            <PlusIcon />
          </button>
          <button className="df-tree-icon-button df-collapse-btn" onClick={props.onToggleCollapse} aria-label={props.collapsed ? t(props.lang, "planning.expandProject") : t(props.lang, "planning.collapseProject")}>
            <ChevronIcon open={!props.collapsed} />
          </button>
        </div>
      </div>
    </>
  );
}

function useTreeLines(
  treeRef: React.RefObject<HTMLDivElement | null>,
  projects: Project[],
  tasks: Task[],
  collapsedProjects: Record<string, boolean>,
  collapsedSubtasks: Record<string, boolean>,
) {
  const [lines, setLines] = useState<React.ReactNode>(null);

  useEffect(() => {
    const tree = treeRef.current;
    if (!tree) return;

    let frame = 0;
    const render = () => {
      const treeRect = tree.getBoundingClientRect();
      const paths: React.ReactNode[] = [];

      projects.forEach((project) => {
        if (collapsedProjects[project.id]) return;

        const projectEl = tree.querySelector(
          `[data-node-id="${CSS.escape(project.id)}"][data-node-type="project"]`,
        ) as HTMLElement | null;
        if (!projectEl) return;

        const projectRect = projectEl.getBoundingClientRect();
        const projectColor = project.color || DEFAULT_PROJECT_COLOR;
        const projectTaskList = tasks.filter(
          (t) => String(t.projectId || "") === String(project.id) && !t.completed,
        );
        if (projectTaskList.length === 0) return;

        // Simplified tree lines: subtle, minimal.
        // Collect task positions
        const taskPositions: Array<{
          id: string;
          top: number;
          bottom: number;
          centerY: number;
          left: number;
        }> = [];

        projectTaskList.forEach((task) => {
          const taskEl = tree.querySelector(
            `[data-node-id="${CSS.escape(task.id)}"][data-node-type="task"]`,
          ) as HTMLElement | null;
          if (!taskEl) return;
          const r = taskEl.getBoundingClientRect();
          taskPositions.push({
            id: task.id,
            top: r.top - treeRect.top,
            bottom: r.bottom - treeRect.top,
            centerY: r.top + r.height / 2 - treeRect.top,
            left: r.left - treeRect.left,
          });
        });

        if (taskPositions.length === 0) return;

        // Trunk x-position relative to tree: 28px indent from project left.
        const trunkX = 28;
        const projBottom = projectRect.bottom - treeRect.top;

        const firstCenterY = Math.min(...taskPositions.map((t) => t.centerY));
        const lastCenterY = Math.max(...taskPositions.map((t) => t.centerY));

        const colMain = alphaColor(projectColor, 0.08);
        const colBranch = alphaColor(projectColor, 0.05);

        // 1. Trunk: short vertical from project bottom to first task.
        paths.push(
          <path
            key={`trunk-${project.id}`}
            d={`M ${trunkX} ${projBottom + 8} L ${trunkX} ${firstCenterY}`}
            className="df-tree-line trunk"
            style={{ stroke: colMain }}
          />,
        );

        // 2. Vertical trunk connecting multiple tasks
        if (taskPositions.length > 1) {
          paths.push(
            <path
              key={`vtrunk-${project.id}`}
              d={`M ${trunkX} ${firstCenterY} L ${trunkX} ${lastCenterY}`}
              className="df-tree-line trunk"
              style={{ stroke: colMain }}
            />,
          );
        }

        // 3. Horizontal branches from trunk to each task (elbow connectors)
        taskPositions.forEach((tp) => {
          const endX = tp.left - 8;
          if (endX > trunkX + 8) {
            paths.push(
              <path
                key={`branch-${project.id}-${tp.id}`}
                d={`M ${trunkX} ${tp.centerY} L ${endX} ${tp.centerY}`}
                className="df-tree-line branch"
                style={{ stroke: colBranch }}
              />,
            );
          }
        });

        // 4. Subtask connectors (very subtle)
        projectTaskList.forEach((task) => {
          if (collapsedSubtasks[task.id]) return;
          const subs = task.subtasks || [];
          if (subs.length === 0) return;

          const subPositions: Array<{
            id: string;
            centerY: number;
            left: number;
          }> = [];

          subs.forEach((sub) => {
            const subEl = tree.querySelector(
              `[data-node-id="${CSS.escape(sub.id)}"][data-node-type="subtask"]`,
            ) as HTMLElement | null;
            if (!subEl) return;
            const r = subEl.getBoundingClientRect();
            subPositions.push({
              id: sub.id,
              centerY: r.top + r.height / 2 - treeRect.top,
              left: r.left - treeRect.left,
            });
          });

          if (subPositions.length === 0) return;

          const taskPos = taskPositions.find((tp) => tp.id === task.id);
          if (!taskPos) return;

          const subTrunkX = taskPos.left + 18;
          const taskBottom = taskPos.bottom;
          const subFirstCenterY = Math.min(...subPositions.map((s) => s.centerY));

          // Short drop line from task bottom to first subtask
          paths.push(
            <path
              key={`sub-conn-${task.id}`}
              d={`M ${subTrunkX} ${taskBottom + 4} L ${subTrunkX} ${subFirstCenterY}`}
              className="df-tree-line subtask-line"
              style={{ stroke: alphaColor(projectColor, 0.05) }}
            />,
          );
        });
      });

      setLines(
        <svg
          className="df-tree-svg"
          style={{ width: Math.max(tree.scrollWidth, 1), height: Math.max(tree.scrollHeight, 1) }}
        >
          {paths}
        </svg>,
      );
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(render);
    };

    schedule();
    const ro = new ResizeObserver(schedule);
    ro.observe(tree);
    tree.querySelectorAll("[data-node-type]").forEach((el) => ro.observe(el));
    tree.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      tree.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [projects, tasks, collapsedProjects, collapsedSubtasks, treeRef]);

  return lines;
}

type PlanningViewMode = "tree" | "kanban" | "eisenhower" | "list" | "metrics";

export default function PlanningView(props: {
  lang: Language;
  data: PlannerData;
  projects: Project[];
  tasks: Task[];
  compact: boolean;
  collapsed: Record<string, boolean>;
  setCollapsed: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onToggleTodayCandidate: (taskId: string) => void;
  onPromoteSubtaskToToday: (parentTaskId: string, subtaskId: string) => void;
  onProjectEdit: (project: Project) => void;
  onProjectComplete?: (projectId: string) => void;
  onTaskEdit: (task: Task) => void;
  onTaskUpdate: (taskId: string, patch: Partial<Task>) => void;
  onTaskCreate: (projectId: string) => void;
  onTaskDelete: (taskId: string) => void;
  onDeleteSubtask: (subtaskId: string) => void;
  onDataChange: (data: PlannerData) => void;
  featureKanban?: boolean;
  featureQuadrant?: boolean;
  featureList?: boolean;
  dayStartTime?: string;
  metricsRangePreset?: MetricRangePreset;
  metricsGroupBy?: MetricGroupBy;
  metricsDisplayMetric?: MetricDisplayMetric;
  metricsIncludeHabits?: MetricHabitMode;
  metricsCompletionFilter?: MetricCompletionFilter;
  metricsCustomStart?: string;
  metricsCustomEnd?: string;
  onMetricsSettingsChange?: (patch: Partial<Settings>) => void;
}) {
  const safeProjects = Array.isArray(props.projects) ? props.projects : [];
  const safeTasks = Array.isArray(props.tasks) ? props.tasks : [];
  const [collapsedSubtasks, setCollapsedSubtasks] = useState<Record<string, boolean>>({});
  const [showAddedTasks, setShowAddedTasks] = useState(false);
  const [dragNode, setDragNode] = useState<TreeDragNode | null>(null);
  const [dropTarget, setDropTarget] = useState<TreeDropTarget | null>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const dialog = useInAppDialog(props.lang);

  const enableKanban = props.featureKanban !== false;
  const enableQuadrant = props.featureQuadrant !== false;
  const enableList = props.featureList !== false;
  const availableModes = useMemo<PlanningViewMode[]>(() => {
    const modes: PlanningViewMode[] = ["tree"];
    if (enableKanban) modes.push("kanban");
    if (enableQuadrant) modes.push("eisenhower");
    if (enableList) modes.push("list");
    modes.push("metrics");
    return modes;
  }, [enableKanban, enableQuadrant, enableList]);
  const [viewMode, setViewMode] = useState<PlanningViewMode>("tree");
  const [metricsRangePreset, setMetricsRangePreset] = useState<MetricRangePreset>(props.metricsRangePreset || "today");
  const [metricsGroupBy, setMetricsGroupBy] = useState<MetricGroupBy>(props.metricsGroupBy || "project");
  const [metricsDisplayMetric, setMetricsDisplayMetric] = useState<MetricDisplayMetric>(props.metricsDisplayMetric || "percentage");
  const [metricsHabitMode, setMetricsHabitMode] = useState<MetricHabitMode>(props.metricsIncludeHabits || "include");
  const [metricsCompletion, setMetricsCompletion] = useState<MetricCompletionFilter>(props.metricsCompletionFilter || "all");
  const [metricsCustomStart, setMetricsCustomStart] = useState(props.metricsCustomStart || todayIso());
  const [metricsCustomEnd, setMetricsCustomEnd] = useState(props.metricsCustomEnd || todayIso());
  const [metricsFilterOpen, setMetricsFilterOpen] = useState(false);
  const [metricsFilterCategory, setMetricsFilterCategory] = useState<"range" | "group" | "habit" | "completion" | "metric" | "project">("range");
  const [metricsProjectFilter, setMetricsProjectFilter] = useState<string[]>([]);
  const [hoveredMetricGroupId, setHoveredMetricGroupId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [filterProjects, setFilterProjects] = useState<string[]>([]);
  const [filterWorkflows, setFilterWorkflows] = useState<UiWorkflowStatus[]>([]);
  const [filterImportances, setFilterImportances] = useState<StateFilterValue[]>([]);
  const [filterUrgencies, setFilterUrgencies] = useState<StateFilterValue[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterExpandedCategory, setFilterExpandedCategory] = useState<string | null>(null);
  const [filterDueDate, setFilterDueDate] = useState<"overdue" | "this-week" | "no-date" | null>(null);
  const [filterScheduled, setFilterScheduled] = useState<"scheduled" | "unscheduled" | null>(null);
  const [kanbanDragTaskId, setKanbanDragTaskId] = useState<string | null>(null);
  const [kanbanDropStatus, setKanbanDropStatus] = useState<UiWorkflowStatus | null>(null);
  const [listDragTaskId, setListDragTaskId] = useState<string | null>(null);
  const [listDropTargetId, setListDropTargetId] = useState<string | null>(null);
  const [listDropPosition, setListDropPosition] = useState<"before" | "after">("before");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [planningDragTask, setPlanningDragTask] = useState<{
    task: Task;
    variant: TaskBlockVariant;
    sourceRect: { width: number; height: number };
    offset: { x: number; y: number };
    pointer: { x: number; y: number };
  } | null>(null);
  const dragNodeRef = useRef<TreeDragNode | null>(null);
  const dropTargetRef = useRef<TreeDropTarget | null>(null);
  const planningDropTargetRef = useRef<{ taskId: string; position: "before" | "after"; container: PlanningDropContainer } | null>(null);
  const suppressClickUntilRef = useRef(0);

  const suppressPostDragClick = useCallback(() => {
    suppressClickUntilRef.current = Date.now() + SUPPRESS_CLICK_AFTER_DRAG_MS;
  }, []);

  const shouldSuppressTaskClick = useCallback(() => Date.now() < suppressClickUntilRef.current, []);

  const openTaskFromPlanning = useCallback((task: Task) => {
    if (shouldSuppressTaskClick()) return;
    props.onTaskEdit(task);
  }, [props, shouldSuppressTaskClick]);

  const setTreeDragNode = useCallback((node: TreeDragNode | null) => {
    dragNodeRef.current = node;
    setDragNode(node);
  }, []);

  const setTreeDropTarget = useCallback((target: TreeDropTarget | null) => {
    dropTargetRef.current = target;
    setDropTarget(target);
  }, []);

  function clearPlanningDragState() {
    document.body.classList.remove("df-planning-native-dragging");
    document.body.classList.remove("df-unified-dragging");
    setTreeDragNode(null);
    setTreeDropTarget(null);
    setKanbanDragTaskId(null);
    setKanbanDropStatus(null);
    setListDragTaskId(null);
    setListDropTargetId(null);
    setPlanningDragTask(null);
  }

  const today = todayIso();

  useEffect(() => setMetricsRangePreset(props.metricsRangePreset || "today"), [props.metricsRangePreset]);
  useEffect(() => setMetricsGroupBy(props.metricsGroupBy || "project"), [props.metricsGroupBy]);
  useEffect(() => setMetricsDisplayMetric(props.metricsDisplayMetric || "percentage"), [props.metricsDisplayMetric]);
  useEffect(() => setMetricsHabitMode(props.metricsIncludeHabits || "include"), [props.metricsIncludeHabits]);
  useEffect(() => setMetricsCompletion(props.metricsCompletionFilter || "all"), [props.metricsCompletionFilter]);
  useEffect(() => setMetricsCustomStart(props.metricsCustomStart || todayIso()), [props.metricsCustomStart]);
  useEffect(() => setMetricsCustomEnd(props.metricsCustomEnd || todayIso()), [props.metricsCustomEnd]);

  const renameTask = useCallback(async (task: Task) => {
    const title = await dialog.prompt(t(props.lang, "planning.editName"), task.title);
    if (!title?.trim()) return;
    props.onTaskUpdate(task.id, { title: title.trim() });
  }, [dialog, props]);

  const addSubtask = useCallback(async (task: Task, parentId?: string) => {
    const title = await dialog.prompt(t(props.lang, "planning.addSubtask"));
    if (!title?.trim()) return;
    const nextSubtask: Subtask = {
      id: uid("subtask"),
      title: title.trim(),
      completed: false,
      done: false,
      order: Date.now(),
      subtasks: [],
      createdAt: new Date().toISOString(),
    };
    props.onTaskUpdate(task.id, {
      subtasks: addSubtaskToTree(task.subtasks || [], nextSubtask, parentId),
    });
  }, [dialog, props]);

  const setTaskDate = useCallback(async (task: Task) => {
    const date = await dialog.prompt(props.lang === "zh" ? "Set date YYYY-MM-DD" : "Set date YYYY-MM-DD", task.dueDate || todayIso());
    if (!date?.trim()) return;
    props.onTaskUpdate(task.id, { dueDate: date.trim() });
  }, [dialog, props]);

  const moveTaskProject = useCallback(async (task: Task) => {
    const options = safeProjects.map((project, index) => `${index + 1}. ${project.title}`).join("\n");
    const choice = await dialog.prompt(
      props.lang === "zh" ? "Move to project" : "Move to project",
      "0",
      { message: `0. ${t(props.lang, "planning.unassigned")}${options ? `\n${options}` : ""}` },
    );
    if (choice === null) return;
    const index = Number(choice) - 1;
    props.onTaskUpdate(task.id, { projectId: index >= 0 ? safeProjects[index]?.id : undefined });
  }, [dialog, props, safeProjects]);

  const toggleSubtask = useCallback((taskId: string, subtaskId: string) => {
    const task = safeTasks.find((item) => item.id === taskId);
    if (!task) return;
    const toggleRecursive = (subtasks: Subtask[]): Subtask[] =>
      subtasks.map((subtask) =>
        subtask.id === subtaskId
          ? { ...subtask, completed: !(subtask.completed || subtask.done), done: !(subtask.completed || subtask.done) }
          : { ...subtask, subtasks: subtask.subtasks ? toggleRecursive(subtask.subtasks) : subtask.subtasks }
      );
    props.onTaskUpdate(taskId, { subtasks: toggleRecursive(task.subtasks || []) });
  }, [props, safeTasks]);

  const renameSubtask = useCallback(async (subtaskId: string) => {
    const title = await dialog.prompt(t(props.lang, "planning.editName"));
    if (!title?.trim()) return;
    for (const task of safeTasks) {
      if (findSubtaskInTree(task.subtasks || [], subtaskId)) {
        const recurse = (subtasks: Subtask[]): Subtask[] =>
          subtasks.map((s) =>
            s.id === subtaskId ? { ...s, title: title.trim() } : { ...s, subtasks: s.subtasks ? recurse(s.subtasks) : s.subtasks }
          );
        props.onTaskUpdate(task.id, { subtasks: recurse(task.subtasks || []) });
        return;
      }
    }
  }, [dialog, safeTasks, props]);

  const deleteSubtask = useCallback(async (subtaskId: string) => {
    const confirmed = await dialog.confirm(props.lang === "zh" ? "Delete this subtask?" : "Delete this subtask?");
    if (!confirmed) return;
    props.onDeleteSubtask(subtaskId);
  }, [dialog, props]);

  const promoteSubtask = useCallback((subtaskId: string) => {
    const parent = safeTasks.find((task) => Boolean(findSubtaskInTree(task.subtasks || [], subtaskId)));
    if (parent) props.onPromoteSubtaskToToday(parent.id, subtaskId);
  }, [props, safeTasks]);

  const setSubtaskDate = useCallback(async (subtaskId: string) => {
    for (const task of safeTasks) {
      const subtask = findSubtaskInTree(task.subtasks || [], subtaskId);
      if (subtask) {
        const date = await dialog.prompt(props.lang === "zh" ? "Set date YYYY-MM-DD" : "Set date YYYY-MM-DD", task.dueDate || todayIso());
        if (!date?.trim()) return;
        const updateRecursive = (subtasks: Subtask[]): Subtask[] => subtasks.map((item) =>
          item.id === subtaskId
            ? { ...item, title: `${item.title} ? ${date.trim()}` }
            : { ...item, subtasks: item.subtasks ? updateRecursive(item.subtasks) : item.subtasks },
        );
        props.onTaskUpdate(task.id, { subtasks: updateRecursive(task.subtasks || []) });
        return;
      }
    }
  }, [dialog, safeTasks, props]);

  const moveSubtaskProject = useCallback(async (subtaskId: string) => {
    for (const task of safeTasks) {
      if (findSubtaskInTree(task.subtasks || [], subtaskId)) {
        const options = safeProjects.map((p, i) => `${i + 1}. ${p.title}`).join("\n");
        const choice = await dialog.prompt(
          props.lang === "zh"
            ? "\u5c06\u7236\u4efb\u52a1\u79fb\u5230\u54ea\u4e2a\u9879\u76ee\uff1f"
            : "Move parent task to project",
          "0",
          { message: `0. ${t(props.lang, "planning.unassigned")}${options ? `\n${options}` : ""}` },
        );
        if (choice === null) return;
        const index = Number(choice) - 1;
        props.onTaskUpdate(task.id, { projectId: index >= 0 ? safeProjects[index]?.id : undefined });
        return;
      }
    }
  }, [dialog, safeTasks, safeProjects, props]);

  const persistTree = useCallback((projects: Project[], tasks: Task[]) => {
    props.onDataChange(normalizeTreeOrder({ ...props.data, projects, tasks }));
  }, [props]);

  const subtaskOwner = useCallback((subtaskId: string) =>
    safeTasks.find((task) => findSubtaskInTree(task.subtasks || [], subtaskId)), [safeTasks]);

  const taskFromSubtask = useCallback((subtask: Subtask, projectId?: string): Task => ({
    id: uid("task"),
    title: subtask.title,
    dueDate: today,
    category: "personal",
    priority: "medium",
    notes: "",
    goalId: "",
    completed: Boolean(subtask.completed || subtask.done),
    projectId,
    order: Date.now(),
    subtasks: subtask.subtasks || [],
    timelineRecords: [],
    createdAt: subtask.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }), [today]);

  const projectFromItem = useCallback((item: Task | Subtask): Project => ({
    id: uid("project"),
    title: item.title,
    category: "project",
    notes: "notes" in item ? item.notes : "",
    completed: Boolean(item.completed || ("done" in item && item.done)),
    order: Date.now(),
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }), []);

  const handleTreeDrop = useCallback(async (source: TreeDragNode, target: TreeDropTarget) => {
    if (source.kind === target.kind && source.id === target.id) return;
    let projects = [...safeProjects];
    let tasks = [...safeTasks];
    const targetTask = target.kind === "task" ? tasks.find((task) => task.id === target.id) : undefined;
    const targetProjectId = target.kind === "project"
      ? (target.id === "__unassigned__" ? undefined : target.id)
      : targetTask?.projectId ?? (target.kind === "subtask" ? subtaskOwner(target.id)?.projectId : undefined);

    if (source.kind === "project") {
      const project = projects.find((item) => item.id === source.id);
      if (!project) return;
      if (target.kind === "project") {
        persistTree(reorderProjects(projects, source.id, target.id, target.position === "after"), tasks);
        return;
      }
      if (tasks.some((task) => task.projectId === project.id)) {
        await dialog.alert(props.lang === "zh" ? "A non-empty project cannot change level" : "A non-empty project cannot change level", { message: props.lang === "zh" ? "Move its tasks first to avoid losing data." : "Move its tasks first to avoid losing data." });
        return;
      }
      projects = projects.filter((item) => item.id !== project.id);
      if (target.position === "inside") {
        const subtask: Subtask = { id: uid("subtask"), title: project.title, completed: project.completed, order: Date.now(), createdAt: project.createdAt, subtasks: [] };
        const owner = target.kind === "task" ? targetTask : subtaskOwner(target.id);
        if (!owner) return;
        tasks = tasks.map((task) => task.id === owner.id ? { ...task, subtasks: addSubtaskToTree(task.subtasks || [], subtask, target.kind === "subtask" ? target.id : undefined) } : task);
      } else {
        const converted = taskFromSubtask({ id: uid("subtask"), title: project.title, completed: project.completed, createdAt: project.createdAt }, targetProjectId);
        tasks = reorderTasks([...tasks, converted], converted.id, targetProjectId, targetTask?.id, target.position === "after");
      }
      persistTree(projects, tasks);
      return;
    }

    if (source.kind === "task") {
      const task = tasks.find((item) => item.id === source.id);
      if (!task) return;
      if (target.kind === "project" && target.position !== "inside") {
        if ((task.subtasks || []).length || task.timelineRecords?.length || task.scheduledDate || task.recurrence) {
          await dialog.alert(props.lang === "zh" ? "This task cannot become a project" : "This task cannot become a project", { message: props.lang === "zh" ? "Remove subtasks, schedules, or recurrence first." : "Remove subtasks, schedules, or recurrence first." });
          return;
        }
        persistTree([...projects, projectFromItem(task)], tasks.filter((item) => item.id !== task.id));
        return;
      }
      if ((target.kind === "task" || target.kind === "subtask") && target.position === "inside") {
        if (task.timelineRecords?.length || task.scheduledDate || task.recurrence) {
          await dialog.alert(props.lang === "zh" ? "A scheduled task cannot become a subtask" : "A scheduled task cannot become a subtask");
          return;
        }
        const owner = target.kind === "task" ? targetTask : subtaskOwner(target.id);
        if (!owner || owner.id === task.id) return;
        const subtask: Subtask = { id: uid("subtask"), title: task.title, completed: task.completed, order: Date.now(), createdAt: task.createdAt, subtasks: task.subtasks || [] };
        tasks = tasks.filter((item) => item.id !== task.id).map((item) => item.id === owner.id ? { ...item, subtasks: addSubtaskToTree(item.subtasks || [], subtask, target.kind === "subtask" ? target.id : undefined) } : item);
        persistTree(projects, tasks);
        return;
      }
      if (target.kind === "subtask") {
        const owner = subtaskOwner(target.id);
        if (!owner) return;
        persistTree(projects, reorderTasks(tasks, task.id, owner.projectId, owner.id, target.position === "after"));
        return;
      }
      persistTree(projects, reorderTasks(tasks, task.id, targetProjectId, targetTask?.id, target.position === "after"));
      return;
    }

    const owner = subtaskOwner(source.id);
    const subtask = owner ? findSubtaskInTree(owner.subtasks || [], source.id) : undefined;
    if (!owner || !subtask) return;
    if (target.kind === "subtask" && target.position !== "inside" && subtaskOwner(target.id)?.id === owner.id) {
      const sourceAtRoot = (owner.subtasks || []).some((item) => item.id === source.id);
      const targetAtRoot = (owner.subtasks || []).some((item) => item.id === target.id);
      if (sourceAtRoot && targetAtRoot) {
        persistTree(projects, tasks.map((task) => task.id === owner.id ? { ...task, subtasks: reorderSubtasks(task.subtasks || [], source.id, target.id, target.position === "after") } : task));
        return;
      }
    }
    tasks = tasks.map((task) => task.id === owner.id ? { ...task, subtasks: removeSubtaskFromTree(task.subtasks || [], source.id) } : task);
    if (target.kind === "project" && target.position !== "inside") {
      if (subtask.subtasks?.length) {
        await dialog.alert(props.lang === "zh" ? "A subtask with children cannot become a project" : "A subtask with children cannot become a project");
        return;
      }
      persistTree([...projects, projectFromItem(subtask)], tasks);
      return;
    }
    if (target.kind === "project" || (target.kind === "task" && target.position !== "inside")) {
      const converted = taskFromSubtask(subtask, targetProjectId);
      persistTree(projects, reorderTasks([...tasks, converted], converted.id, targetProjectId, targetTask?.id, target.position === "after"));
      return;
    }
    const nextOwner = target.kind === "task" ? targetTask : subtaskOwner(target.id);
    if (!nextOwner) return;
    tasks = tasks.map((task) => task.id === nextOwner.id ? { ...task, subtasks: addSubtaskToTree(task.subtasks || [], { ...subtask, order: Date.now() }, target.kind === "subtask" && target.position === "inside" ? target.id : undefined) } : task);
    persistTree(projects, tasks);
  }, [dialog, persistTree, projectFromItem, props.lang, safeProjects, safeTasks, subtaskOwner, taskFromSubtask]);


  const viewFilteredTasks = useMemo(() => {
    return safeTasks.filter((task) => {
      if (!showCompleted && task.completed) return false;
      if (!showAddedTasks && task.plannedForDate === today) return false;
      if (filterProjects.length > 0 && !filterProjects.includes(String(task.projectId || ""))) return false;
      const uiStatus = normalizeWorkflowStatus(task);
      if (filterWorkflows.length > 0 && !filterWorkflows.includes(uiStatus)) return false;
      if (filterImportances.length > 0) {
        const imp = task.importance || null;
        const matches = filterImportances.some((f) => f === "empty" ? !imp : imp === f);
        if (!matches) return false;
      }
      if (filterUrgencies.length > 0) {
        const urg = task.urgency || null;
        const matches = filterUrgencies.some((f) => f === "empty" ? !urg : urg === f);
        if (!matches) return false;
      }
      if (filterDueDate) {
        const due = task.dueDate;
        if (filterDueDate === "no-date") { if (due) return false; }
        else if (filterDueDate === "overdue") { if (!due || due >= today) return false; }
        else if (filterDueDate === "this-week") {
          if (!due) return false;
          const dueTime = new Date(due + "T00:00:00").getTime();
          const now = new Date(today + "T00:00:00").getTime();
          if (dueTime < now || dueTime > now + 6 * 86400000) return false;
        }
      }
      if (filterScheduled) {
        const hasSchedule = !!(task.timelineRecords && task.timelineRecords.length > 0) || !!task.plannedForDate;
        if (filterScheduled === "scheduled" && !hasSchedule) return false;
        if (filterScheduled === "unscheduled" && hasSchedule) return false;
      }
      return true;
    });
  }, [safeTasks, showCompleted, showAddedTasks, today, filterProjects, filterWorkflows, filterImportances, filterUrgencies, filterDueDate, filterScheduled]);
  const orderPlanningTasks = useCallback((items: Task[]) => {
    return [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt.localeCompare(b.createdAt));
  }, []);

  const hasTreeFilters = filterProjects.length > 0
    || filterWorkflows.length > 0
    || filterImportances.length > 0
    || filterUrgencies.length > 0
    || !!filterDueDate
    || !!filterScheduled
    || showCompleted
    || showAddedTasks;
  const visibleProjects = useMemo(
    () => safeProjects
      .map((project) => ({
        project,
        tasks: viewFilteredTasks.filter((task) => String(task.projectId || "") === String(project.id)),
      }))
      .filter((item) => !hasTreeFilters || item.tasks.length > 0),
    [safeProjects, viewFilteredTasks, hasTreeFilters],
  );
  const unassigned = useMemo(
    () => viewFilteredTasks.filter((task) => task && !task.projectId),
    [viewFilteredTasks],
  );

  const svgLines = useTreeLines(treeRef, safeProjects, viewFilteredTasks, props.collapsed, collapsedSubtasks);

  const kanbanTasks = useMemo(() => viewFilteredTasks.filter((task) => !task.completed || showCompleted), [viewFilteredTasks, showCompleted]);

  const projectColor = useCallback((projectId?: string) => {
    if (!projectId) return UNASSIGNED_COLOR;
    const project = safeProjects.find((p) => String(p.id) === String(projectId));
    return project?.color || DEFAULT_PROJECT_COLOR;
  }, [safeProjects]);

  const projectName = useCallback((projectId?: string) => {
    if (!projectId) return (props.lang === "zh" ? "Unassigned" : "Unassigned");
    const project = safeProjects.find((p) => String(p.id) === String(projectId));
    return project?.title || (props.lang === "zh" ? "Unassigned" : "Unassigned");
  }, [safeProjects, props.lang]);

  const handleKanbanDrop = useCallback((status: UiWorkflowStatus, taskId?: string) => {
    const id = taskId || kanbanDragTaskId;
    if (!id) return;
    props.onTaskUpdate(id, workflowStatusForPatch(status));
    setKanbanDragTaskId(null);
    setKanbanDropStatus(null);
  }, [kanbanDragTaskId, props]);

  const handleQuadrantDrop = useCallback((importance: "high" | "medium" | "low" | null, urgency: "high" | "medium" | "low" | null, taskId?: string) => {
    const id = taskId || kanbanDragTaskId;
    if (!id) return;
    props.onTaskUpdate(id, { importance, urgency, completed: false });
    setKanbanDragTaskId(null);
    setKanbanDropStatus(null);
  }, [kanbanDragTaskId, props]);

  const reorderPlanningTasks = useCallback((dragId: string, targetTaskId: string, position: "before" | "after", sequence: Task[]) => {
    if (!dragId || dragId === targetTaskId) {
      return;
    }
    const ordered = [...sequence].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt.localeCompare(b.createdAt));
    const dragged = ordered.find((t) => t.id === dragId);
    if (!dragged) return;
    const without = ordered.filter((t) => t.id !== dragId);
    const targetIdx = without.findIndex((t) => t.id === targetTaskId);
    if (targetIdx < 0) {
      return;
    }
    const insertAt = position === "before" ? targetIdx : targetIdx + 1;
    without.splice(insertAt, 0, dragged);
    const nextOrder = new Map(without.map((task, idx) => [task.id, idx * 10]));
    const now = new Date().toISOString();
    props.onDataChange({
      ...props.data,
      tasks: props.data.tasks.map((task) => (
        nextOrder.has(task.id)
          ? { ...task, order: nextOrder.get(task.id), updatedAt: now }
          : task
      )),
    });
  }, [props]);

  const handleListDrop = useCallback((targetTaskId: string, position: "before" | "after", taskId?: string) => {
    const dragId = taskId || listDragTaskId;
    reorderPlanningTasks(dragId || "", targetTaskId, position, viewFilteredTasks);
    setListDragTaskId(null);
    setListDropTargetId(null);
  }, [listDragTaskId, reorderPlanningTasks, viewFilteredTasks]);

  const planningContainerTasks = useCallback((container: PlanningDropContainer) => {
    if (container === "list") return orderPlanningTasks(viewFilteredTasks);
    if (container.startsWith("kanban:")) {
      const status = container.slice("kanban:".length) as UiWorkflowStatus;
      return orderPlanningTasks(kanbanTasks.filter((task) => status === "done" ? normalizeWorkflowStatus(task) === "done" : normalizeWorkflowStatus(task) !== "done"));
    }
    if (container.startsWith("matrix:")) {
      const key = container.slice("matrix:".length);
      return orderPlanningTasks(viewFilteredTasks.filter((task) => {
        const imp = task.importance || "medium";
        const urg = task.urgency || "medium";
        if (key === "q1") return imp === "high" && urg === "high";
        if (key === "q2") return imp === "high" && urg !== "high";
        if (key === "q3") return imp !== "high" && urg === "high";
        return imp !== "high" && urg !== "high";
      }));
    }
    return orderPlanningTasks(viewFilteredTasks);
  }, [kanbanTasks, orderPlanningTasks, viewFilteredTasks]);

  /**
   * Shared pointer-event drag for Kanban / Matrix / List views.
   * Renders a real TaskBlock in TaskDragLayer (not a blue-gray custom card).
   * The source element gets is-dragging-source (clean placeholder).
   * Drop feedback: insertion line for list reorder, container outline for
   * kanban column / matrix quadrant.
   */
  const beginPlanningDrag = useCallback((event: React.PointerEvent, task: Task, variant: TaskBlockVariant) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("button,input,textarea,select,a,[contenteditable='true']")) return;
    const dragElement = event.currentTarget as HTMLElement;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    let active = false;

    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", keydown);
      document.body.classList.remove("df-unified-dragging");
      dragElement.classList.remove("is-dragging-source");
      setPlanningDragTask(null);
      setKanbanDropStatus(null);
      setListDropTargetId(null);
      planningDropTargetRef.current = null;
      if (dragElement.hasPointerCapture(pointerId)) {
        try { dragElement.releasePointerCapture(pointerId); } catch { /* ignore */ }
      }
    };

    const detectDropTarget = (clientX: number, clientY: number) => {
      const pointedElement = document.elementFromPoint(clientX, clientY);
      const planningTask = pointedElement?.closest<HTMLElement>("[data-planning-task-id]");
      if (planningTask) {
        const targetTaskId = planningTask.dataset.planningTaskId;
        if (targetTaskId && targetTaskId !== task.id) {
          const rect = planningTask.getBoundingClientRect();
          const isBefore = (clientY - rect.top) < rect.height / 2;
          setListDropTargetId(targetTaskId);
          setListDropPosition(isBefore ? "before" : "after");
          planningDropTargetRef.current = {
            taskId: targetTaskId,
            position: isBefore ? "before" : "after",
            container: (planningTask.dataset.planningContainer || "") as PlanningDropContainer,
          };
        } else {
          setListDropTargetId(null);
          planningDropTargetRef.current = null;
        }
        setKanbanDropStatus(null);
        return;
      }
      const kanbanColumn = pointedElement?.closest<HTMLElement>("[data-kanban-status]");
      if (kanbanColumn) {
        setKanbanDropStatus(kanbanColumn.dataset.kanbanStatus as UiWorkflowStatus);
        setListDropTargetId(null);
        planningDropTargetRef.current = null;
        return;
      }
      const quadrant = pointedElement?.closest<HTMLElement>("[data-quadrant]");
      if (quadrant) {
        setKanbanDropStatus(("q-" + quadrant.dataset.quadrant) as unknown as UiWorkflowStatus);
        setListDropTargetId(null);
        planningDropTargetRef.current = null;
        return;
      }
      const listRow = pointedElement?.closest<HTMLElement>("[data-list-task-id]");
      if (listRow) {
        const targetTaskId = listRow.dataset.listTaskId;
        if (targetTaskId && targetTaskId !== task.id) {
          const rect = listRow.getBoundingClientRect();
          const isBefore = (clientY - rect.top) < rect.height / 2;
          setListDropTargetId(targetTaskId);
          setListDropPosition(isBefore ? "before" : "after");
          planningDropTargetRef.current = {
            taskId: targetTaskId,
            position: isBefore ? "before" : "after",
            container: "list",
          };
        } else {
          setListDropTargetId(null);
          planningDropTargetRef.current = null;
        }
        setKanbanDropStatus(null);
        return;
      }
      setKanbanDropStatus(null);
      setListDropTargetId(null);
      planningDropTargetRef.current = null;
    };

    const move = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== pointerId) return;
      if (!active && Math.hypot(pointerEvent.clientX - startX, pointerEvent.clientY - startY) < DRAG_START_THRESHOLD_PX) return;
      if (!active) {
        active = true;
        pointerEvent.preventDefault();
        try { dragElement.setPointerCapture(pointerId); } catch { /* ignore */ }
        document.body.classList.add("df-unified-dragging");
        dragElement.classList.add("is-dragging-source");
        setListDragTaskId(task.id);
        setKanbanDragTaskId(task.id);
        const rect = dragElement.getBoundingClientRect();
        const offX = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
        const offY = Math.min(Math.max(event.clientY - rect.top, 0), rect.height);
        setPlanningDragTask({ task, variant, sourceRect: { width: rect.width, height: rect.height }, offset: { x: offX, y: offY }, pointer: { x: pointerEvent.clientX, y: pointerEvent.clientY } });
      }
      pointerEvent.preventDefault();
      setPlanningDragTask((current) => current ? { ...current, pointer: { x: pointerEvent.clientX, y: pointerEvent.clientY } } : current);
      detectDropTarget(pointerEvent.clientX, pointerEvent.clientY);
    };

    const up = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== pointerId) return;
      if (active) {
        suppressPostDragClick();
        const pointedElement = document.elementFromPoint(pointerEvent.clientX, pointerEvent.clientY);
        const planningTask = pointedElement?.closest<HTMLElement>("[data-planning-task-id]");
        const kanbanColumn = pointedElement?.closest<HTMLElement>("[data-kanban-status]");
        const quadrant = pointedElement?.closest<HTMLElement>("[data-quadrant]");
        const listRow = pointedElement?.closest<HTMLElement>("[data-list-task-id]");
        const fallback = planningDropTargetRef.current;
        const sourceContainer = (dragElement.dataset.planningContainer || "") as PlanningDropContainer;
        if (fallback && fallback.taskId !== task.id && sourceContainer && sourceContainer === fallback.container) {
          reorderPlanningTasks(task.id, fallback.taskId, fallback.position, planningContainerTasks(sourceContainer));
          cleanup();
          return;
        }
        if (planningTask) {
          const targetTaskId = planningTask.dataset.planningTaskId;
          const targetContainer = (planningTask.dataset.planningContainer || "") as PlanningDropContainer;
          if (targetTaskId && targetTaskId !== task.id && sourceContainer && sourceContainer === targetContainer) {
            const rect = planningTask.getBoundingClientRect();
            const isBefore = (pointerEvent.clientY - rect.top) < rect.height / 2;
            reorderPlanningTasks(task.id, targetTaskId, isBefore ? "before" : "after", planningContainerTasks(sourceContainer));
          } else if (kanbanColumn) {
            handleKanbanDrop(kanbanColumn.dataset.kanbanStatus as UiWorkflowStatus, task.id);
          } else if (quadrant) {
            const q = quadrant.dataset.quadrant || "";
            const importance = (q === "q1" || q === "q2") ? "high" : "low";
            const urgency = (q === "q1" || q === "q3") ? "high" : "low";
            handleQuadrantDrop(importance as "high" | "low", urgency as "high" | "low", task.id);
          }
        } else if (kanbanColumn) {
          handleKanbanDrop(kanbanColumn.dataset.kanbanStatus as UiWorkflowStatus, task.id);
        } else if (quadrant) {
          const q = quadrant.dataset.quadrant || "";
          const importance = (q === "q1" || q === "q2") ? "high" : "low";
          const urgency = (q === "q1" || q === "q3") ? "high" : "low";
          handleQuadrantDrop(importance as "high" | "low", urgency as "high" | "low", task.id);
        } else if (listRow) {
          const targetTaskId = listRow.dataset.listTaskId;
          if (targetTaskId && targetTaskId !== task.id) {
            const rect = listRow.getBoundingClientRect();
            const isBefore = (pointerEvent.clientY - rect.top) < rect.height / 2;
            handleListDrop(targetTaskId, isBefore ? "before" : "after", task.id);
          }
        }
      }
      cleanup();
    };

    const cancel = () => cleanup();
    const keydown = (kb: KeyboardEvent) => { if (kb.key === "Escape") cancel(); };

    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", keydown);
  }, [handleKanbanDrop, handleQuadrantDrop, handleListDrop, planningContainerTasks, reorderPlanningTasks, suppressPostDragClick]);

  /**
   * Shared pointer-event drag for Tree view.
   * Uses the same React-rendered TaskDragLayer overlay as other Planning
   * surfaces, then keeps the tree-specific drop target detection.
   */
  const beginTreeDrag = useCallback((event: React.PointerEvent, node: TreeDragNode) => {
    if (event.button !== 0) return;
    if (props.compact) return;
    const target = event.target as HTMLElement;
    if (target.closest("button,input,textarea,select,a,[contenteditable='true']")) return;
    const sourceNodeEl = target.closest<HTMLElement>("[data-node-type][data-node-id]");
    if (!sourceNodeEl) return;
    const sourceNode: TreeDragNode = {
      kind: sourceNodeEl.dataset.nodeType as TreeNodeKind,
      id: sourceNodeEl.dataset.nodeId || node.id,
    };
    const dragElement = event.currentTarget as HTMLElement;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    let active = false;

    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", keydown);
      document.body.classList.remove("df-unified-dragging");
      dragElement.classList.remove("is-dragging-source");
      setTreeDragNode(null);
      setTreeDropTarget(null);
      setPlanningDragTask(null);
      if (dragElement.hasPointerCapture(pointerId)) {
        try { dragElement.releasePointerCapture(pointerId); } catch { /* ignore */ }
      }
    };

    const detectTreeDropTarget = (clientX: number, clientY: number) => {
      const tree = treeRef.current;
      if (!tree) return;
      const pointedElement = document.elementFromPoint(clientX, clientY);
      const node = pointedElement?.closest<HTMLElement>("[data-node-type][data-node-id]");
      if (!node) { setTreeDropTarget(null); return; }
      const rect = node.getBoundingClientRect();
      const ratio = (clientY - rect.top) / Math.max(rect.height, 1);
      const position = ratio < 0.28 ? "before" : ratio > 0.72 ? "after" : "inside";
      const treeRect = tree.getBoundingClientRect();
      setTreeDropTarget({
        kind: node.dataset.nodeType as TreeNodeKind,
        id: node.dataset.nodeId || "",
        position,
        top: rect.top - treeRect.top + tree.scrollTop + (position === "before" ? -16 : position === "after" ? rect.height - 2 : rect.height / 2 - 16),
        left: rect.left - treeRect.left + tree.scrollLeft + (position === "inside" ? 22 : 0),
        width: Math.max(160, rect.width - (position === "inside" ? 22 : 0)),
      });
    };

    const move = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== pointerId) return;
      if (!active && Math.hypot(pointerEvent.clientX - startX, pointerEvent.clientY - startY) < DRAG_START_THRESHOLD_PX) return;
      if (!active) {
        active = true;
        pointerEvent.preventDefault();
        try { dragElement.setPointerCapture(pointerId); } catch { /* ignore */ }
        document.body.classList.add("df-unified-dragging");
        dragElement.classList.add("is-dragging-source");
        setTreeDragNode(sourceNode);
        const sourceCard = sourceNodeEl.querySelector<HTMLElement>("[data-planning-drag-card]") || sourceNodeEl;
        const rect = sourceCard.getBoundingClientRect();
        const offX = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
        const offY = Math.min(Math.max(event.clientY - rect.top, 0), rect.height);
        let overlayTask: Task | undefined;
        if (sourceNode.kind === "task") {
          overlayTask = safeTasks.find((task) => task.id === sourceNode.id);
        } else if (sourceNode.kind === "subtask") {
          const owner = subtaskOwner(sourceNode.id);
          const subtask = owner ? findSubtaskInTree(owner.subtasks || [], sourceNode.id) : undefined;
          overlayTask = subtask ? taskFromSubtask(subtask, owner?.projectId) : undefined;
        } else {
          const project = safeProjects.find((item) => item.id === sourceNode.id) || (sourceNode.id === "__unassigned__" ? createProjectShell(props.lang === "zh" ? "Unassigned Tasks" : "Unassigned Tasks") : undefined);
          overlayTask = project ? {
            id: project.id,
            title: project.title,
            category: "personal",
            priority: null,
            notes: project.notes || "",
            goalId: "",
            completed: Boolean(project.completed),
            dueDate: "",
            projectId: project.id === "__unassigned__" ? undefined : project.id,
            estimatedHours: 0,
            createdAt: project.createdAt || "",
            updatedAt: project.updatedAt || "",
          } : undefined;
        }
        if (overlayTask) {
          setPlanningDragTask({
            task: overlayTask,
            variant: "planning",
            sourceRect: { width: rect.width, height: rect.height },
            offset: { x: offX, y: offY },
            pointer: { x: pointerEvent.clientX, y: pointerEvent.clientY },
          });
        }
      }
      pointerEvent.preventDefault();
      setPlanningDragTask((current) => current ? { ...current, pointer: { x: pointerEvent.clientX, y: pointerEvent.clientY } } : current);
      detectTreeDropTarget(pointerEvent.clientX, pointerEvent.clientY);
    };

    const up = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== pointerId) return;
      if (active) {
        suppressPostDragClick();
        const source = dragNodeRef.current;
        const target = dropTargetRef.current;
        if (source && target) void handleTreeDrop(source, target);
      }
      cleanup();
    };

    const cancel = () => cleanup();
    const keydown = (kb: KeyboardEvent) => { if (kb.key === "Escape") cancel(); };

    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", keydown);
  }, [props.compact, props.lang, handleTreeDrop, safeProjects, safeTasks, setTreeDragNode, setTreeDropTarget, subtaskOwner, suppressPostDragClick, taskFromSubtask]);

  const hasActiveFilters = filterProjects.length > 0 || filterWorkflows.length > 0 || filterImportances.length > 0 || filterUrgencies.length > 0 || !!filterDueDate || !!filterScheduled || showCompleted || showAddedTasks;

  const toggleArray = <T,>(setter: React.Dispatch<React.SetStateAction<T[]>>, value: T) => {
    setter((prev) => prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]);
  };

  const filterChips: Array<{
    key: string;
    label: string;
    selected: string[];
    options: Array<{ value: string; label: string; checked: boolean; onToggle: () => void }>;
  }> = [
    {
      key: "project",
      label: props.lang === "zh" ? "Project" : "Project",
      selected: filterProjects.map((id) => safeProjects.find((p) => String(p.id) === id)?.title || id).filter(Boolean),
      options: safeProjects.map((p) => ({
        value: String(p.id),
        label: p.title,
        checked: filterProjects.includes(String(p.id)),
        onToggle: () => toggleArray(setFilterProjects, String(p.id)),
      })),
    },
    {
      key: "display",
      label: props.lang === "zh" ? "Display" : "Display",
      selected: [
        ...(showCompleted ? [props.lang === "zh" ? "Done" : "Done"] : []),
        ...(showAddedTasks ? [props.lang === "zh" ? "Added" : "Added"] : []),
      ],
      options: [
        { value: "completed", label: props.lang === "zh" ? "Show done" : "Show done", checked: showCompleted, onToggle: () => setShowCompleted((v) => !v) },
        { value: "added", label: props.lang === "zh" ? "Show added" : "Show added", checked: showAddedTasks, onToggle: () => setShowAddedTasks((v) => !v) },
      ],
    },
    {
      key: "status",
      label: props.lang === "zh" ? "Status" : "Status",
      selected: filterWorkflows.map((s) => s === "backlog" ? (props.lang === "zh" ? "To do" : "To do") : s === "doing" ? (props.lang === "zh" ? "Doing" : "Doing") : (props.lang === "zh" ? "Done" : "Done")),
      options: (["backlog", "done"] as UiWorkflowStatus[]).map((s) => ({
        value: s,
        label: s === "backlog" ? (props.lang === "zh" ? "To do" : "To do") : s === "doing" ? (props.lang === "zh" ? "Doing" : "Doing") : (props.lang === "zh" ? "Done" : "Done"),
        checked: filterWorkflows.includes(s),
        onToggle: () => toggleArray(setFilterWorkflows, s),
      })),
    },
    {
      key: "importance",
      label: props.lang === "zh" ? "Importance" : "Importance",
      selected: filterImportances.map((i) => i === "high" ? (props.lang === "zh" ? "High" : "High") : i === "medium" ? (props.lang === "zh" ? "Medium" : "Medium") : i === "low" ? (props.lang === "zh" ? "Low" : "Low") : (props.lang === "zh" ? "Unset" : "Unset")),
      options: (["high", "medium", "low", "empty"] as StateFilterValue[]).map((i) => ({
        value: i,
        label: i === "high" ? (props.lang === "zh" ? "High" : "High") : i === "medium" ? (props.lang === "zh" ? "Medium" : "Medium") : i === "low" ? (props.lang === "zh" ? "Low" : "Low") : (props.lang === "zh" ? "Unset" : "Unset"),
        checked: filterImportances.includes(i),
        onToggle: () => toggleArray(setFilterImportances, i),
      })),
    },
    {
      key: "urgency",
      label: props.lang === "zh" ? "Urgency" : "Urgency",
      selected: filterUrgencies.map((u) => u === "high" ? (props.lang === "zh" ? "High" : "High") : u === "medium" ? (props.lang === "zh" ? "Medium" : "Medium") : u === "low" ? (props.lang === "zh" ? "Low" : "Low") : (props.lang === "zh" ? "Unset" : "Unset")),
      options: (["high", "medium", "low", "empty"] as StateFilterValue[]).map((u) => ({
        value: u,
        label: u === "high" ? (props.lang === "zh" ? "High" : "High") : u === "medium" ? (props.lang === "zh" ? "Medium" : "Medium") : u === "low" ? (props.lang === "zh" ? "Low" : "Low") : (props.lang === "zh" ? "Unset" : "Unset"),
        checked: filterUrgencies.includes(u),
        onToggle: () => toggleArray(setFilterUrgencies, u),
      })),
    },
  ];

  // Linear-style active filter chips: each active filter becomes a removable chip.
  type ActiveChip = { key: string; label: string; onClear: () => void };
  const stateLabel = (v: StateFilterValue) =>
    v === "high" ? (props.lang === "zh" ? "High" : "High")
    : v === "medium" ? (props.lang === "zh" ? "Medium" : "Medium")
    : v === "low" ? (props.lang === "zh" ? "Low" : "Low")
    : (props.lang === "zh" ? "Unset" : "Unset");
  const workflowLabel = (s: UiWorkflowStatus) =>
    s === "backlog" ? (props.lang === "zh" ? "To do" : "To do")
    : s === "doing" ? (props.lang === "zh" ? "Doing" : "Doing")
    : (props.lang === "zh" ? "Done" : "Done");

  const activeFilterChips: ActiveChip[] = [
    ...filterProjects.map((id) => ({
      key: `project-${id}`,
      label: `${props.lang === "zh" ? "Project" : "Project"}: ${safeProjects.find((p) => String(p.id) === id)?.title || id}`,
      onClear: () => toggleArray(setFilterProjects, id),
    })),
    ...filterWorkflows.map((s) => ({
      key: `status-${s}`,
      label: `${props.lang === "zh" ? "Status" : "Status"}: ${workflowLabel(s)}`,
      onClear: () => toggleArray(setFilterWorkflows, s),
    })),
    ...filterImportances.map((v) => ({
      key: `importance-${v}`,
      label: `${props.lang === "zh" ? "Priority" : "Priority"}: ${stateLabel(v)}`,
      onClear: () => toggleArray(setFilterImportances, v),
    })),
    ...filterUrgencies.map((v) => ({
      key: `urgency-${v}`,
      label: `${props.lang === "zh" ? "Urgency" : "Urgency"}: ${stateLabel(v)}`,
      onClear: () => toggleArray(setFilterUrgencies, v),
    })),
    ...(filterDueDate ? [{
      key: `due-${filterDueDate}`,
      label: `${props.lang === "zh" ? "Due" : "Due"}: ${filterDueDate === "overdue" ? (props.lang === "zh" ? "Overdue" : "Overdue") : filterDueDate === "this-week" ? (props.lang === "zh" ? "This week" : "This week") : (props.lang === "zh" ? "No date" : "No date")}`,
      onClear: () => setFilterDueDate(null),
    }] : []),
    ...(filterScheduled ? [{
      key: `scheduled-${filterScheduled}`,
      label: `${props.lang === "zh" ? "Scheduled" : "Scheduled"}: ${filterScheduled === "scheduled" ? (props.lang === "zh" ? "Scheduled" : "Scheduled") : (props.lang === "zh" ? "Unscheduled" : "Unscheduled")}`,
      onClear: () => setFilterScheduled(null),
    }] : []),
  ];

  const clearAllFilters = () => {
    setFilterProjects([]);
    setFilterWorkflows([]);
    setFilterImportances([]);
    setFilterUrgencies([]);
    setFilterDueDate(null);
    setFilterScheduled(null);
  };

  // Linear-style nested filter categories. Level 1 = category list, Level 2 = options.
  const dueDateLabel = (d: "overdue" | "this-week" | "no-date") =>
    d === "overdue" ? (props.lang === "zh" ? "Overdue" : "Overdue")
    : d === "this-week" ? (props.lang === "zh" ? "This week" : "This week")
    : (props.lang === "zh" ? "No date" : "No date");

  type FilterCategory = {
    key: string;
    label: string;
    icon: string;
    activeCount: number;
    summary: string;
  };
  type FilterOption = {
    value: string;
    label: string;
    checked: boolean;
    inputType?: "checkbox" | "radio";
    dotColor?: string;
    onToggle: () => void;
  };
  const filterHasSchedule = (task: Task) => Boolean((task.timelineRecords && task.timelineRecords.length > 0) || task.plannedForDate);
  const filterDueMatches = (task: Task, value: "overdue" | "this-week" | "no-date") => {
    const due = task.dueDate;
    if (value === "no-date") return !due;
    if (!due) return false;
    if (value === "overdue") return due < today;
    const dueTime = new Date(due + "T00:00:00").getTime();
    const now = new Date(today + "T00:00:00").getTime();
    return dueTime >= now && dueTime <= now + 6 * 86400000;
  };
  const filterOptionsByCategory: Record<string, FilterOption[]> = {
    status: (["backlog", "done"] as UiWorkflowStatus[])
      .filter((s) => filterWorkflows.includes(s) || safeTasks.some((task) => normalizeWorkflowStatus(task) === s))
      .map((s) => ({
        value: s,
        label: workflowLabel(s),
        checked: filterWorkflows.includes(s),
        onToggle: () => toggleArray(setFilterWorkflows, s),
      })),
    importance: (["high", "medium", "low", "empty"] as StateFilterValue[])
      .filter((v) => filterImportances.includes(v) || safeTasks.some((task) => v === "empty" ? !task.importance : task.importance === v))
      .map((v) => ({
        value: v,
        label: stateLabel(v),
        checked: filterImportances.includes(v),
        onToggle: () => toggleArray(setFilterImportances, v),
      })),
    urgency: (["high", "medium", "low", "empty"] as StateFilterValue[])
      .filter((v) => filterUrgencies.includes(v) || safeTasks.some((task) => v === "empty" ? !task.urgency : task.urgency === v))
      .map((v) => ({
        value: v,
        label: stateLabel(v),
        checked: filterUrgencies.includes(v),
        onToggle: () => toggleArray(setFilterUrgencies, v),
      })),
    project: safeProjects
      .filter((project) => filterProjects.includes(String(project.id)) || safeTasks.some((task) => String(task.projectId || "") === String(project.id)))
      .map((project) => ({
        value: String(project.id),
        label: project.title,
        checked: filterProjects.includes(String(project.id)),
        dotColor: project.color || DEFAULT_PROJECT_COLOR,
        onToggle: () => toggleArray(setFilterProjects, String(project.id)),
      })),
    due: (["overdue", "this-week", "no-date"] as const)
      .filter((d) => filterDueDate === d || safeTasks.some((task) => filterDueMatches(task, d)))
      .map((d) => ({
        value: d,
        label: dueDateLabel(d),
        checked: filterDueDate === d,
        inputType: "radio" as const,
        onToggle: () => setFilterDueDate(filterDueDate === d ? null : d),
      })),
    scheduled: (["scheduled", "unscheduled"] as const)
      .filter((s) => filterScheduled === s || safeTasks.some((task) => s === "scheduled" ? filterHasSchedule(task) : !filterHasSchedule(task)))
      .map((s) => ({
        value: s,
        label: s === "scheduled" ? (props.lang === "zh" ? "Scheduled" : "Scheduled") : (props.lang === "zh" ? "Unscheduled" : "Unscheduled"),
        checked: filterScheduled === s,
        inputType: "radio" as const,
        onToggle: () => setFilterScheduled(filterScheduled === s ? null : s),
      })),
    completed: [
      ...(showCompleted || safeTasks.some((task) => task.completed) ? [{
        value: "completed",
        label: props.lang === "zh" ? "Show done" : "Show done",
        checked: showCompleted,
        onToggle: () => setShowCompleted((v) => !v),
      }] : []),
      ...(showAddedTasks || safeTasks.some((task) => task.plannedForDate === today) ? [{
        value: "added",
        label: props.lang === "zh" ? "Show added" : "Show added",
        checked: showAddedTasks,
        onToggle: () => setShowAddedTasks((v) => !v),
      }] : []),
    ],
  };
  const filterCategories: FilterCategory[] = [
    { key: "status", label: props.lang === "zh" ? "Status" : "Status", icon: "circle", activeCount: filterWorkflows.length, summary: filterWorkflows.length > 0 ? filterWorkflows.map(workflowLabel).join(", ") : "" },
    { key: "importance", label: props.lang === "zh" ? "Priority" : "Priority", icon: "flag", activeCount: filterImportances.length, summary: filterImportances.length > 0 ? filterImportances.map(stateLabel).join(", ") : "" },
    { key: "urgency", label: props.lang === "zh" ? "Urgency" : "Urgency", icon: "clock", activeCount: filterUrgencies.length, summary: filterUrgencies.length > 0 ? filterUrgencies.map(stateLabel).join(", ") : "" },
    { key: "project", label: props.lang === "zh" ? "Project" : "Project", icon: "folder", activeCount: filterProjects.length, summary: filterProjects.length > 0 ? filterProjects.map((id) => safeProjects.find((p) => String(p.id) === id)?.title || id).join(", ") : "" },
    { key: "due", label: props.lang === "zh" ? "Due date" : "Due date", icon: "calendar", activeCount: filterDueDate ? 1 : 0, summary: filterDueDate ? dueDateLabel(filterDueDate) : "" },
    { key: "scheduled", label: props.lang === "zh" ? "Scheduled" : "Scheduled", icon: "layers", activeCount: filterScheduled ? 1 : 0, summary: filterScheduled ? (filterScheduled === "scheduled" ? (props.lang === "zh" ? "Scheduled" : "Scheduled") : (props.lang === "zh" ? "Unscheduled" : "Unscheduled")) : "" },
    { key: "completed", label: props.lang === "zh" ? "Completed" : "Completed", icon: "check", activeCount: (showCompleted ? 1 : 0) + (showAddedTasks ? 1 : 0), summary: [showCompleted ? (props.lang === "zh" ? "Show done" : "Show done") : "", showAddedTasks ? (props.lang === "zh" ? "Show added" : "Show added") : ""].filter(Boolean).join(", ") },
  ];
  const effectiveFilterCategories = filterCategories.filter((cat) => (filterOptionsByCategory[cat.key] || []).length > 0);
  const activeFilterCategory = filterExpandedCategory && effectiveFilterCategories.some((cat) => cat.key === filterExpandedCategory)
    ? filterExpandedCategory
    : null;
  const activeFilterCategoryIndex = activeFilterCategory
    ? Math.max(0, effectiveFilterCategories.findIndex((cat) => cat.key === activeFilterCategory))
    : 0;

  const updateMetricsSetting = useCallback((patch: Partial<Settings>) => {
    props.onMetricsSettingsChange?.(patch);
  }, [props]);

  const setMetricRange = useCallback((value: MetricRangePreset) => {
    setMetricsRangePreset(value);
    updateMetricsSetting({ metricsRangePreset: value });
  }, [updateMetricsSetting]);

  const setMetricGroup = useCallback((value: MetricGroupBy) => {
    setMetricsGroupBy(value);
    setHoveredMetricGroupId(null);
    updateMetricsSetting({ metricsGroupBy: value });
  }, [updateMetricsSetting]);

  const setMetricDisplay = useCallback((value: MetricDisplayMetric) => {
    setMetricsDisplayMetric(value);
    updateMetricsSetting({ metricsDisplayMetric: value });
  }, [updateMetricsSetting]);

  const setMetricHabit = useCallback((value: MetricHabitMode) => {
    setMetricsHabitMode(value);
    updateMetricsSetting({ metricsIncludeHabits: value });
  }, [updateMetricsSetting]);

  const setMetricCompletion = useCallback((value: MetricCompletionFilter) => {
    setMetricsCompletion(value);
    updateMetricsSetting({ metricsCompletionFilter: value });
  }, [updateMetricsSetting]);

  const dayStartMinutes = parseDayStartMinutes(props.dayStartTime || "00:00");
  const metricsResult = useMemo(() => buildTimeAllocationMetrics({
    data: props.data,
    range: {
      preset: metricsRangePreset,
      anchorDate: today,
      customStart: metricsCustomStart,
      customEnd: metricsCustomEnd,
    },
    dayStartMinutes,
    groupBy: metricsGroupBy,
    habitMode: metricsHabitMode,
    completion: metricsCompletion,
    projectIds: metricsProjectFilter,
  }), [props.data, metricsRangePreset, today, metricsCustomStart, metricsCustomEnd, dayStartMinutes, metricsGroupBy, metricsHabitMode, metricsCompletion, metricsProjectFilter]);
  const hoveredMetricGroup = metricsResult.groups.find((group) => group.id === hoveredMetricGroupId) || null;
  const activeDonutGroup = hoveredMetricGroup;
  const donutSegments = metricsResult.groups.reduce<Array<{ group: TimeAllocationGroup; startAngle: number; endAngle: number }>>((segments, group) => {
    const startAngle = segments.length > 0 ? segments[segments.length - 1].endAngle : 0;
    const endAngle = startAngle + (group.percentage / 100) * 360;
    segments.push({ group, startAngle, endAngle });
    return segments;
  }, []);
  const rangeOptions: Array<{ value: MetricRangePreset; label: string }> = [
    { value: "all", label: props.lang === "zh" ? "\u5168\u90e8" : "All" },
    { value: "today", label: props.lang === "zh" ? "今天" : "Today" },
    { value: "yesterday", label: props.lang === "zh" ? "昨天" : "Yesterday" },
    { value: "thisWeek", label: props.lang === "zh" ? "本周" : "This week" },
    { value: "lastWeek", label: props.lang === "zh" ? "上周" : "Last week" },
    { value: "thisMonth", label: props.lang === "zh" ? "本月" : "This month" },
    { value: "custom", label: props.lang === "zh" ? "自定义" : "Custom" },
  ];
  const groupOptions: Array<{ value: MetricGroupBy; label: string; disabled?: boolean }> = [
    { value: "project", label: props.lang === "zh" ? "项目" : "Project" },
    { value: "importance", label: props.lang === "zh" ? "重要程度" : "Importance" },
    { value: "urgency", label: props.lang === "zh" ? "紧急程度" : "Urgency" },
    { value: "completion", label: props.lang === "zh" ? "完成状态" : "Completion" },
    { value: "taskType", label: props.lang === "zh" ? "任务类型" : "Task type" },
    { value: "customCategory", label: props.lang === "zh" ? "自定义分类（未来）" : "Custom category (later)", disabled: true },
    { value: "tag", label: props.lang === "zh" ? "标签（未来）" : "Tag (later)", disabled: true },
  ];
  const metricActiveChips = [
    metricsGroupBy !== "project" ? { key: "group", label: `${props.lang === "zh" ? "分组" : "Group"}: ${groupOptions.find((item) => item.value === metricsGroupBy)?.label}`, onClear: () => setMetricGroup("project") } : null,
    metricsHabitMode !== "include" ? { key: "habit", label: `${props.lang === "zh" ? "习惯" : "Habits"}: ${metricsHabitMode === "exclude" ? (props.lang === "zh" ? "排除" : "Exclude") : (props.lang === "zh" ? "仅习惯" : "Only habits")}`, onClear: () => setMetricHabit("include") } : null,
    metricsCompletion !== "all" ? { key: "completion", label: `${props.lang === "zh" ? "完成" : "Completion"}: ${metricsCompletion === "completed" ? (props.lang === "zh" ? "已完成" : "Completed") : (props.lang === "zh" ? "未完成" : "Incomplete")}`, onClear: () => setMetricCompletion("all") } : null,
    metricsProjectFilter.length > 0 ? { key: "project", label: `${props.lang === "zh" ? "项目" : "Project"}: ${metricsProjectFilter.length}`, onClear: () => setMetricsProjectFilter([]) } : null,
  ].filter(Boolean) as Array<{ key: string; label: string; onClear: () => void }>;

  return (
    <main className={`df-planning${props.compact ? " compact-layout" : ""}${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
      {dialog.host}
      <div className="df-planning-body">
        <section className="df-mindmap no-root">
          <aside className="df-planning-sidebar" aria-label={props.lang === "zh" ? "\u89c4\u5212\u5de5\u5177" : "Planning tools"}>
            <button
              type="button"
              className="df-planning-sidebar-collapse"
              aria-label={sidebarCollapsed ? "Expand planning tools" : "Collapse planning tools"}
              aria-pressed={sidebarCollapsed}
              onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
            >
              <ChevronIcon open={!sidebarCollapsed} />
            </button>
              {availableModes.length > 1 && (
                <div className="df-planning-view-switch">
                  {availableModes.map((m) => (
                    <button key={m} className={`df-view-btn${viewMode === m ? " active" : ""}`} onClick={() => setViewMode(m)} title={metricViewLabel(props.lang, m)}>
                      {m === "tree" && <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3v10M3 5h4M3 9h6M3 13h5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>}
                      {m === "kanban" && <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="3.5" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1.3" /><rect x="6.5" y="3" width="3.5" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.3" /><rect x="11" y="3" width="3.5" height="5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg>}
                      {m === "eisenhower" && <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="5.5" height="5.5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.3" /><rect x="8.5" y="2" width="5.5" height="5.5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.3" /><rect x="2" y="8.5" width="5.5" height="5.5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.3" /><rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg>}
                      {m === "list" && <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4h10M3 8h10M3 12h7" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>}
                      {m === "metrics" && <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 12V8M7 12V4M11 12V6M2 13h12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>}
                      <span>{metricViewLabel(props.lang, m)}</span>
                    </button>
                  ))}
                </div>
              )}
          </aside>
          <div className="df-tree-wrap">
            <div className="df-planning-filter-corner">
              {viewMode !== "metrics" && (
              <div className="df-filter-popover-anchor">
                <button
                  type="button"
                  className={`df-filter-trigger${filterOpen ? " active" : ""}${hasActiveFilters ? " has-active" : ""}`}
                  aria-expanded={filterOpen}
                  aria-label={props.lang === "zh" ? "Filter" : "Filter"}
                  title={props.lang === "zh" ? "Filter" : "Filter"}
                  onClick={() => { setFilterOpen((open) => !open); setFilterExpandedCategory(null); }}
                >
                  <svg viewBox="0 0 18 18" aria-hidden="true">
                    <path d="M3 4h12M5 9h8M7 14h4" />
                  </svg>
                  {hasActiveFilters && <b>{activeFilterChips.length}</b>}
                </button>
                {filterOpen && (
                  <>
                    <div className="df-filter-panel" onClick={(e) => e.stopPropagation()}>
                      <div className="df-filter-categories">
                        {effectiveFilterCategories.map((cat) => (
                          <button
                            key={cat.key}
                            type="button"
                            className={`df-filter-cat-row${activeFilterCategory === cat.key ? " active" : ""}${cat.activeCount > 0 ? " has-active" : ""}`}
                            onMouseEnter={() => setFilterExpandedCategory(cat.key)}
                            onFocus={() => setFilterExpandedCategory(cat.key)}
                          >
                            <span className="df-filter-cat-icon" aria-hidden="true">
                              {cat.icon === "circle" && <svg viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>}
                              {cat.icon === "flag" && <svg viewBox="0 0 14 14"><path d="M3 2v10M3 3h8l-1.5 2.5L11 8H3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>}
                              {cat.icon === "clock" && <svg viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M7 4v3l2 1.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>}
                              {cat.icon === "folder" && <svg viewBox="0 0 14 14"><path d="M2 4v7h10V5H7L5.5 3.5H2z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>}
                              {cat.icon === "calendar" && <svg viewBox="0 0 14 14"><rect x="2" y="3" width="10" height="9" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M2 6h10M5 2v2M9 2v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>}
                              {cat.icon === "layers" && <svg viewBox="0 0 14 14"><path d="M7 2l5 2.5-5 2.5-5-2.5L7 2zM2 7l5 2.5L12 7M2 9.5L7 12l5-2.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>}
                              {cat.icon === "check" && <svg viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M4.5 7l1.8 1.8L9.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                            </span>
                            <span className="df-filter-cat-label">{cat.label}</span>
                            {cat.activeCount > 0 && <span className="df-filter-cat-count">{cat.activeCount}</span>}
                            <svg className="df-filter-cat-chevron" viewBox="0 0 8 14" aria-hidden="true"><path d="M2 2l4 5-4 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          </button>
                        ))}
                        {effectiveFilterCategories.length === 0 && <div className="df-filter-empty">{props.lang === "zh" ? "\u6682\u65e0\u53ef\u7528\u7b5b\u9009" : "No filters available"}</div>}
                      </div>
                      {hasActiveFilters && (
                        <button type="button" className="df-filter-reset" onClick={clearAllFilters}>
                          {props.lang === "zh" ? "\u6e05\u9664\u5168\u90e8" : "Clear all"}
                        </button>
                      )}
                    </div>
                    {activeFilterCategory && (
                      <div
                        className="df-filter-flyout-panel"
                        style={{ top: `calc(100% + 6px + ${activeFilterCategoryIndex * 31}px)` }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="df-filter-options-view">
                          <div className="df-filter-options-title">{effectiveFilterCategories.find((cat) => cat.key === activeFilterCategory)?.label}</div>
                          {(filterOptionsByCategory[activeFilterCategory] || []).map((option) => (
                            <label key={option.value} className={`df-filter-option${option.checked ? " checked" : ""}`}>
                              <input type={option.inputType || "checkbox"} checked={option.checked} onChange={option.onToggle} />
                              {option.dotColor && <span className="df-filter-option-dot" style={{ background: option.dotColor }} />}
                              <span>{option.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
              )}
            </div>

          {viewMode !== "metrics" && activeFilterChips.length > 0 && (
            <div className="df-active-filter-bar" role="region" aria-label={props.lang === "zh" ? "Active filters" : "Active filters"}>
              {activeFilterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className="df-active-filter-chip"
                  onClick={chip.onClear}
                  title={props.lang === "zh" ? "\u79fb\u9664\u7b5b\u9009" : "Remove filter"}
                >
                  <span className="df-active-filter-chip-label">{chip.label}</span>
                  <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 2l6 6M8 2l-6 6" /></svg>
                </button>
              ))}
              <button type="button" className="df-active-filter-clear" onClick={clearAllFilters}>
                {props.lang === "zh" ? "\u6e05\u9664\u5168\u90e8" : "Clear all"}
              </button>
            </div>
          )}

          {viewMode === "metrics" && (
            <section className="df-metrics-view" aria-label={props.lang === "zh" ? "时间占比" : "Time allocation metrics"}>
              <header className="df-metrics-header">
                <div className="df-metrics-toolbar">
                  <div className="df-filter-popover-anchor">
                    <button
                      type="button"
                      className={`df-filter-trigger${metricsFilterOpen ? " active" : ""}${metricActiveChips.length > 0 ? " has-active" : ""}`}
                      aria-expanded={metricsFilterOpen}
                      aria-label={props.lang === "zh" ? "指标筛选" : "Metrics filters"}
                      title={props.lang === "zh" ? "指标筛选" : "Metrics filters"}
                      onClick={() => setMetricsFilterOpen((open) => !open)}
                    >
                      <svg viewBox="0 0 18 18" aria-hidden="true"><path d="M3 4h12M5 9h8M7 14h4" /></svg>
                      {metricActiveChips.length > 0 && <b>{metricActiveChips.length}</b>}
                    </button>
                    {metricsFilterOpen && (
                      <>
                        <div className="df-filter-panel df-metrics-filter-panel" onClick={(e) => e.stopPropagation()}>
                          <div className="df-filter-categories">
                            {([
                              ["range", props.lang === "zh" ? "时间范围" : "Range"],
                              ["group", props.lang === "zh" ? "分组方式" : "Group by"],
                              ["project", props.lang === "zh" ? "项目" : "Projects"],
                              ["completion", props.lang === "zh" ? "完成状态" : "Completion"],
                              ["habit", props.lang === "zh" ? "是否包含习惯" : "Habits"],
                              ["metric", props.lang === "zh" ? "显示指标" : "Metric"],
                            ] as Array<[typeof metricsFilterCategory, string]>).map(([key, label]) => (
                              <button
                                type="button"
                                key={key}
                                className={`df-filter-cat-row${metricsFilterCategory === key ? " active" : ""}`}
                                onMouseEnter={() => setMetricsFilterCategory(key)}
                                onFocus={() => setMetricsFilterCategory(key)}
                              >
                                <span className="df-filter-cat-icon" aria-hidden="true">
                                  <svg viewBox="0 0 14 14"><path d="M3 4h8M4 7h6M5 10h4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
                                </span>
                                <span className="df-filter-cat-label">{label}</span>
                                <svg className="df-filter-cat-chevron" viewBox="0 0 8 14" aria-hidden="true"><path d="M2 2l4 5-4 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                              </button>
                            ))}
                          </div>
                          {metricActiveChips.length > 0 && (
                            <button type="button" className="df-filter-reset" onClick={() => {
                              setMetricRange("today");
                              setMetricGroup("project");
                              setMetricHabit("include");
                              setMetricCompletion("all");
                              setMetricsProjectFilter([]);
                            }}>
                              {props.lang === "zh" ? "清除全部" : "Clear all"}
                            </button>
                          )}
                        </div>
                        <div className="df-filter-flyout-panel df-metrics-filter-flyout" onClick={(e) => e.stopPropagation()}>
                          <div className="df-filter-options-view">
                            <div className="df-filter-options-title">
                              {metricsFilterCategory === "range" ? (props.lang === "zh" ? "时间范围" : "Range")
                                : metricsFilterCategory === "group" ? (props.lang === "zh" ? "分组方式" : "Group by")
                                : metricsFilterCategory === "project" ? (props.lang === "zh" ? "项目" : "Projects")
                                : metricsFilterCategory === "completion" ? (props.lang === "zh" ? "完成状态" : "Completion")
                                : metricsFilterCategory === "habit" ? (props.lang === "zh" ? "是否包含习惯" : "Habits")
                                : (props.lang === "zh" ? "显示指标" : "Metric")}
                            </div>
                            {metricsFilterCategory === "range" && (
                              <>
                                {rangeOptions.map((option) => (
                                  <label key={option.value} className={`df-filter-option${metricsRangePreset === option.value ? " checked" : ""}`}>
                                    <input type="radio" checked={metricsRangePreset === option.value} onChange={() => setMetricRange(option.value)} />
                                    <span>{option.label}</span>
                                  </label>
                                ))}
                                {metricsRangePreset === "custom" && (
                                  <div className="df-metrics-custom-dates">
                                    <input type="date" value={metricsCustomStart} onChange={(event) => { setMetricsCustomStart(event.target.value); updateMetricsSetting({ metricsCustomStart: event.target.value }); }} />
                                    <input type="date" value={metricsCustomEnd} onChange={(event) => { setMetricsCustomEnd(event.target.value); updateMetricsSetting({ metricsCustomEnd: event.target.value }); }} />
                                  </div>
                                )}
                              </>
                            )}
                            {metricsFilterCategory === "group" && groupOptions.map((option) => (
                              <label key={option.value} className={`df-filter-option${metricsGroupBy === option.value ? " checked" : ""}${option.disabled ? " disabled" : ""}`}>
                                <input type="radio" checked={metricsGroupBy === option.value} disabled={option.disabled} onChange={() => !option.disabled && setMetricGroup(option.value)} />
                                <span>{option.label}</span>
                              </label>
                            ))}
                            {metricsFilterCategory === "project" && (
                              <>
                                <label className={`df-filter-option${metricsProjectFilter.length === 0 ? " checked" : ""}`}>
                                  <input type="checkbox" checked={metricsProjectFilter.length === 0} onChange={() => setMetricsProjectFilter([])} />
                                  <span>{props.lang === "zh" ? "全部项目" : "All projects"}</span>
                                </label>
                                {safeProjects.map((project) => (
                                  <label key={project.id} className={`df-filter-option${metricsProjectFilter.includes(project.id) ? " checked" : ""}`}>
                                    <input type="checkbox" checked={metricsProjectFilter.includes(project.id)} onChange={() => toggleArray(setMetricsProjectFilter, project.id)} />
                                    <span className="df-filter-option-dot" style={{ background: project.color || DEFAULT_PROJECT_COLOR }} />
                                    <span>{project.title}</span>
                                  </label>
                                ))}
                              </>
                            )}
                            {metricsFilterCategory === "completion" && (["all", "completed", "incomplete"] as MetricCompletionFilter[]).map((value) => (
                              <label key={value} className={`df-filter-option${metricsCompletion === value ? " checked" : ""}`}>
                                <input type="radio" checked={metricsCompletion === value} onChange={() => setMetricCompletion(value)} />
                                <span>{value === "all" ? (props.lang === "zh" ? "全部" : "All") : value === "completed" ? (props.lang === "zh" ? "已完成" : "Completed") : (props.lang === "zh" ? "未完成" : "Incomplete")}</span>
                              </label>
                            ))}
                            {metricsFilterCategory === "habit" && (["include", "exclude", "only"] as MetricHabitMode[]).map((value) => (
                              <label key={value} className={`df-filter-option${metricsHabitMode === value ? " checked" : ""}`}>
                                <input type="radio" checked={metricsHabitMode === value} onChange={() => setMetricHabit(value)} />
                                <span>{value === "include" ? (props.lang === "zh" ? "包含习惯" : "Include habits") : value === "exclude" ? (props.lang === "zh" ? "排除习惯" : "Exclude habits") : (props.lang === "zh" ? "仅习惯" : "Only habits")}</span>
                              </label>
                            ))}
                            {metricsFilterCategory === "metric" && (["percentage", "duration", "taskCount", "completionRate"] as MetricDisplayMetric[]).map((value) => (
                              <label key={value} className={`df-filter-option${metricsDisplayMetric === value ? " checked" : ""}`}>
                                <input type="radio" checked={metricsDisplayMetric === value} onChange={() => setMetricDisplay(value)} />
                                <span>{value === "percentage" ? (props.lang === "zh" ? "百分比" : "Percentage") : value === "duration" ? (props.lang === "zh" ? "总时长" : "Duration") : value === "taskCount" ? (props.lang === "zh" ? "任务数量" : "Task count") : (props.lang === "zh" ? "完成率" : "Completion rate")}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </header>

              {metricActiveChips.length > 0 && (
                <div className="df-active-filter-bar df-metrics-chip-bar" role="region" aria-label={props.lang === "zh" ? "指标筛选" : "Metric filters"}>
                  {metricActiveChips.map((chip) => (
                    <button key={chip.key} type="button" className="df-active-filter-chip" onClick={chip.onClear}>
                      <span className="df-active-filter-chip-label">{chip.label}</span>
                      <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 2l6 6M8 2l-6 6" /></svg>
                    </button>
                  ))}
                </div>
              )}

              {metricsResult.summary.plannedMinutes === 0 ? (
                <div className="df-metrics-empty">
                  <h3>{props.lang === "zh" ? "暂无时间安排" : "No scheduled time"}</h3>
                  <p>{props.lang === "zh" ? "这个时间范围内还没有安排任务。把任务拖入时间轴后，这里会显示时间占比。" : "Schedule tasks on the timeline and this report will show allocation."}</p>
                  <button type="button" className="df-metrics-text-action" onClick={() => setMetricRange("today")}>{props.lang === "zh" ? "调整筛选" : "Adjust filters"}</button>
                </div>
              ) : (
                <>
                  <div className="df-metrics-main-grid">
                    <section className="df-metrics-panel df-metrics-donut-panel">
                      <div className="df-metrics-panel-head">
                        <h3>{props.lang === "zh" ? "项目时间占比图" : "Allocation chart"}</h3>
                        <span>{metricsResult.range.label}</span>
                      </div>
                      <div className="df-metrics-donut-wrap" onMouseLeave={() => setHoveredMetricGroupId(null)}>
                        <svg className="df-metrics-donut" viewBox="0 0 240 240" role="img" aria-label={props.lang === "zh" ? "项目时间占比图" : "Project time allocation chart"}>
                          <circle className="df-metrics-donut-rule" cx="120" cy="120" r="82" />
                          {donutSegments.map(({ group, startAngle, endAngle }) => {
                            const isActive = activeDonutGroup?.id === group.id;
                            return (
                              <path
                                key={group.id}
                                className={`df-metrics-donut-segment${isActive ? " active" : ""}`}
                                d={donutSegmentPath(120, 120, isActive ? 94 : 88, 50, startAngle, endAngle)}
                                fill={alphaColor(group.color, 0.58)}
                                role="button"
                                tabIndex={0}
                                aria-label={`${group.label}: ${formatMinutesZh(group.durationMinutes)}, ${Math.round(group.percentage)}%`}
                                onMouseEnter={() => setHoveredMetricGroupId(group.id)}
                                onFocus={() => setHoveredMetricGroupId(group.id)}
                                onBlur={() => setHoveredMetricGroupId(null)}
                                onClick={() => setHoveredMetricGroupId(group.id)}
                              >
                                <title>{`${group.label}: ${formatMinutesZh(group.durationMinutes)} · ${Math.round(group.percentage)}%`}</title>
                              </path>
                            );
                          })}
                        </svg>
                        <div className="df-metrics-donut-center">
                          <strong>{formatMinutesZh(metricsResult.summary.plannedMinutes)}</strong>
                          <span>{metricsResult.range.label}</span>
                        </div>
                      </div>
                    </section>
                    <aside className="df-metrics-summary" aria-label={props.lang === "zh" ? "指标摘要" : "Metrics summary"}>
                      <div><span>{props.lang === "zh" ? "已安排时间" : "Planned"}</span><strong>{formatMinutesZh(metricsResult.summary.plannedMinutes)}</strong></div>
                      <div><span>{props.lang === "zh" ? "未安排时间" : "Unplanned"}</span><strong>{formatMinutesZh(metricsResult.summary.unplannedMinutes)}</strong></div>
                      <div><span>{props.lang === "zh" ? "任务数量" : "Tasks"}</span><strong>{metricsResult.summary.taskCount}</strong></div>
                      <div><span>{props.lang === "zh" ? "完成率" : "Done"}</span><strong>{Math.round(metricsResult.summary.completionRate * 100)}%</strong></div>
                      <div><span>{props.lang === "zh" ? "最高投入" : "Top focus"}</span><strong>{metricsResult.summary.topGroup?.label || "-"}</strong></div>
                      {activeDonutGroup && (
                        <div className="df-metrics-summary-focus">
                          <span>{props.lang === "zh" ? "当前项目" : "Current"}</span>
                          <strong>{activeDonutGroup.label}</strong>
                          <em>{formatMinutesZh(activeDonutGroup.durationMinutes)} · {Math.round(activeDonutGroup.percentage)}%</em>
                        </div>
                      )}
                    </aside>
                  </div>
                </>
              )}
            </section>
          )}

          {viewMode === "kanban" && (
            <div className="df-kanban-board">
              {(["backlog", "done"] as UiWorkflowStatus[]).map((status) => {
                const columnTasks = orderPlanningTasks(kanbanTasks.filter((task) => status === "done" ? normalizeWorkflowStatus(task) === "done" : normalizeWorkflowStatus(task) !== "done"));
                return (
                  <div
                    key={status}
                    className={`df-kanban-column${kanbanDropStatus === status ? " is-drop-target drop-container-active" : ""}`}
                    data-kanban-status={status}
                  >
                    <div className="df-kanban-column-header">
                      <span>{status === "done" ? (props.lang === "zh" ? "Done" : "Done") : (props.lang === "zh" ? "Tasks" : "Tasks")}</span>
                      <small>{columnTasks.length}</small>
                      {columnTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0) > 0 && (
                        <em className="df-kanban-column-duration">{columnTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0)}h</em>
                      )}
                    </div>
                    <div className="df-kanban-card-list">
                      {columnTasks.map((task) => {
                        const isDropTarget = listDropTargetId === task.id;
                        return (
                        <React.Fragment key={task.id}>
                        {isDropTarget && listDropPosition === "before" && <div className="df-list-insertion-line" aria-hidden="true" />}
                        <TaskBlock
                          key={task.id}
                          as="div"
                          variant="planning"
                          appearance="calm"
                          priority={planningTaskPriority(task)}
                          checked={normalizeWorkflowStatus(task) === "done"}
                          projectColor={projectColor(task.projectId)}
                          className={`df-kanban-card${normalizeWorkflowStatus(task) === "done" ? " completed" : ""}`}
                          dataAttrs={{ "planning-task-id": task.id, "planning-container": `kanban:${status}` }}
                          onPointerDown={(event) => beginPlanningDrag(event, task, "planning")}
                          onClick={() => openTaskFromPlanning(task)}
                        >
                          <TaskBlockRow>
                            <TaskCheckbox
                              checked={normalizeWorkflowStatus(task) === "done"}
                              tone={normalizeTaskCheckTone(task)}
                              importance={task.importance}
                              urgency={task.urgency}
                              className="df-list-status-toggle"
                              ariaLabel={normalizeWorkflowStatus(task) === "done" ? "Mark open" : "Mark done"}
                              onClick={(e) => { e.stopPropagation(); props.onTaskUpdate(task.id, workflowStatusForPatch(normalizeWorkflowStatus(task) === "done" ? "backlog" : "done")); }}
                            />
                            <TaskBlockContent className="df-planning-task-copy" title={<span className="df-kanban-card-title">{task.title}</span>}>
                              <span className="df-kanban-card-meta">
                                <span className="df-kanban-project-name" style={{ color: projectColor(task.projectId) }}>{projectName(task.projectId)}</span>
                                {task.dueDate && <span className="df-kanban-tag df-tag-due" title={props.lang === "zh" ? "Due" : "Due"}>{task.dueDate.slice(5)}</span>}
                              </span>
                            </TaskBlockContent>
                          </TaskBlockRow>
                        </TaskBlock>
                        {isDropTarget && listDropPosition === "after" && <div className="df-list-insertion-line" aria-hidden="true" />}
                        </React.Fragment>
                        );
                      })}
                      {planningDragTask && kanbanDropStatus === status && (
                        <div className="df-kanban-drop-placeholder" aria-hidden="true" />
                      )}
                      {columnTasks.length === 0 && !planningDragTask && <div className="df-kanban-empty">{props.lang === "zh" ? "Drop tasks here" : "Drop tasks here"}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {viewMode === "eisenhower" && (
            <div className="df-eisenhower-grid">
              {([
                { key: "q1", label: "Focus now", importance: "high" as const, urgency: "high" as const },
                { key: "q2", label: "Plan", importance: "high" as const, urgency: "low" as const },
                { key: "q3", label: "Handle soon", importance: "low" as const, urgency: "high" as const },
                { key: "q4", label: "Later", importance: "low" as const, urgency: "low" as const },
              ]).map((quad) => {
                const quadTasks = orderPlanningTasks(viewFilteredTasks.filter((task) => {
                  const imp = task.importance || "medium";
                  const urg = task.urgency || "medium";
                  const matchImp = quad.importance === "high" ? imp === "high" : imp !== "high";
                  const matchUrg = quad.urgency === "high" ? urg === "high" : urg !== "high";
                  return matchImp && matchUrg;
                }));
                return (
                  <div
                    key={quad.key}
                    className={`df-eisenhower-quadrant${kanbanDropStatus === ("q-" + quad.key) as unknown as UiWorkflowStatus ? " is-drop-target drop-container-active" : ""}`}
                    data-quadrant={quad.key}
                  >
                    <div className="df-eisenhower-quadrant-header">
                      <span>{quad.label}</span>
                      <small>{quadTasks.length}</small>
                      {quadTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0) > 0 && (
                        <em className="df-eisenhower-quadrant-duration">{quadTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0)}h</em>
                      )}
                    </div>
                    <div className="df-eisenhower-task-list">
                      {quadTasks.map((task) => {
                        const taskDone = normalizeWorkflowStatus(task) === "done";
                        const isDropTarget = listDropTargetId === task.id;
                        return (
                          <React.Fragment key={task.id}>
                          {isDropTarget && listDropPosition === "before" && <div className="df-list-insertion-line" aria-hidden="true" />}
                          <TaskBlock
                            key={task.id}
                            as="div"
                            variant="planning"
                            appearance="calm"
                            priority={planningTaskPriority(task)}
                            checked={taskDone}
                            projectColor={projectColor(task.projectId)}
                            className={`df-eisenhower-task${taskDone ? " completed" : ""}`}
                            dataAttrs={{ "planning-task-id": task.id, "planning-container": `matrix:${quad.key}` }}
                            onPointerDown={(event) => beginPlanningDrag(event, task, "planning")}
                            onClick={() => openTaskFromPlanning(task)}
                          >
                            <TaskBlockRow>
                              <TaskCheckbox
                                checked={taskDone}
                                tone={normalizeTaskCheckTone(task)}
                                importance={task.importance}
                                urgency={task.urgency}
                                className="df-list-status-toggle"
                                ariaLabel={taskDone ? "Mark open" : "Mark done"}
                                onClick={(e) => { e.stopPropagation(); props.onTaskUpdate(task.id, workflowStatusForPatch(taskDone ? "backlog" : "done")); }}
                              />
                              <TaskBlockContent className="df-planning-task-copy" title={<span className="df-eisenhower-task-title">{task.title}</span>}>
                                <span className="df-eisenhower-task-meta">
                                  <span className="df-eisenhower-project-name" style={{ color: projectColor(task.projectId) }}>{projectName(task.projectId)}</span>
                                  {task.dueDate && <span className="df-eisenhower-due">{task.dueDate.slice(5)}</span>}
                                </span>
                              </TaskBlockContent>
                            </TaskBlockRow>
                          </TaskBlock>
                          {isDropTarget && listDropPosition === "after" && <div className="df-list-insertion-line" aria-hidden="true" />}
                          </React.Fragment>
                        );
                      })}
                      {planningDragTask && kanbanDropStatus === (("q-" + quad.key) as unknown as UiWorkflowStatus) && (
                        <div className="df-kanban-drop-placeholder" aria-hidden="true" />
                      )}
                      {quadTasks.length === 0 && !planningDragTask && <div className="df-eisenhower-empty">Drop tasks here</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {viewMode === "list" && (
            <div className="df-planning-list">
              {viewFilteredTasks.length === 0 && <div className="df-planning-list-empty">{props.lang === "zh" ? "\u6682\u65e0\u4efb\u52a1" : "No tasks"}</div>}
              {orderPlanningTasks(viewFilteredTasks).map((task) => {
                const uiStatus = normalizeWorkflowStatus(task);
                const isDropTarget = listDropTargetId === task.id;
                return (
                  <div
                    key={task.id}
                    className={`df-planning-list-row-wrap${isDropTarget ? ` is-list-drop is-${listDropPosition}` : ""}`}
                    data-list-task-id={task.id}
                  >
                    {isDropTarget && listDropPosition === "before" && <div className="df-list-insertion-line" aria-hidden="true" />}
                    <TaskBlock
                      as="div"
                      variant="compact"
                      appearance="calm"
                      priority={planningTaskPriority(task)}
                      checked={uiStatus === "done"}
                      projectColor={projectColor(task.projectId)}
                      className="df-planning-list-row"
                      dataAttrs={{ "planning-task-id": task.id, "planning-container": "list" }}
                      onPointerDown={(event) => beginPlanningDrag(event, task, "compact")}
                    >
                      <TaskBlockRow>
                        <TaskCheckbox
                          checked={uiStatus === "done"}
                          tone={normalizeTaskCheckTone(task)}
                          importance={task.importance}
                          urgency={task.urgency}
                          className="df-list-status-toggle"
                          ariaLabel={uiStatus === "done" ? "Mark open" : "Mark done"}
                          onClick={() => props.onTaskUpdate(task.id, workflowStatusForPatch(uiStatus === "done" ? "backlog" : "done"))}
                        />
                        <TaskBlockContent title={<span className="df-list-title" onClick={() => openTaskFromPlanning(task)}>{task.title}</span>} />
                        <TaskBlockDuration>
                          <span className="df-list-project">{projectName(task.projectId)}</span>
                        </TaskBlockDuration>
                        <TaskActions>
                          {task.dueDate && <span className="df-list-tag df-tag-due" title={props.lang === "zh" ? "\u622a\u6b62\u65e5\u671f" : "Due"}>{task.dueDate.slice(5)}</span>}
                        </TaskActions>
                      </TaskBlockRow>
                    </TaskBlock>
                    {isDropTarget && listDropPosition === "after" && <div className="df-list-insertion-line" aria-hidden="true" />}
                  </div>
                );
              })}
            </div>
          )}

          {viewMode === "tree" && (
          <div
            className={`df-tree${dragNode ? " is-tree-dragging" : ""}`}
            ref={treeRef}
            onPointerDown={(event) => {
              if (props.compact) return;
              const origin = event.target as HTMLElement;
              if (origin.closest("button, input, textarea, select, [contenteditable='true']")) return;
              const node = origin.closest<HTMLElement>("[data-node-type][data-node-id]");
              if (!node) return;
              const source = { kind: node.dataset.nodeType as TreeNodeKind, id: node.dataset.nodeId || "" };
              beginTreeDrag(event, source);
            }}
          >
            {svgLines}
            {dropTarget && (
              <div
                className={`df-tree-drop-preview ${dropTarget.position}`}
                style={{ position: "absolute", top: dropTarget.top, left: dropTarget.left, width: dropTarget.width }}
              >
                {dropTarget.position === "inside" ? "Place inside" : dropTarget.position === "before" ? "Place before" : "Place after"}
              </div>
            )}
            {visibleProjects.map(({ project, tasks }) => (
              <div className="df-category-branch" key={project.id} data-project-id={project.id}>
                <PlanningProjectNode
                  lang={props.lang}
                  project={project}
                  taskCount={tasks.length}
                  collapsed={Boolean(props.collapsed[project.id])}
                  onToggleCollapse={() => props.setCollapsed((current) => ({ ...current, [project.id]: !current[project.id] }))}
                  onOpen={() => props.onProjectEdit(project)}
                  onAddTask={() => props.onTaskCreate(project.id)}
                  onComplete={() => props.onProjectComplete?.(project.id)}
                  dragging={dragNode?.kind === "project" && dragNode.id === project.id}
                />
                {!props.collapsed[project.id] && (
                  <div className="df-project-tasks">
                    {tasks.map((task) => (
                      <div className="df-task-branch" key={task.id}>
                        <PlanningTaskNode
                          lang={props.lang}
                          task={task}
                          addedToToday={task.plannedForDate === today && task.executionLane === "candidate"}
                          projectColor={project.color || DEFAULT_PROJECT_COLOR}
                          collapsed={Boolean(collapsedSubtasks[task.id])}
                          onToggleCollapse={() => setCollapsedSubtasks((current) => ({ ...current, [task.id]: !current[task.id] }))}
                          onOpen={() => openTaskFromPlanning(task)}
                          onToggleTodayCandidate={() => props.onToggleTodayCandidate(task.id)}
                          onRename={() => renameTask(task)}
                          onAddSubtask={() => addSubtask(task)}
                          onSetDate={() => setTaskDate(task)}
                          onMoveProject={() => moveTaskProject(task)}
                          onDelete={() => props.onTaskDelete(task.id)}
                          onToggleComplete={() => props.onTaskUpdate(task.id, workflowStatusForPatch(normalizeWorkflowStatus(task) === "done" ? "backlog" : "done"))}
                          onToggleSubtask={(subtaskId) => toggleSubtask(task.id, subtaskId)}
                          dragging={dragNode?.kind === "task" && dragNode.id === task.id}
                        />
                        {!collapsedSubtasks[task.id] && (task.subtasks || []).length > 0 && (
                          <div className="df-subtask-list" data-parent-id={task.id}>
                            {(task.subtasks || []).map((subtask) => (
                              <PlanningSubtaskNode
                                lang={props.lang}
                                key={subtask.id}
                                subtask={subtask}
                                projectColor={project.color || DEFAULT_PROJECT_COLOR}
                                onToggle={(subtaskId) => toggleSubtask(task.id, subtaskId)}
                                onPromote={promoteSubtask}
                                onRename={renameSubtask}
                                onSetDate={setSubtaskDate}
                                onMoveProject={moveSubtaskProject}
                                onDelete={deleteSubtask}
                                onAddSubtask={(parentId) => addSubtask(task, parentId)}
                                dragging={dragNode?.kind === "subtask" && dragNode.id === subtask.id}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {unassigned.length > 0 && (
              <div className="df-category-branch" data-project-id="__unassigned__">
                <PlanningProjectNode
                  lang={props.lang}
                  project={createProjectShell(t(props.lang, "planning.unassignedTasks"))}
                  taskCount={unassigned.length}
                  collapsed={Boolean(props.collapsed.unassigned)}
                  onToggleCollapse={() => props.setCollapsed((current) => ({ ...current, unassigned: !current.unassigned }))}
                  onOpen={() => {}}
                  onAddTask={() => props.onTaskCreate("")}
                  dragging={dragNode?.kind === "project" && dragNode.id === "__unassigned__"}
                />
                {!props.collapsed.unassigned && (
                  <div className="df-project-tasks">
                    {unassigned.map((task) => (
                      <div className="df-task-branch" key={task.id}>
                        <PlanningTaskNode
                          lang={props.lang}
                          task={task}
                          addedToToday={task.plannedForDate === today && task.executionLane === "candidate"}
                          projectColor={UNASSIGNED_COLOR}
                          collapsed={Boolean(collapsedSubtasks[task.id])}
                          onToggleCollapse={() => setCollapsedSubtasks((current) => ({ ...current, [task.id]: !current[task.id] }))}
                          onOpen={() => openTaskFromPlanning(task)}
                          onToggleTodayCandidate={() => props.onToggleTodayCandidate(task.id)}
                          onRename={() => renameTask(task)}
                          onAddSubtask={() => addSubtask(task)}
                          onSetDate={() => setTaskDate(task)}
                          onMoveProject={() => moveTaskProject(task)}
                          onDelete={() => props.onTaskDelete(task.id)}
                          onToggleComplete={() => props.onTaskUpdate(task.id, workflowStatusForPatch(normalizeWorkflowStatus(task) === "done" ? "backlog" : "done"))}
                          onToggleSubtask={(subtaskId) => toggleSubtask(task.id, subtaskId)}
                          dragging={dragNode?.kind === "task" && dragNode.id === task.id}
                        />
                        {!collapsedSubtasks[task.id] && (task.subtasks || []).length > 0 && (
                          <div className="df-subtask-list" data-parent-id={task.id}>
                            {(task.subtasks || []).map((subtask) => (
                              <PlanningSubtaskNode
                                lang={props.lang}
                                key={subtask.id}
                                subtask={subtask}
                                projectColor={UNASSIGNED_COLOR}
                                onToggle={(subtaskId) => toggleSubtask(task.id, subtaskId)}
                                onPromote={promoteSubtask}
                                onRename={renameSubtask}
                                onSetDate={setSubtaskDate}
                                onMoveProject={moveSubtaskProject}
                                onDelete={deleteSubtask}
                                onAddSubtask={(parentId) => addSubtask(task, parentId)}
                                dragging={dragNode?.kind === "subtask" && dragNode.id === subtask.id}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          )}
        </div>
      </section>

      {planningDragTask && (
        <TaskDragLayer
          pointer={planningDragTask.pointer}
          sourceRect={planningDragTask.sourceRect}
          offset={planningDragTask.offset}
        >
          <TaskBlock
            as="article"
            variant={planningDragTask.variant}
            appearance="calm"
            priority={planningTaskPriority(planningDragTask.task)}
            checked={normalizeWorkflowStatus(planningDragTask.task) === "done"}
            dragState="overlay"
            projectColor={projectColor(planningDragTask.task.projectId)}
            className="df-task-card"
            style={{ width: "100%", height: "100%", minHeight: 0 }}
          >
            <TaskBlockRow>
              <TaskCheckbox
                checked={normalizeWorkflowStatus(planningDragTask.task) === "done"}
                tone={normalizeTaskCheckTone(planningDragTask.task)}
              />
              <TaskBlockContent
                title={<span>{planningDragTask.task.title}</span>}
              />
              {planningDragTask.task.estimatedHours ? (
                <TaskBlockDuration>
                  <span className="df-duration-pill">{planningDragTask.task.estimatedHours}h</span>
                </TaskBlockDuration>
              ) : null}
            </TaskBlockRow>
          </TaskBlock>
        </TaskDragLayer>
      )}
      </div>
    </main>
  );
}
