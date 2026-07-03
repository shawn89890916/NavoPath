import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PlannerData, Project, Subtask, Task, WorkflowStatus } from "./types";
import { t, type Language } from "./i18n";
import { useInAppDialog } from "./InAppDialog";
import { localIsoDate } from "./utils/localDate";
import { buildTaskMetaBadges } from "./utils/taskMetaBadges";
import { kanbanGroups, WORKFLOW_LABELS } from "./utils/productivity";
import { normalizeTaskCheckTone, normalizeWorkflowStatus, workflowStatusForPatch, type UiWorkflowStatus, type StateFilterValue } from "./utils/productivityModel";
import { normalizeTreeOrder, reorderProjects, reorderSubtasks, reorderTasks, findSubtaskInTree, removeSubtaskFromTree, addSubtaskToTree, countSubtasks, countDoneSubtasks } from "./utils/treeOrder";
import { TaskActions, TaskBlock, TaskBlockContent, TaskBlockDuration, TaskBlockRow, TaskCheckbox } from "./components/TaskBlock";

type TreeNodeKind = "project" | "task" | "subtask";
type TreeDragNode = { kind: TreeNodeKind; id: string };
type TreeDropTarget = TreeDragNode & { position: "before" | "inside" | "after"; top: number; left: number; width: number };

