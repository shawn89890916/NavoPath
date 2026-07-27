const fs = require("node:fs");

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

function serializePlannerDataSource(data, maxBytes = MAX_PLANNER_DATA_BYTES) {
  if (!isRecord(data) || !Array.isArray(data.tasks)) {
    throw new TypeError("Planner data must contain a top-level task collection.");
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new TypeError("Planner data byte limit must be a non-negative safe integer.");
  }
  const source = JSON.stringify(data, null, 2);
  if (Buffer.byteLength(source, "utf8") > maxBytes) {
    throw new RangeError("Planner data exceeds the maximum local file size.");
  }
  return source;
}

function writePlannerDataFile(filePath, data) {
  const source = serializePlannerDataSource(data);
  const temporaryPath = `${filePath}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, source, "utf8");
    fs.renameSync(temporaryPath, filePath);
  } catch (error) {
    try {
      fs.unlinkSync(temporaryPath);
    } catch {
      // Keep the original error; the destination file remains untouched.
    }
    throw error;
  }
}

module.exports = {
  MAX_PLANNER_DATA_BYTES,
  MAX_PLANNER_SUBTASK_DEPTH,
  isPlannerDataFileSizeAllowed,
  parsePlannerDataSource,
  sanitizePlannerDataCollections,
  serializePlannerDataSource,
  writePlannerDataFile,
};
