const MAX_PLANNER_DATA_BYTES = 20 * 1024 * 1024;
const MAX_PLANNER_SUBTASK_DEPTH = 64;

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordArray(value) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function sanitizeSubtasks(value, depth = 0) {
  if (depth >= MAX_PLANNER_SUBTASK_DEPTH) return [];
  return recordArray(value).map((subtask) => ({
    ...subtask,
    subtasks: sanitizeSubtasks(subtask.subtasks, depth + 1),
  }));
}

function sanitizePlannerDataCollections(data) {
  if (!isRecord(data) || !Array.isArray(data.tasks)) return data;
  return {
    ...data,
    projects: recordArray(data.projects),
    events: recordArray(data.events),
    habits: recordArray(data.habits),
    habitDailyStates: recordArray(data.habitDailyStates),
    tasks: recordArray(data.tasks).map((task) => ({
      ...task,
      timelineRecords: recordArray(task.timelineRecords),
      subtasks: sanitizeSubtasks(task.subtasks),
    })),
  };
}

function parsePlannerDataSource(source) {
  try {
    const data = JSON.parse(source);
    if (!isRecord(data) || !Array.isArray(data.tasks)) {
      return { ok: false, reason: "invalid-shape" };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, reason: "invalid-json" };
  }
}

function isPlannerDataFileSizeAllowed(size) {
  return Number.isSafeInteger(size) && size >= 0 && size <= MAX_PLANNER_DATA_BYTES;
}

module.exports = {
  MAX_PLANNER_DATA_BYTES,
  MAX_PLANNER_SUBTASK_DEPTH,
  isPlannerDataFileSizeAllowed,
  parsePlannerDataSource,
  sanitizePlannerDataCollections,
};