const DEFAULT_PROJECT_COLOR = "var(--accent-plan, #CAFF72)";
const UNASSIGNED_COLOR = "#7B8191";

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
        draggable
        className={`df-plan-subtask-node ${done ? "done" : ""}${hasChildren ? " has-children" : ""}`}
        data-node-id={props.subtask.id}
        data-node-type="subtask"
        style={{ "--project-color": props.projectColor, "--task-project-color": props.projectColor } as React.CSSProperties}
      >
        <TaskBlock
          as="div"
          variant="habit-child"
          appearance="calm"
          checked={done}
          projectColor={props.projectColor}
          className="df-subtask-inner"
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
        draggable
        className={`df-plan-task-node${props.addedToToday ? " added-to-today" : ""}`}
        data-node-id={props.task.id}
        data-node-type="task"
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
          onClick={props.onOpen}
        >
          <TaskBlockRow>
            <TaskCheckbox
              checked={done}
              tone={normalizeTaskCheckTone(props.task)}
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
}) {
  const { tooltipEl, showTip, hideTip } = useTooltip();
  const titleRef = useRef<HTMLSpanElement>(null);
  const color = props.project.color || DEFAULT_PROJECT_COLOR;

  return (
    <>
      {tooltipEl}
      <div
        draggable
        className={`df-plan-project-node ${props.collapsed ? "collapsed" : ""}`}
        data-node-id={props.project.id}
        data-node-type="project"
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

        // 鈹€鈹€ Simplified tree lines: subtle, minimal 鈹€鈹€
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

        // Trunk x-position (relative to tree) 鈥?28px indent from project left
        const trunkX = 28;
        const projBottom = projectRect.bottom - treeRect.top;

        const firstCenterY = Math.min(...taskPositions.map((t) => t.centerY));
        const lastCenterY = Math.max(...taskPositions.map((t) => t.centerY));

        const colMain = alphaColor(projectColor, 0.08);
        const colBranch = alphaColor(projectColor, 0.05);

        // 1. Trunk: short vertical from project bottom 鈫?first task
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

type PlanningViewMode = "tree" | "kanban" | "eisenhower" | "list";

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
    return modes;
  }, [enableKanban, enableQuadrant, enableList]);
  const [viewMode, setViewMode] = useState<PlanningViewMode>("tree");
  const [showCompleted, setShowCompleted] = useState(false);
  const [filterProjects, setFilterProjects] = useState<string[]>([]);
  const [filterWorkflows, setFilterWorkflows] = useState<UiWorkflowStatus[]>([]);
  const [filterImportances, setFilterImportances] = useState<StateFilterValue[]>([]);
  const [filterUrgencies, setFilterUrgencies] = useState<StateFilterValue[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [kanbanDragTaskId, setKanbanDragTaskId] = useState<string | null>(null);
  const [kanbanDropStatus, setKanbanDropStatus] = useState<UiWorkflowStatus | null>(null);

  const today = todayIso();

  const unassigned = safeTasks.filter((task) => task && !task.projectId && !task.completed && (showAddedTasks || task.plannedForDate !== today));

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
            ? "绉诲姩鐖朵换鍔″埌椤圭洰"
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

  const handleTreeDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!dragNode) return;
    const node = (event.target as HTMLElement).closest<HTMLElement>("[data-node-type][data-node-id]");
    const tree = treeRef.current;
    if (!node || !tree) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const rect = node.getBoundingClientRect();
    const ratio = (event.clientY - rect.top) / Math.max(rect.height, 1);
    const position = ratio < 0.28 ? "before" : ratio > 0.72 ? "after" : "inside";
    const treeRect = tree.getBoundingClientRect();
    setDropTarget({
      kind: node.dataset.nodeType as TreeNodeKind,
      id: node.dataset.nodeId || "",
      position,
      top: rect.top - treeRect.top + tree.scrollTop + (position === "before" ? -16 : position === "after" ? rect.height - 2 : rect.height / 2 - 16),
      left: rect.left - treeRect.left + tree.scrollLeft + (position === "inside" ? 22 : 0),
      width: Math.max(160, rect.width - (position === "inside" ? 22 : 0)),
    });
  }, [dragNode]);

  const visibleProjects = useMemo(
    () => safeProjects.map((project) => ({
      project,
      tasks: safeTasks.filter((task) => String(task.projectId || "") === String(project.id) && !task.completed && (showAddedTasks || task.plannedForDate !== today)),
    })),
    [safeProjects, safeTasks, showAddedTasks],
  );

  const svgLines = useTreeLines(treeRef, safeProjects, safeTasks, props.collapsed, collapsedSubtasks);

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
      return true;
    });
  }, [safeTasks, showCompleted, showAddedTasks, today, filterProjects, filterWorkflows, filterImportances, filterUrgencies]);

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

  const hasActiveFilters = filterProjects.length > 0 || filterWorkflows.length > 0 || filterImportances.length > 0 || filterUrgencies.length > 0;

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
      label: `${props.lang === "zh" ? "Importance" : "Importance"}: ${stateLabel(v)}`,
      onClear: () => toggleArray(setFilterImportances, v),
    })),
    ...filterUrgencies.map((v) => ({
      key: `urgency-${v}`,
      label: `${props.lang === "zh" ? "Urgency" : "Urgency"}: ${stateLabel(v)}`,
      onClear: () => toggleArray(setFilterUrgencies, v),
    })),
  ];

  const clearAllFilters = () => {
    setFilterProjects([]);
    setFilterWorkflows([]);
    setFilterImportances([]);
    setFilterUrgencies([]);
  };

  return (
    <main className={`df-planning${props.compact ? " compact-layout" : ""}`}>
      {dialog.host}
      <div className="df-planning-body">
        <section className="df-mindmap no-root">
          <aside className="df-planning-sidebar" aria-label={props.lang === "zh" ? "规划工具" : "Planning tools"}>
            <div className="df-planning-filter-bar">
              <div className="df-planning-filter-menu">
                <button
                  type="button"
                  className={`df-filter-trigger${filterOpen ? " active" : ""}${hasActiveFilters ? " has-active" : ""}`}
                  aria-expanded={filterOpen}
                  aria-label={props.lang === "zh" ? "Filter" : "Filter"}
                  title={props.lang === "zh" ? "Filter" : "Filter"}
                  onClick={() => setFilterOpen((open) => !open)}
                >
                  <svg viewBox="0 0 18 18" aria-hidden="true">
                    <path d="M3 4h12M5 9h8M7 14h4" />
                  </svg>
                  {hasActiveFilters && <b>{filterProjects.length + filterWorkflows.length + filterImportances.length + filterUrgencies.length + (showCompleted ? 1 : 0) + (showAddedTasks ? 1 : 0)}</b>}
                </button>
                {filterOpen && (
                  <div className="df-filter-panel" onClick={(e) => e.stopPropagation()}>
                    <header>
                      <strong>{props.lang === "zh" ? "Task filters" : "Task filters"}</strong>
                      {hasActiveFilters && (
                        <button type="button" onClick={() => { setFilterProjects([]); setFilterWorkflows([]); setFilterImportances([]); setFilterUrgencies([]); }}>
                          {props.lang === "zh" ? "Reset" : "Reset"}
                        </button>
                      )}
                    </header>
                    {filterChips.map((chip) => (
                      <section key={chip.key} className="df-filter-section">
                        <div className="df-filter-section-head">
                          <span>{chip.label}</span>
                          <small>{chip.selected.length > 0 ? chip.selected.join(", ") : (props.lang === "zh" ? "All" : "All")}</small>
                        </div>
                        <div className="df-filter-options">
                          {chip.options.map((opt) => (
                            <label key={opt.value} className={`df-filter-option${opt.checked ? " checked" : ""}`}>
                              <input type="checkbox" checked={opt.checked} onChange={opt.onToggle} />
                              <span>{opt.label}</span>
                            </label>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </div>
              {availableModes.length > 1 && (
                <div className="df-planning-view-switch">
                  {availableModes.map((m) => (
                    <button key={m} className={`df-view-btn${viewMode === m ? " active" : ""}`} onClick={() => setViewMode(m)}>
                      {m === "tree" ? (props.lang === "zh" ? "Tree" : "Tree") : m === "kanban" ? "Kanban" : m === "eisenhower" ? (props.lang === "zh" ? "Matrix" : "Matrix") : (props.lang === "zh" ? "List" : "List")}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>
          <div className="df-tree-wrap">
          {activeFilterChips.length > 0 && (
            <div className="df-active-filter-bar" role="region" aria-label={props.lang === "zh" ? "Active filters" : "Active filters"}>
              {activeFilterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className="df-active-filter-chip"
                  onClick={chip.onClear}
                  title={props.lang === "zh" ? "移除筛选" : "Remove filter"}
                >
                  <span className="df-active-filter-chip-label">{chip.label}</span>
                  <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 2l6 6M8 2l-6 6" /></svg>
                </button>
              ))}
              <button type="button" className="df-active-filter-clear" onClick={clearAllFilters}>
                {props.lang === "zh" ? "清除全部" : "Clear all"}
              </button>
            </div>
          )}

          {viewMode === "kanban" && (
            <div className="df-kanban-board">
              {(["backlog", "done"] as UiWorkflowStatus[]).map((status) => {
                const columnTasks = kanbanTasks.filter((task) => status === "done" ? normalizeWorkflowStatus(task) === "done" : normalizeWorkflowStatus(task) !== "done");
                return (
                  <div
                    key={status}
                    className={`df-kanban-column${kanbanDropStatus === status ? " is-drop-target" : ""}`}
                    onDragOver={(e) => { e.preventDefault(); setKanbanDropStatus(status); }}
                    onDragLeave={() => setKanbanDropStatus(null)}
                    onDrop={(e) => { e.preventDefault(); handleKanbanDrop(status); }}
                  >
                    <div className="df-kanban-column-header">
                      <span>{status === "done" ? (props.lang === "zh" ? "Done" : "Done") : (props.lang === "zh" ? "Tasks" : "Tasks")}</span>
                      <small>{columnTasks.length}</small>
                    </div>
                    <div className="df-kanban-card-list">
                      {columnTasks.map((task) => (
                        <TaskBlock
                          key={task.id}
                          as="div"
                          variant="planning"
                          appearance="calm"
                          priority={planningTaskPriority(task)}
                          checked={normalizeWorkflowStatus(task) === "done"}
                          projectColor={projectColor(task.projectId)}
                          className={`df-kanban-card${normalizeWorkflowStatus(task) === "done" ? " completed" : ""}${kanbanDragTaskId === task.id ? " is-drag-source" : ""}`}
                          draggable
                          onDragStart={() => setKanbanDragTaskId(task.id)}
                          onDragEnd={() => { setKanbanDragTaskId(null); setKanbanDropStatus(null); }}
                          onClick={() => props.onTaskEdit(task)}
                        >
                          <TaskBlockRow>
                            <TaskCheckbox
                              checked={normalizeWorkflowStatus(task) === "done"}
                              tone={normalizeTaskCheckTone(task)}
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
                      ))}
                      {kanbanDragTaskId && kanbanDropStatus === status && (
                        <div className="df-kanban-drop-placeholder" aria-hidden="true" />
                      )}
                      {columnTasks.length === 0 && kanbanDragTaskId == null && <div className="df-kanban-empty">{props.lang === "zh" ? "Drop tasks here" : "Drop tasks here"}</div>}
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
                const quadTasks = viewFilteredTasks.filter((task) => {
                  const imp = task.importance || "medium";
                  const urg = task.urgency || "medium";
                  const matchImp = quad.importance === "high" ? imp === "high" : imp !== "high";
                  const matchUrg = quad.urgency === "high" ? urg === "high" : urg !== "high";
                  return matchImp && matchUrg;
                });
                return (
                  <div
                    key={quad.key}
                    className={`df-eisenhower-quadrant${kanbanDropStatus === ("q-" + quad.key) as unknown as UiWorkflowStatus ? " is-drop-target" : ""}`}
                    onDragOver={(e) => { e.preventDefault(); setKanbanDropStatus(("q-" + quad.key) as unknown as UiWorkflowStatus); }}
                    onDragLeave={() => setKanbanDropStatus(null)}
                    onDrop={(e) => { e.preventDefault(); handleQuadrantDrop(quad.importance, quad.urgency); }}
                  >
                    <div className="df-eisenhower-quadrant-header"><span>{quad.label}</span><small>{quadTasks.length}</small></div>
                    <div className="df-eisenhower-task-list">
                      {quadTasks.map((task) => {
                        const taskDone = normalizeWorkflowStatus(task) === "done";
                        return (
                          <TaskBlock
                            key={task.id}
                            as="div"
                            variant="planning"
                            appearance="calm"
                            priority={planningTaskPriority(task)}
                            checked={taskDone}
                            projectColor={projectColor(task.projectId)}
                            className={`df-eisenhower-task${taskDone ? " completed" : ""}${kanbanDragTaskId === task.id ? " is-drag-source" : ""}`}
                            draggable
                            onDragStart={() => setKanbanDragTaskId(task.id)}
                            onDragEnd={() => { setKanbanDragTaskId(null); setKanbanDropStatus(null); }}
                            onClick={() => props.onTaskEdit(task)}
                          >
                            <TaskBlockRow>
                              <TaskCheckbox
                                checked={taskDone}
                                tone={normalizeTaskCheckTone(task)}
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
                        );
                      })}
                      {kanbanDragTaskId && kanbanDropStatus === (("q-" + quad.key) as unknown as UiWorkflowStatus) && (
                        <div className="df-kanban-drop-placeholder" aria-hidden="true" />
                      )}
                      {quadTasks.length === 0 && kanbanDragTaskId == null && <div className="df-eisenhower-empty">Drop tasks here</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {viewMode === "list" && (
            <div className="df-planning-list">
              {viewFilteredTasks.length === 0 && <div className="df-planning-list-empty">{props.lang === "zh" ? "暂无任务" : "No tasks"}</div>}
              {viewFilteredTasks.map((task) => {
                const uiStatus = normalizeWorkflowStatus(task);
                return (
                  <TaskBlock
                    key={task.id}
                    as="div"
                    variant="compact"
                    appearance="calm"
                    priority={planningTaskPriority(task)}
                    checked={uiStatus === "done"}
                    projectColor={projectColor(task.projectId)}
                    className="df-planning-list-row"
                  >
                    <TaskBlockRow>
                      <TaskCheckbox
                        checked={uiStatus === "done"}
                        tone={normalizeTaskCheckTone(task)}
                        className="df-list-status-toggle"
                        ariaLabel={uiStatus === "done" ? "Mark open" : "Mark done"}
                        onClick={() => props.onTaskUpdate(task.id, workflowStatusForPatch(uiStatus === "done" ? "backlog" : "done"))}
                      />
                      <TaskBlockContent title={<span className="df-list-title" onClick={() => props.onTaskEdit(task)}>{task.title}</span>} />
                      <TaskBlockDuration>
                        <span className="df-list-project">{projectName(task.projectId)}</span>
                      </TaskBlockDuration>
                      <TaskActions>
                        {task.dueDate && <span className="df-list-tag df-tag-due" title={props.lang === "zh" ? "截止" : "Due"}>{task.dueDate.slice(5)}</span>}
                      </TaskActions>
                    </TaskBlockRow>
                  </TaskBlock>
                );
              })}
            </div>
          )}

          {viewMode === "tree" && (
          <div
            className={`df-tree${dragNode ? " is-tree-dragging" : ""}`}
            ref={treeRef}
            onDragStartCapture={(event) => {
              if (props.compact) {
                event.preventDefault();
                return;
              }
              const origin = event.target as HTMLElement;
              if (origin.closest("button, input, textarea, select, [contenteditable='true']")) {
                event.preventDefault();
                return;
              }
              const node = origin.closest<HTMLElement>("[data-node-type][data-node-id]");
              if (!node) return;
              const source = { kind: node.dataset.nodeType as TreeNodeKind, id: node.dataset.nodeId || "" };
              setDragNode(source);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("application/x-navopath-tree", JSON.stringify(source));
            }}
            onDragOver={handleTreeDragOver}
            onDrop={(event) => {
              event.preventDefault();
              if (dragNode && dropTarget) void handleTreeDrop(dragNode, dropTarget);
              setDragNode(null);
              setDropTarget(null);
            }}
            onDragEnd={() => {
              setDragNode(null);
              setDropTarget(null);
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
                          onOpen={() => props.onTaskEdit(task)}
                          onToggleTodayCandidate={() => props.onToggleTodayCandidate(task.id)}
                          onRename={() => renameTask(task)}
                          onAddSubtask={() => addSubtask(task)}
                          onSetDate={() => setTaskDate(task)}
                          onMoveProject={() => moveTaskProject(task)}
                          onDelete={() => props.onTaskDelete(task.id)}
                          onToggleComplete={() => props.onTaskUpdate(task.id, workflowStatusForPatch(normalizeWorkflowStatus(task) === "done" ? "backlog" : "done"))}
                          onToggleSubtask={(subtaskId) => toggleSubtask(task.id, subtaskId)}
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
                          onOpen={() => props.onTaskEdit(task)}
                          onToggleTodayCandidate={() => props.onToggleTodayCandidate(task.id)}
                          onRename={() => renameTask(task)}
                          onAddSubtask={() => addSubtask(task)}
                          onSetDate={() => setTaskDate(task)}
                          onMoveProject={() => moveTaskProject(task)}
                          onDelete={() => props.onTaskDelete(task.id)}
                          onToggleComplete={() => props.onTaskUpdate(task.id, workflowStatusForPatch(normalizeWorkflowStatus(task) === "done" ? "backlog" : "done"))}
                          onToggleSubtask={(subtaskId) => toggleSubtask(task.id, subtaskId)}
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

      </div>
    </main>
  );
}
