function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordArray(value) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function sanitizeSubtasks(value) {
  return recordArray(value).map((subtask) => ({
    ...subtask,
    subtasks: sanitizeSubtasks(subtask.subtasks),
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

module.exports = { parsePlannerDataSource, sanitizePlannerDataCollections };
