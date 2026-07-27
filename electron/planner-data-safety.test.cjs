const test = require("node:test");
const assert = require("node:assert/strict");
const { parsePlannerDataSource, sanitizePlannerDataCollections } = require("./planner-data-safety.cjs");

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
