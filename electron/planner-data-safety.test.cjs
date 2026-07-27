const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  MAX_PLANNER_DATA_BYTES,
  MAX_PLANNER_SUBTASK_DEPTH,
  isPlannerDataFileSizeAllowed,
  parsePlannerDataSource,
  sanitizePlannerDataCollections,
  serializePlannerDataSource,
  writePlannerDataFile,
} = require("./planner-data-safety.cjs");

test("accepts desktop planner files only within the backup import byte budget", () => {
  assert.equal(isPlannerDataFileSizeAllowed(0), true);
  assert.equal(isPlannerDataFileSizeAllowed(MAX_PLANNER_DATA_BYTES), true);
  assert.equal(isPlannerDataFileSizeAllowed(MAX_PLANNER_DATA_BYTES + 1), false);
  assert.equal(isPlannerDataFileSizeAllowed(-1), false);
  assert.equal(isPlannerDataFileSizeAllowed(Number.POSITIVE_INFINITY), false);
});

test("rejects invalid or oversized planner data before serialization", () => {
  assert.throws(() => serializePlannerDataSource(null), /top-level task collection/);
  assert.throws(() => serializePlannerDataSource({ projects: [] }), /top-level task collection/);
  assert.throws(
    () => serializePlannerDataSource({ tasks: [], note: "long" }, 16),
    /maximum local file size/,
  );
  assert.deepEqual(JSON.parse(serializePlannerDataSource({ tasks: [], note: "valid" })), {
    tasks: [],
    note: "valid",
  });
});

test("atomically replaces a valid planner file and preserves it after rejected saves", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "navopath-planner-data-"));
  const filePath = path.join(directory, "planner-data.json");
  try {
    fs.writeFileSync(filePath, '{"tasks":[],"marker":"old"}', "utf8");
    writePlannerDataFile(filePath, { tasks: [], marker: "new" });
    assert.deepEqual(JSON.parse(fs.readFileSync(filePath, "utf8")), { tasks: [], marker: "new" });
    assert.equal(fs.existsSync(`${filePath}.tmp`), false);

    assert.throws(() => writePlannerDataFile(filePath, { projects: [] }), /top-level task collection/);
    assert.deepEqual(JSON.parse(fs.readFileSync(filePath, "utf8")), { tasks: [], marker: "new" });
    assert.equal(fs.existsSync(`${filePath}.tmp`), false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("accepts only planner JSON with a top-level task collection", () => {
  assert.deepEqual(parsePlannerDataSource('{"tasks":[],"projects":[]}'), {
    ok: true,
    data: { tasks: [], projects: [] },
  });
  assert.deepEqual(parsePlannerDataSource("{"), { ok: false, reason: "invalid-json" });
  assert.deepEqual(parsePlannerDataSource("null"), { ok: false, reason: "invalid-shape" });
  assert.deepEqual(parsePlannerDataSource('{"projects":[]}'), { ok: false, reason: "invalid-shape" });
});

test("filters malformed desktop planner records without discarding valid data", () => {
  const input = {
    projects: [null, "bad", { id: "project-1", title: "Valid project" }],
    events: [42, { id: "event-1", title: "Valid event" }],
    habits: [null, { id: "habit-1", title: "Valid habit" }],
    habitDailyStates: ["bad", { habitId: "habit-1", date: "2026-07-27" }],
    tasks: [
      null,
      "bad",
      {
        id: "task-1",
        title: "Valid task",
        timelineRecords: [null, { id: "record-1", scheduledDate: "2026-07-27" }],
        subtasks: [
          null,
          {
            id: "subtask-1",
            title: "Valid subtask",
            subtasks: [false, { id: "nested-1", title: "Valid nested subtask" }],
          },
        ],
      },
      {
        id: "task-2",
        title: "Task with damaged children",
        timelineRecords: "bad",
        subtasks: { id: "not-an-array" },
      },
    ],
  };

  const sanitized = sanitizePlannerDataCollections(input);

  assert.deepEqual(sanitized.projects, [{ id: "project-1", title: "Valid project" }]);
  assert.deepEqual(sanitized.events, [{ id: "event-1", title: "Valid event" }]);
  assert.deepEqual(sanitized.habits, [{ id: "habit-1", title: "Valid habit" }]);
  assert.deepEqual(sanitized.habitDailyStates, [{ habitId: "habit-1", date: "2026-07-27" }]);
  assert.deepEqual(sanitized.tasks, [
    {
      id: "task-1",
      title: "Valid task",
      timelineRecords: [{ id: "record-1", scheduledDate: "2026-07-27" }],
      subtasks: [{
        id: "subtask-1",
        title: "Valid subtask",
        subtasks: [{ id: "nested-1", title: "Valid nested subtask", subtasks: [] }],
      }],
    },
    {
      id: "task-2",
      title: "Task with damaged children",
      timelineRecords: [],
      subtasks: [],
    },
  ]);
});

test("leaves unsupported top-level data for the caller's existing fallback", () => {
  assert.equal(sanitizePlannerDataCollections(null), null);
  assert.equal(sanitizePlannerDataCollections("bad"), "bad");
  const missingTasks = { projects: [] };
  assert.equal(sanitizePlannerDataCollections(missingTasks), missingTasks);
});

test("truncates implausibly deep nested subtasks during desktop recovery", () => {
  let subtask = { id: "leaf" };
  for (let depth = 0; depth < MAX_PLANNER_SUBTASK_DEPTH + 10; depth += 1) {
    subtask = { id: `level-${depth}`, subtasks: [subtask] };
  }

  const sanitized = sanitizePlannerDataCollections({ tasks: [{ id: "task-1", subtasks: [subtask] }] });
  let current = sanitized.tasks[0].subtasks;
  let depth = 0;
  while (current.length) {
    depth += 1;
    current = current[0].subtasks;
  }

  assert.equal(depth, MAX_PLANNER_SUBTASK_DEPTH);
});
