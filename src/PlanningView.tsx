import React, { useState } from "react";
import type { PlannerData, Priority, Project, Task } from "./types";

type PlanPickPriority = "must" | "should" | "could";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
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
  onProjectTasksClick?: (projectId: string, anchorRect: DOMRect) => void;
}) {
  const safeProjects = Array.isArray(props.projects) ? props.projects : [];
  const safeTasks = Array.isArray(props.tasks) ? props.tasks : [];
  const unassigned = safeTasks.filter((task) => task && !task.projectId && !task.completed);
  const pickedTasks = Object.keys(props.picks)
    .map((id) => safeTasks.find((task) => task?.id === id))
    .filter(Boolean) as Task[];
  const priorityGroups: Array<[PlanPickPriority, string]> = [["must", "必须做"], ["should", "应该做"], ["could", "有空做"]];
  const projectName = (task: Task) => safeProjects.find((project) => project && String(project.id) === String(task.projectId || ""))?.title || "未归属";
  const addSubtask = (task: Task) => {
    const title = window.prompt("子任务名称");
    if (!title?.trim()) return;
    props.onTaskUpdate(task.id, {
      subtasks: [...(task.subtasks || []), { id: uid("subtask"), title: title.trim(), completed: false, done: false, order: Date.now(), createdAt: new Date().toISOString() }]
    });
  };
  const setTaskDate = (task: Task) => {
    const date = window.prompt("设置日期 YYYY-MM-DD", task.dueDate || todayIso());
    if (!date?.trim()) return;
    props.onTaskUpdate(task.id, { dueDate: date.trim() });
  };
  const moveTaskProject = (task: Task) => {
    const options = safeProjects.map((project, index) => `${index + 1}. ${project.title}`).join("\n");
    const choice = window.prompt(`移动到项目：\n0. 未归属\n${options}`, "0");
    if (choice === null) return;
    const index = Number(choice) - 1;
    props.onTaskUpdate(task.id, { projectId: index >= 0 ? safeProjects[index]?.id : undefined });
  };
  const renameTask = (task: Task) => {
    const title = window.prompt("编辑名称", task.title);
    if (!title?.trim()) return;
    props.onTaskUpdate(task.id, { title: title.trim() });
  };

  return (
    <main className={`df-planning ${props.pickMode ? "pick-mode" : ""}`}>
      <section className="df-mindmap no-root">
        {props.pickMode && <div className="df-pick-banner"><strong>正在从规划中选择任务</strong><span>点击任务旁的 + 加入候选框，确认后加入执行列表。</span><button onClick={props.onExitPickMode}>退出</button></div>}
        <div className="df-tree">
          {safeProjects.map((project) => {
            const projectTasks = safeTasks.filter((task) => task && String(task.projectId || "") === String(project.id) && !task.completed);
            return (
              <div className="df-category-branch" key={project.id}>
                <button className="df-collapse" onClick={() => props.setCollapsed((current) => ({ ...current, [project.id]: !current[project.id] }))}>{props.collapsed[project.id] ? "+" : "-"}</button>
                <PlanningProjectNode title={project.title} taskCount={projectTasks.length} onOpen={() => props.onProjectEdit(project)} onAddTask={() => props.onTaskCreate(project.id)} onShowTasks={props.onProjectTasksClick ? (rect) => props.onProjectTasksClick!(project.id, rect) : undefined} />
                {!props.collapsed[project.id] && <div className="df-project-list"><div className="df-task-branch">{projectTasks.map((task) => (
                  <PlanningTaskNode key={task.id} task={task} projectName={project.title} picked={Boolean(props.picks[task.id])} onOpen={() => props.onTaskEdit(task)} onAdd={() => props.onAddPick(task.id)} onRename={() => renameTask(task)} onAddSubtask={() => addSubtask(task)} onSetDate={() => setTaskDate(task)} onMoveProject={() => moveTaskProject(task)} onDelete={() => props.onTaskDelete(task.id)} />
                ))}</div></div>}
              </div>
            );
          })}
          {unassigned.length > 0 && (
            <div className="df-category-branch">
              <button className="df-collapse" onClick={() => props.setCollapsed((current) => ({ ...current, unassigned: !current.unassigned }))}>{props.collapsed.unassigned ? "+" : "-"}</button>
              <PlanningProjectNode title="未归属任务" taskCount={unassigned.length} onAddTask={() => props.onTaskCreate("")} />
              {!props.collapsed.unassigned && <div className="df-project-list"><div className="df-task-branch">{unassigned.map((task) => (
                <PlanningTaskNode key={task.id} task={task} projectName="未归属" picked={Boolean(props.picks[task.id])} onOpen={() => props.onTaskEdit(task)} onAdd={() => props.onAddPick(task.id)} onRename={() => renameTask(task)} onAddSubtask={() => addSubtask(task)} onSetDate={() => setTaskDate(task)} onMoveProject={() => moveTaskProject(task)} onDelete={() => props.onTaskDelete(task.id)} />
              ))}</div></div>}
            </div>
          )}
        </div>
      </section>
      <section className="df-pick-panel">
        <div className="df-pick-panel-head"><strong>候选任务</strong><span>{pickedTasks.length} 项</span></div>
        {pickedTasks.length === 0 ? <div className="df-pick-empty">从左侧选择几个今天想做的任务</div> : priorityGroups.map(([priority, label]) => {
          const groupTasks = pickedTasks.filter((task) => props.picks[task.id] === priority);
          return <div className="df-pick-group" key={priority}><h3>{label}</h3>{groupTasks.length === 0 ? <small>暂无</small> : groupTasks.map((task) => (
            <article key={task.id} className="df-pick-card">
              <div><strong>{task.title}</strong><span># {projectName(task)}</span></div>
              <select value={props.picks[task.id]} onChange={(event) => props.onUpdatePick(task.id, event.target.value as PlanPickPriority)}>
                <option value="must">必须做</option>
                <option value="should">应该做</option>
                <option value="could">有空做</option>
              </select>
              <button onClick={() => props.onRemovePick(task.id)}>移除</button>
            </article>
          ))}</div>;
        })}
        <div className="df-pick-actions">
          <button className="primary" disabled={pickedTasks.length === 0} onClick={() => props.onApplyPicks("today")}>加入今日执行</button>
          <button disabled={pickedTasks.length === 0} onClick={() => props.onApplyPicks("week")}>加入本周计划</button>
          <button className="light" disabled={pickedTasks.length === 0} onClick={props.onClearPicks}>清空候选</button>
        </div>
      </section>
    </main>
  );
}

