import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PlannerData, Project, Subtask, Task } from "./types";
import { t, type Language } from "./i18n";
import { useInAppDialog } from "./InAppDialog";
import { localIsoDate } from "./utils/localDate";
import { normalizeTreeOrder, reorderProjects, reorderSubtasks, reorderTasks, findSubtaskInTree, removeSubtaskFromTree, addSubtaskToTree, countSubtasks, countDoneSubtasks } from "./utils/treeOrder";

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
      <div draggable className={`df-plan-subtask-node ${done ? "done" : ""}${hasChildren ? " has-children" : ""}`} data-node-id={props.subtask.id} data-node-type="subtask">
        <div className="df-subtask-inner">
          <button
            className={`df-subtask-check ${done ? "done" : ""}`}
            onClick={() => props.onToggle(props.subtask.id)}
            aria-label={done ? t(props.lang, "planning.markIncomplete") : t(props.lang, "planning.markComplete")}
            style={done ? { "--project-color": props.projectColor } as React.CSSProperties : undefined}
          >
            {done && <CheckIcon size={10} />}
          </button>
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
          <div className="df-task-node-actions">
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
          </div>
        </div>
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
  onToggleSubtask: (subtaskId: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { tooltipEl, showTip, hideTip } = useTooltip();
  const titleRef = useRef<HTMLSpanElement>(null);
  const hasSubtasks = (props.task.subtasks || []).length > 0;
  const doneCount = countDoneSubtasks(props.task.subtasks);
  const totalCount = countSubtasks(props.task.subtasks);

  return (
    <>
      {tooltipEl}
      <div draggable className={`df-plan-task-node${props.addedToToday ? " added-to-today" : ""}`} data-node-id={props.task.id} data-node-type="task">
        <div className="df-task-node-inner" onClick={props.onOpen}>
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
          {hasSubtasks && <span className="df-subtask-progress">{doneCount}/{totalCount}</span>}
          {props.addedToToday && <span className="df-added-today-label">{props.lang === "zh" ? "今日候选" : "Today"}</span>}
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
          <div className="df-task-node-actions">
            <button
              className="df-tree-icon-button"
              onClick={(event) => {
                event.stopPropagation();
                props.onToggleTodayCandidate();
              }}
              aria-label={props.addedToToday
                ? (props.lang === "zh" ? "移回 Planning" : "Return to Planning")
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
          </div>
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
        </div>
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

        // ── Simplified tree lines: subtle, minimal ──
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

        // Trunk x-position (relative to tree) — 28px indent from project left
        const trunkX = 28;
        const projBottom = projectRect.bottom - treeRect.top;

        const firstCenterY = Math.min(...taskPositions.map((t) => t.centerY));
        const lastCenterY = Math.max(...taskPositions.map((t) => t.centerY));

        const colMain = alphaColor(projectColor, 0.08);
        const colBranch = alphaColor(projectColor, 0.05);

        // 1. Trunk: short vertical from project bottom → first task
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
  onTaskEdit: (task: Task) => void;
  onTaskUpdate: (taskId: string, patch: Partial<Task>) => void;
  onTaskCreate: (projectId: string) => void;
  onTaskDelete: (taskId: string) => void;
  onDeleteSubtask: (subtaskId: string) => void;
  onDataChange: (data: PlannerData) => void;
}) {
  const safeProjects = Array.isArray(props.projects) ? props.projects : [];
  const safeTasks = Array.isArray(props.tasks) ? props.tasks : [];
  const [collapsedSubtasks, setCollapsedSubtasks] = useState<Record<string, boolean>>({});
  const [showAddedTasks, setShowAddedTasks] = useState(false);
  const [dragNode, setDragNode] = useState<TreeDragNode | null>(null);
  const [dropTarget, setDropTarget] = useState<TreeDropTarget | null>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const dialog = useInAppDialog(props.lang);

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
    const date = await dialog.prompt(props.lang === "zh" ? "设置日期 YYYY-MM-DD" : "Set date YYYY-MM-DD", task.dueDate || todayIso());
    if (!date?.trim()) return;
    props.onTaskUpdate(task.id, { dueDate: date.trim() });
  }, [dialog, props]);

  const moveTaskProject = useCallback(async (task: Task) => {
    const options = safeProjects.map((project, index) => `${index + 1}. ${project.title}`).join("\n");
    const choice = await dialog.prompt(
      props.lang === "zh"
        ? "移动到项目"
        : "Move to project",
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
    const confirmed = await dialog.confirm(props.lang === "zh" ? "确定删除此子任务？" : "Delete this subtask?");
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
        const date = await dialog.prompt(props.lang === "zh" ? "设置日期 YYYY-MM-DD" : "Set date YYYY-MM-DD", task.dueDate || todayIso());
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
            ? "移动父任务到项目"
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
        await dialog.alert(props.lang === "zh" ? "非空项目不能转换层级" : "A non-empty project cannot change level", { message: props.lang === "zh" ? "请先移动项目中的任务，以免丢失数据。" : "Move its tasks first to avoid losing data." });
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
          await dialog.alert(props.lang === "zh" ? "此任务不能转换为项目" : "This task cannot become a project", { message: props.lang === "zh" ? "请先移除子任务、排程或重复规则。" : "Remove subtasks, schedules, or recurrence first." });
          return;
        }
        persistTree([...projects, projectFromItem(task)], tasks.filter((item) => item.id !== task.id));
        return;
      }
      if ((target.kind === "task" || target.kind === "subtask") && target.position === "inside") {
        if (task.timelineRecords?.length || task.scheduledDate || task.recurrence) {
          await dialog.alert(props.lang === "zh" ? "已排程任务不能变为子任务" : "A scheduled task cannot become a subtask");
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
        await dialog.alert(props.lang === "zh" ? "含子项的子任务不能变为项目" : "A subtask with children cannot become a project");
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

  return (
    <main className={`df-planning${props.compact ? " compact-layout" : ""}`}>
      {dialog.host}
      <div className="df-planning-body">
        <section className="df-mindmap no-root">
          <div className="df-tree-wrap">
          <div className="df-planning-filter-bar">
            <button className={`df-filter-toggle${showAddedTasks ? " active" : ""}`} onClick={() => setShowAddedTasks((v) => !v)}>
              {showAddedTasks ? t(props.lang, "sourceModal.hideAdded") : t(props.lang, "planning.showAdded")}
            </button>
          </div>

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
                {props.lang === "zh"
                  ? dropTarget.position === "inside" ? "放入此层级" : dropTarget.position === "before" ? "放在此处之前" : "放在此处之后"
                  : dropTarget.position === "inside" ? "Place inside" : dropTarget.position === "before" ? "Place before" : "Place after"}
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
        </div>
      </section>

      </div>
    </main>
  );
}
