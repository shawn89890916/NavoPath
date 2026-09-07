import type { PlannerData, Task } from "../types";

export type OverdueReconciliation = {
  data: PlannerData;
  changed: boolean;
  overdueReturnedCount: number;
};

function hasManualOverdueDate(task: Task, today: string) {
  // Existing dates predate dueDateSource and are treated as user-set so no
  // deadline data is silently relaxed during the migration.
  return Boolean(task.dueDate) && task.dueDate < today && task.dueDateSource !== "automatic";
}

export function reconcileOverdueTasks(data: PlannerData, today: string, now = new Date().toISOString()): OverdueReconciliation {
  let changed = false;
  let overdueReturnedCount = 0;
  const tasks = data.tasks.map((task) => {
    if (task.completed) return task;

    let returnedPastSchedule = false;
    const timelineRecords = (task.timelineRecords || []).map((record) => {
      if (record.executionStatus === "scheduled" && record.scheduledDate < today) {
        returnedPastSchedule = true;
        changed = true;
        return { ...record, executionStatus: "returned_unfinished" as const };
      }
      return record;
    });
    const legacyPastSchedule = !task.timelineRecords?.length
      && task.executionStatus !== "returned_unfinished"
      && Boolean(task.scheduledDate && task.scheduledDate < today);
    const deadlineOverdue = hasManualOverdueDate(task, today);
    const shouldReturnToCandidates = returnedPastSchedule || legacyPastSchedule || deadlineOverdue;
    if (!shouldReturnToCandidates) return task;

    const alreadyInToday = task.plannedForDate === today && task.executionLane === "candidate";
    if (deadlineOverdue && !alreadyInToday) overdueReturnedCount += 1;
    if (!alreadyInToday || legacyPastSchedule) changed = true;
    return {
      ...task,
      ...(legacyPastSchedule ? { executionStatus: "returned_unfinished" as const } : {}),
      ...(returnedPastSchedule ? { timelineRecords } : {}),
      plannedForDate: today,
      executionLane: "candidate" as const,
      updatedAt: now,
    };
  });
  return { data: changed ? { ...data, tasks } : data, changed, overdueReturnedCount };
}
