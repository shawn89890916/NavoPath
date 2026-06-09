import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PlannerData, Project, Subtask, Task } from "./types";

type PlanPickPriority = "must" | "should" | "could";

const DEFAULT_PROJECT_COLOR = "var(--accent-plan, #CAFF72)";
const UNASSIGNED_COLOR = "#7B8191";

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
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
  subtask: Subtask;
  projectColor: string;
  onToggle: (subtaskId: string) => void;
  onPromote: (subtaskId: string) => void;
  onRename: (subtaskId: string) => void;
  onSetDate: (subtaskId: string) => void;
  onMoveProject: (subtaskId: string) => void;
  onDelete: (subtaskId: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { tooltipEl, showTip, hideTip } = useTooltip();
  const titleRef = useRef<HTMLSpanElement>(null);
  const done = Boolean(props.subtask.completed || props.subtask.done);

  return (
    <>
      {tooltipEl}
      <div className={`df-plan-subtask-node ${done ? "done" : ""}`} data-node-id={props.subtask.id} data-node-type="subtask">
        <button
          className={`df-subtask-check ${done ? "done" : ""}`}
          onClick={() => props.onToggle(props.subtask.id)}
          aria-label={done ? "标记未完成" : "标记完成"}
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
        <div className="df-task-node-actions">
          <button
            className="df-tree-icon-button"
            onClick={(event) => {
              event.stopPropagation();
              props.onPromote(props.subtask.id);
            }}
            aria-label="移到规划"
            title="移到规划"
          >
            <ArrowRightIcon />
          </button>
          <button
            className="df-tree-icon-button"
            onClick={(event) => {
              event.stopPropagation();
              setMenuOpen((open) => !open);
            }}
            aria-label="更多"
            title="更多"
          >
            <MoreIcon />
          </button>
        </div>
        <TreeMenu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          actions={[
            { label: "编辑名称", onClick: () => props.onRename(props.subtask.id) },
            { label: "设置日期", onClick: () => props.onSetDate(props.subtask.id) },
            { label: "移动到项目", onClick: () => props.onMoveProject(props.subtask.id) },
            { label: "删除", danger: true, onClick: () => props.onDelete(props.subtask.id) },
          ]}
        />
      </div>
    </>
  );
}

