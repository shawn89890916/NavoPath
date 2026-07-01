import type { PlannerData, Project, Subtask, Task } from "../types";

const byOrder = <T extends { order?: number; createdAt?: string }>(a: T, b: T) =>
  (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
  String(a.createdAt || "").localeCompare(String(b.createdAt || ""));

export function normalizeTreeOrder(data: PlannerData): PlannerData {
  const projects = [...data.projects].sort(byOrder).map((project, index) => ({ ...project, order: index }));
  const projectOrder = new Map(projects.map((project) => [project.id, project.order || 0]));
  const tasks = [...data.tasks]
    .map((task) => ({
      ...task,
      subtasks: task.subtasks ? normalizeTreeSubtaskOrder(task.subtasks) : [],
    }))
    .sort(
      (a, b) =>
        (projectOrder.get(a.projectId || "") ?? Number.MAX_SAFE_INTEGER) -
          (projectOrder.get(b.projectId || "") ?? Number.MAX_SAFE_INTEGER) || byOrder(a, b),
    );
  const grouped = new Map<string, Task[]>();
  tasks.forEach((task) => {
    const key = task.projectId || "";
    grouped.set(key, [...(grouped.get(key) || []), task]);
  });
  return {
    ...data,
    projects,
    tasks: tasks.map((task) => ({
      ...task,
      order: (grouped.get(task.projectId || "") || []).findIndex((item) => item.id === task.id),
    })),
  };
}

export function normalizeTreeSubtaskOrder(subtasks: Subtask[]): Subtask[] {
  return [...subtasks].sort(byOrder).map((item, index) => ({
    ...item,
    order: index,
    subtasks: item.subtasks ? normalizeTreeSubtaskOrder(item.subtasks) : undefined,
  }));
}

export function reorderProjects(projects: Project[], activeId: string, targetId: string, after: boolean) {
  const next = [...projects].sort(byOrder);
  const active = next.find((item) => item.id === activeId);
  if (!active || activeId === targetId) return next;
  next.splice(next.findIndex((item) => item.id === activeId), 1);
  const targetIndex = next.findIndex((item) => item.id === targetId);
  next.splice(Math.max(0, targetIndex + (after ? 1 : 0)), 0, active);
  return next.map((item, index) => ({ ...item, order: index }));
}

export function reorderTasks(
  tasks: Task[],
  activeId: string,
  targetProjectId: string | undefined,
  targetId?: string,
  after = false,
) {
  const active = tasks.find((item) => item.id === activeId);
  if (!active) return tasks;
  const untouched = tasks.filter((item) => item.id !== activeId && item.projectId !== targetProjectId);
  const group = tasks
    .filter((item) => item.id !== activeId && item.projectId === targetProjectId)
    .sort(byOrder);
  const targetIndex = targetId ? group.findIndex((item) => item.id === targetId) : group.length;
  group.splice(targetIndex < 0 ? group.length : targetIndex + (after ? 1 : 0), 0, {
    ...active,
    projectId: targetProjectId,
  });
  return [...untouched, ...group.map((item, index) => ({ ...item, order: index }))];
}

export function reorderSubtasks(
  subtasks: Subtask[],
  activeId: string,
  targetId: string,
  after: boolean,
): Subtask[] {
  const next = [...subtasks].sort(byOrder);
  const active = next.find((item) => item.id === activeId);
  if (!active || activeId === targetId) return next;
  next.splice(next.findIndex((item) => item.id === activeId), 1);
  const targetIndex = next.findIndex((item) => item.id === targetId);
  next.splice(Math.max(0, targetIndex + (after ? 1 : 0)), 0, active);
  return next.map((item, index) => ({ ...item, order: index }));
}

export function findSubtaskInTree(subtasks: Subtask[], id: string): Subtask | undefined {
  for (const item of subtasks) {
    if (item.id === id) return item;
    if (item.subtasks?.length) {
      const found = findSubtaskInTree(item.subtasks, id);
      if (found) return found;
    }
  }
  return undefined;
}

export function removeSubtaskFromTree(subtasks: Subtask[], id: string): Subtask[] {
  return subtasks
    .filter((item) => item.id !== id)
    .map((item) => ({
      ...item,
      subtasks: item.subtasks ? removeSubtaskFromTree(item.subtasks, id) : undefined,
    }));
}

export function addSubtaskToTree(
  subtasks: Subtask[],
  newItem: Subtask,
  parentId?: string,
): Subtask[] {
  if (!parentId) return [...subtasks, newItem];
  return subtasks.map((item) => {
    if (item.id === parentId) {
      return { ...item, subtasks: [...(item.subtasks || []), newItem] };
    }
    if (item.subtasks?.length) {
      return { ...item, subtasks: addSubtaskToTree(item.subtasks, newItem, parentId) };
    }
    return item;
  });
}

export function countSubtasks(subtasks: Subtask[] | undefined): number {
  if (!subtasks?.length) return 0;
  let count = 0;
  for (const item of subtasks) {
    count += 1 + countSubtasks(item.subtasks);
  }
  return count;
}

export function countDoneSubtasks(subtasks: Subtask[] | undefined): number {
  if (!subtasks?.length) return 0;
  let count = 0;
  for (const item of subtasks) {
    if (item.completed || item.done) count += 1;
    count += countDoneSubtasks(item.subtasks);
  }
  return count;
}

export function toggleSubtaskInTree(subtasks: Subtask[], id: string): Subtask[] {
  return subtasks.map((item) => {
    if (item.id === id) {
      const nextDone = !(item.completed || item.done);
      return { ...item, completed: nextDone, done: nextDone };
    }
    return item.subtasks
      ? { ...item, subtasks: toggleSubtaskInTree(item.subtasks, id) }
      : item;
  });
}