function PlanningTaskNode(props: {
  task: Task;
  projectName: string;
  picked: boolean;
  onOpen: () => void;
  onAdd: () => void;
  onRename: () => void;
  onAddSubtask: () => void;
  onSetDate: () => void;
  onMoveProject: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className={`df-plan-task-node ${props.picked ? "picked" : ""}`}>
      <button className="df-task-node" onClick={props.onOpen}>
        <span className="df-task-title">{props.task.title}</span>
        {(props.task.subtasks || []).length > 0 && <small>{props.task.subtasks?.filter((sub) => sub.completed || sub.done).length}/{props.task.subtasks?.length}</small>}
        {props.picked && <em>已选</em>}
      </button>
      <div className="df-plan-node-actions">
        <button title="加入候选" onClick={props.onAdd}>→</button>
        <button title="更多" onClick={() => setMenuOpen((open) => !open)}>⋯</button>
      </div>
      {menuOpen && <div className="df-plan-more">
        <button onClick={() => { props.onRename(); setMenuOpen(false); }}>编辑名称</button>
        <button onClick={() => { props.onAddSubtask(); setMenuOpen(false); }}>添加子任务</button>
        <button onClick={() => { props.onSetDate(); setMenuOpen(false); }}>设置日期</button>
        <button onClick={() => { props.onMoveProject(); setMenuOpen(false); }}>移动到项目</button>
        <button className="danger" onClick={() => { props.onDelete(); setMenuOpen(false); }}>删除</button>
      </div>}
    </div>
  );
}

function PlanningProjectNode(props: { title: string; taskCount?: number; onOpen?: () => void; onAddTask: () => void; onShowTasks?: (anchorRect: DOMRect) => void }) {
  return (
    <div className="df-plan-project-node">
      <button className="df-category-node project-root" onClick={props.onOpen}>{props.title}</button>
      {props.onShowTasks && props.taskCount !== undefined && props.taskCount > 0 && (
        <button className="df-plan-project-tasks" title="查看项目任务" onClick={(event) => { event.stopPropagation(); const rect = event.currentTarget.getBoundingClientRect(); props.onShowTasks!(rect); }}>{props.taskCount}</button>
      )}
      <button className="df-plan-project-add" title="添加任务" onClick={props.onAddTask}>+</button>
    </div>
  );
}
