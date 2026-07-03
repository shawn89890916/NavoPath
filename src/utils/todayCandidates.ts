import type { PlannerData, Subtask, Task } from "../types";

export type TodayCandidateResult = {
  data: PlannerData;
  action: "added" | "removed" | "existing" | "returned";
  taskId: string;
};

function findSubtask(subtasks: Subtask[] | undefined, id: string): Subtask | undefined {
  for (const subtask of subtasks || []) {
    if (subtask.id === id) return subtask;
    const nested = findSubtask(subtask.subtasks, id);
    if (nested) return nested;
  }
  return undefined;
}

function clearScheduling(task: Task): Task {
  return {
    ...task,
    scheduledDate: undefined,
    scheduledStart: undefined,
    scheduledEnd: undefined,
    executionStatus: undefined,
    timelineRecords: [],
  };
}

export function toggleTodayCandidate(
  data: PlannerData,
  taskId: string,
  today: string,
  now = new Date().toISOString(),
): TodayCandidateResult {
  const task = data.tasks.find((item) => item.id === taskId);
  if (!task) return { data, action: "existing", taskId };
  const removing = task.plannedForDate === today && task.executionLane === "candidate";
  return {
    data: {
      ...data,
      tasks: data.tasks.map((item) => {
        if (item.id !== taskId) return item;
        const cleared = clearScheduling(item);
        return removing
          ? { ...cleared, plannedForDate: undefined, executionLane: undefined, updatedAt: now }
          : { ...cleared, plannedForDate: today, executionLane: "candidate", updatedAt: now };
      }),
    },
    action: removing ? "removed" : "added",
    taskId,
  };
}

export function promoteSubtaskToToday(
  data: PlannerData,
  parentTaskId: string,
  subtaskId: string,
  today: string,
  createId: () => string,
  now = new Date().toISOString(),
): TodayCandidateResult {
  const parent = data.tasks.find((task) => task.id === parentTaskId);
  const subtask = findSubtask(parent?.subtasks, subtaskId);
  if (!parent || !subtask) return { data, action: "existing", taskId: subtaskId };
  const existing = data.tasks.find((task) =>
    task.parentTaskId === parentTaskId
    && task.title === subtask.title
    && task.plannedForDate === today
    && !task.completed
  );
  if (existing) return { data, action: "existing", taskId: existing.id };

  const promoted: Task = {
    ...clearScheduling(parent),
    id: createId(),
    title: subtask.title,
    parentTaskId,
    plannedForDate: today,
    executionLane: "candidate",
    recurrence: undefined,
    subtasks: [],
    completed: false,
    order: Date.now(),
    createdAt: now,
    updatedAt: now,
  };
  return {
    data: { ...data, tasks: [...data.tasks, promoted] },
    action: "added",
    taskId: promoted.id,
  };
}

export function returnScheduledTaskToToday(
  data: PlannerData,
  taskOrRecordId: string,
  today: string,
  now = new Date().toISOString(),
): TodayCandidateResult {
  const owner = data.tasks.find((task) =>
    task.id === taskOrRecordId || (task.timelineRecords || []).some((record) => record.id === taskOrRecordId)
  );
  if (!owner) return { data, action: "existing", taskId: taskOrRecordId };

  return {
    data: {
      ...data,
      tasks: data.tasks.map((task) => {
        if (task.id !== owner.id) return task;
        const isRecordReturn = (task.timelineRecords || []).some((record) => record.id === taskOrRecordId);
        const remainingRecords = isRecordReturn
          ? (task.timelineRecords || []).filter((record) => record.id !== taskOrRecordId)
          : [];
        return {
          ...task,
          scheduledDate: undefined,
          scheduledStart: undefined,
          scheduledEnd: undefined,
          executionStatus: undefined,
          timelineRecords: remainingRecords,
          plannedForDate: today,
          executionLane: "candidate",
          updatedAt: now,
        };
      }),
    },
    action: "returned",
    taskId: owner.id,
  };
}