function PlanningTaskNode(props: {
  task: Task;
  picked: boolean;
  projectColor: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpen: () => void;
  onAddToPick: () => void;
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
  const doneCount = (props.task.subtasks || []).filter((subtask) => subtask.completed || subtask.done).length;
  const totalCount = (props.task.subtasks || []).length;

  return (
    <>
      {tooltipEl}
      <div className={`df-plan-task-node ${props.picked ? "picked" : ""}`} data-node-id={props.task.id} data-node-type="task">
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
          {hasSubtasks && (
            <button
              className="df-task-chevron"
              onClick={(event) => {
                event.stopPropagation();
                props.onToggleCollapse();
              }}
              aria-label={props.collapsed ? "展开子任务" : "折叠子任务"}
            >
              <ChevronIcon open={!props.collapsed} />
            </button>
          )}
          <div className="df-task-node-actions">
            <button
              className="df-tree-icon-button"
              onClick={(event) => {
                event.stopPropagation();
                props.onAddToPick();
              }}
              aria-label="加入候选"
              title="加入候选"
            >
              <ArrowRightIcon />
            </button>
            <button
              className="df-tree-icon-button"
              onClick={(event) => {
                event.stopPropagation();
                setMenuOpen((open) => !open);
              }}
              aria-label="更多"
              title="更多"
            >
              <MoreIcon />
            </button>
          </div>
          <TreeMenu
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            actions={[
              { label: "编辑名称", onClick: props.onRename },
              { label: "添加子任务", onClick: props.onAddSubtask },
              { label: "设置日期", onClick: props.onSetDate },
              { label: "移动到项目", onClick: props.onMoveProject },
              { label: "删除", danger: true, onClick: props.onDelete },
            ]}
          />
        </div>
      </div>
    </>
  );
}

function PlanningProjectNode(props: {
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
          <button className="df-tree-icon-button df-project-add-btn" onClick={props.onAddTask} aria-label="添加任务" title="添加任务">
            <PlusIcon />
          </button>
          <button className="df-tree-icon-button df-collapse-btn" onClick={props.onToggleCollapse} aria-label={props.collapsed ? "展开项目" : "折叠项目"}>
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
  data: PlannerData;
  projects: Project[];
  tasks: Task[];
  collapsed: Record<string, boolean>;
  setCollapsed: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  pickMode: boolean;
  picks: Record<string, PlanPickPriority>;
  onExitPickMode: () => void;
  onAddPick: (taskId: string) => void;
  onUpdatePick: (taskId: string, priority: PlanPickPriority) => void;
  onRemovePick: (taskId: string) => void;
  onClearPicks: () => void;
  onApplyPicks: (scope: "today" | "week") => void;
  onProjectEdit: (project: Project) => void;
  onTaskEdit: (task: Task) => void;
  onTaskUpdate: (taskId: string, patch: Partial<Task>) => void;
  onTaskCreate: (projectId: string) => void;
  onTaskDelete: (taskId: string) => void;
}) {
  const safeProjects = Array.isArray(props.projects) ? props.projects : [];
  const safeTasks = Array.isArray(props.tasks) ? props.tasks : [];
  const [collapsedSubtasks, setCollapsedSubtasks] = useState<Record<string, boolean>>({});
  const [leftRatio, setLeftRatio] = useState(66);
  const treeRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const startSplitterDrag = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    isDragging.current = true;
    const startX = event.clientX;
    const startRatio = leftRatio;
    const onMove = (moveEvent: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const pct = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      setLeftRatio(Math.max(40, Math.min(80, pct)));
    };
    const onUp = () => {
      isDragging.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [leftRatio]);

  const pickedTasks = Object.keys(props.picks)
    .map((id) => safeTasks.find((task) => task?.id === id))
    .filter(Boolean) as Task[];

  const unassigned = safeTasks.filter((task) => task && !task.projectId && !task.completed);

  const priorityGroups: Array<[PlanPickPriority, string]> = [
    ["must", "必须做"],
    ["should", "应该做"],
    ["could", "有空做"],
  ];

  const projectName = useCallback(
    (task: Task) => safeProjects.find((project) => String(project.id) === String(task.projectId || ""))?.title || "未归属",
    [safeProjects],
  );

  const renameTask = useCallback((task: Task) => {
    const title = window.prompt("编辑名称", task.title);
    if (!title?.trim()) return;
    props.onTaskUpdate(task.id, { title: title.trim() });
  }, [props]);

  const addSubtask = useCallback((task: Task) => {
    const title = window.prompt("子任务名称");
    if (!title?.trim()) return;
    props.onTaskUpdate(task.id, {
      subtasks: [
        ...(task.subtasks || []),
        { id: uid("subtask"), title: title.trim(), completed: false, done: false, order: Date.now(), createdAt: new Date().toISOString() },
      ],
    });
  }, [props]);

  const setTaskDate = useCallback((task: Task) => {
    const date = window.prompt("设置日期 YYYY-MM-DD", task.dueDate || todayIso());
    if (!date?.trim()) return;
    props.onTaskUpdate(task.id, { dueDate: date.trim() });
  }, [props]);

  const moveTaskProject = useCallback((task: Task) => {
    const options = safeProjects.map((project, index) => `${index + 1}. ${project.title}`).join("\n");
    const choice = window.prompt(`移动到项目：\n0. 未归属\n${options}`, "0");
    if (choice === null) return;
    const index = Number(choice) - 1;
    props.onTaskUpdate(task.id, { projectId: index >= 0 ? safeProjects[index]?.id : undefined });
  }, [props, safeProjects]);

  const toggleSubtask = useCallback((taskId: string, subtaskId: string) => {
    const task = safeTasks.find((item) => item.id === taskId);
    if (!task) return;
    props.onTaskUpdate(taskId, {
      subtasks: (task.subtasks || []).map((subtask) =>
        subtask.id === subtaskId
          ? { ...subtask, completed: !(subtask.completed || subtask.done), done: !(subtask.completed || subtask.done) }
          : subtask,
      ),
    });
  }, [props, safeTasks]);

  const renameSubtask = useCallback((subtaskId: string) => {
    for (const task of safeTasks) {
      const subtask = (task.subtasks || []).find((s) => s.id === subtaskId);
      if (subtask) {
        const title = window.prompt("编辑子任务名称", subtask.title);
        if (!title?.trim()) return;
        props.onTaskUpdate(task.id, {
          subtasks: (task.subtasks || []).map((s) =>
            s.id === subtaskId ? { ...s, title: title.trim() } : s,
          ),
        });
        return;
      }
    }
  }, [safeTasks, props]);

  const deleteSubtask = useCallback((subtaskId: string) => {
    if (!window.confirm("确定删除此子任务？")) return;
    for (const task of safeTasks) {
      if ((task.subtasks || []).some((s) => s.id === subtaskId)) {
        props.onTaskUpdate(task.id, {
          subtasks: (task.subtasks || []).filter((s) => s.id !== subtaskId),
        });
        return;
      }
    }
  }, [safeTasks, props]);

  const promoteSubtask = useCallback((subtaskId: string) => {
    props.onAddPick(subtaskId);
  }, [props]);

  const setSubtaskDate = useCallback((subtaskId: string) => {
    for (const task of safeTasks) {
      const subtask = (task.subtasks || []).find((s) => s.id === subtaskId);
      if (subtask) {
        const date = window.prompt("设置日期 YYYY-MM-DD", task.dueDate || todayIso());
        if (!date?.trim()) return;
        props.onTaskUpdate(task.id, {
          subtasks: (task.subtasks || []).map((s) =>
            s.id === subtaskId ? { ...s, title: `${s.title} 📅${date.trim()}` } : s,
          ),
        });
        return;
      }
    }
  }, [safeTasks, props]);

  const moveSubtaskProject = useCallback((subtaskId: string) => {
    for (const task of safeTasks) {
      if ((task.subtasks || []).some((s) => s.id === subtaskId)) {
        const options = safeProjects.map((p, i) => `${i + 1}. ${p.title}`).join("\n");
        const choice = window.prompt(`移动父任务到项目：\n0. 未归属\n${options}`, "0");
        if (choice === null) return;
        const index = Number(choice) - 1;
        props.onTaskUpdate(task.id, { projectId: index >= 0 ? safeProjects[index]?.id : undefined });
        return;
      }
    }
  }, [safeTasks, safeProjects, props]);

  const visibleProjects = useMemo(
    () => safeProjects.map((project) => ({
      project,
      tasks: safeTasks.filter((task) => String(task.projectId || "") === String(project.id) && !task.completed),
    })),
    [safeProjects, safeTasks],
  );

  const svgLines = useTreeLines(treeRef, safeProjects, safeTasks, props.collapsed, collapsedSubtasks);

  return (
    <main className={`df-planning ${props.pickMode ? "pick-mode" : ""}`}>
      <div className="df-planning-body" ref={containerRef}>
        <section className="df-mindmap no-root" style={{ flex: `${leftRatio}%`, minWidth: 0 }}>
          <div className="df-tree-wrap">
          {props.pickMode && (
            <div className="df-pick-banner">
              <div>
                <strong>正在从规划中选择任务</strong>
                <span>点击任务旁的 → 加入候选框，确认后加入执行列表。</span>
              </div>
              <button onClick={props.onExitPickMode}>退出</button>
            </div>
          )}

          <div className="df-tree" ref={treeRef}>
            {svgLines}
            {visibleProjects.map(({ project, tasks }) => (
              <div className="df-category-branch" key={project.id} data-project-id={project.id}>
                <PlanningProjectNode
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
                          task={task}
                          picked={Boolean(props.picks[task.id])}
                          projectColor={project.color || DEFAULT_PROJECT_COLOR}
                          collapsed={Boolean(collapsedSubtasks[task.id])}
                          onToggleCollapse={() => setCollapsedSubtasks((current) => ({ ...current, [task.id]: !current[task.id] }))}
                          onOpen={() => props.onTaskEdit(task)}
                          onAddToPick={() => props.onAddPick(task.id)}
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
                                key={subtask.id}
                                subtask={subtask}
                                projectColor={project.color || DEFAULT_PROJECT_COLOR}
                                onToggle={(subtaskId) => toggleSubtask(task.id, subtaskId)}
                                onPromote={promoteSubtask}
                                onRename={renameSubtask}
                                onSetDate={setSubtaskDate}
                                onMoveProject={moveSubtaskProject}
                                onDelete={deleteSubtask}
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
                  project={createProjectShell("未归属任务")}
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
                          task={task}
                          picked={Boolean(props.picks[task.id])}
                          projectColor={UNASSIGNED_COLOR}
                          collapsed={Boolean(collapsedSubtasks[task.id])}
                          onToggleCollapse={() => setCollapsedSubtasks((current) => ({ ...current, [task.id]: !current[task.id] }))}
                          onOpen={() => props.onTaskEdit(task)}
                          onAddToPick={() => props.onAddPick(task.id)}
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
                                key={subtask.id}
                                subtask={subtask}
                                projectColor={UNASSIGNED_COLOR}
                                onToggle={(subtaskId) => toggleSubtask(task.id, subtaskId)}
                                onPromote={promoteSubtask}
                                onRename={renameSubtask}
                                onSetDate={setSubtaskDate}
                                onMoveProject={moveSubtaskProject}
                                onDelete={deleteSubtask}
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

      <div className="df-splitter" onMouseDown={startSplitterDrag} />

      <section className="df-pick-panel" style={{ flex: `${100 - leftRatio}%`, minWidth: 0 }}>
          <div className="df-pick-panel-head">
            <strong>候选任务</strong>
            <span>{pickedTasks.length} 项</span>
          </div>

          {pickedTasks.length === 0 ? (
            <div className="df-pick-empty">从左侧选择几个今天想做的任务</div>
          ) : (
            priorityGroups.map(([priority, label]) => {
              const groupTasks = pickedTasks.filter((task) => props.picks[task.id] === priority);
              return (
                <div className="df-pick-group" key={priority}>
                  <h3>{label}</h3>
                  {groupTasks.length === 0 ? (
                    <small>暂无</small>
                  ) : (
                    groupTasks.map((task) => (
                      <article key={task.id} className="df-pick-card">
                        <div>
                          <strong>{task.title}</strong>
                          <span># {projectName(task)}</span>
                        </div>
                        <select value={props.picks[task.id]} onChange={(event) => props.onUpdatePick(task.id, event.target.value as PlanPickPriority)}>
                          <option value="must">必须做</option>
                          <option value="should">应该做</option>
                          <option value="could">有空做</option>
                        </select>
                        <button onClick={() => props.onRemovePick(task.id)}>移除</button>
                      </article>
                    ))
                  )}
                </div>
              );
            })
          )}

          <div className="df-pick-actions">
            <button className="primary" disabled={pickedTasks.length === 0} onClick={() => props.onApplyPicks("today")}>加入今日执行</button>
            <button disabled={pickedTasks.length === 0} onClick={() => props.onApplyPicks("week")}>加入本周计划</button>
            <button className="light" disabled={pickedTasks.length === 0} onClick={props.onClearPicks}>清空候选</button>
          </div>
        </section>
      </div>
    </main>
  );
}
