import { describe, expect, it } from "vitest";
import {
  createResilientStorage,
  fallbackData,
  normalizeData,
  parseLocalPreviewData,
  parseLocalPreviewSettings,
  shouldUseLocalPreviewByDefault,
} from "./browserFallback";

describe("browser fallback preview mode", () => {
  it("keeps session writes usable when browser storage is unavailable", () => {
    const storage = createResilientStorage({
      getItem: () => "stale",
      setItem: () => {
        throw new Error("Quota exceeded");
      },
      removeItem: () => {
        throw new Error("Storage blocked");
      },
    });

    expect(storage.getItem("planner")).toBe("stale");
    storage.setItem("planner", "latest");
    expect(storage.getItem("planner")).toBe("latest");
    storage.removeItem("planner");
    expect(storage.getItem("planner")).toBeNull();
  });

  it("defaults localhost dev app routes to local preview unless cloud mode is explicit", () => {
    expect(shouldUseLocalPreviewByDefault("127.0.0.1", "/app", null)).toBe(true);
    expect(shouldUseLocalPreviewByDefault("localhost", "/app", null)).toBe(true);
    expect(shouldUseLocalPreviewByDefault("127.0.0.1", "/app", "cloud")).toBe(false);
    expect(shouldUseLocalPreviewByDefault("navopath.app", "/app", null)).toBe(false);
  });

  it("uses canonical migrations while preserving local preview defaults", () => {
    const settings = parseLocalPreviewSettings(JSON.stringify({
      language: "zh",
      model: "deepseek-chat",
      executeAccentColor: "#C69CF9",
      _apiKey: "1234567890",
    }));

    expect(settings.displayName).toBe("NavoPath Preview");
    expect(settings.panelWidths).toEqual({ left: 310, right: 360 });
    expect(settings.language).toBe("zh");
    expect(settings.model).toBe("deepseek-ai/DeepSeek-V4-Flash");
    expect(settings.executeAccentColor).toBe("");
    expect(settings.hasApiKey).toBe(false);
    expect(settings.apiKeyPreview).toBe("");
    expect(settings).not.toHaveProperty("_apiKey");
  });

  it("recovers from a corrupt local settings snapshot", () => {
    const settings = parseLocalPreviewSettings("{broken");

    expect(settings.displayName).toBe("NavoPath Preview");
    expect(settings.activeMode).toBe("execute");
    expect(settings.widgetTimerPreferences?.mode).toBe("stopwatch");
  });

  it("scrubs legacy local API key fields", () => {
    const settings = parseLocalPreviewSettings(JSON.stringify({
      _apiKey: "legacy-secret",
      apiKey: "duplicate-secret",
      clearApiKey: true,
      hasApiKey: true,
      apiKeyPreview: "legacy...cret",
    }));

    expect(settings).not.toHaveProperty("_apiKey");
    expect(settings).not.toHaveProperty("apiKey");
    expect(settings).not.toHaveProperty("clearApiKey");
    expect(settings.hasApiKey).toBe(false);
    expect(settings.apiKeyPreview).toBe("");
  });

  it("rejects corrupt planner snapshots and migrates valid legacy snapshots", () => {
    expect(parseLocalPreviewData("{broken")).toBeNull();
    expect(parseLocalPreviewData(JSON.stringify({ projects: [] }))).toBeNull();

    const legacy = fallbackData();
    delete (legacy as Partial<typeof legacy>).aiMemories;
    const parsed = parseLocalPreviewData(JSON.stringify(legacy));

    expect(parsed).not.toBeNull();
    expect(parsed?.tasks.length).toBeGreaterThan(0);
    expect(parsed?.aiMemories).toEqual([]);
  });

  it("drops malformed collection entries without discarding valid planner data", () => {
    const malformed = fallbackData() as any;
    const validTaskCount = malformed.tasks.length;
    const damagedTaskId = malformed.tasks[0].id;
    malformed.projects.push(null, "bad", {});
    malformed.tasks.push(null, 42, { id: "missing-title" });
    malformed.events = [null];
    malformed.notes.push(null);
    malformed.chat = [null, { role: "user", content: "Keep me" }];
    malformed.aiConversations = [{ id: "conversation", title: "Valid", messages: [null] }];
    malformed.aiMemories = [{ id: "memory", content: "Valid", tags: [null, "keep"], sourceMessages: [null] }];
    malformed.scheduleTemplates = [{ id: "template", title: "Valid", slots: [null] }];
    malformed.tasks[0].subtasks = [null, { id: "subtask", title: "Keep", subtasks: [null] }];
    malformed.tasks[0].timelineRecords = [null];

    const normalized = normalizeData(malformed);
    const damagedTask = normalized.tasks.find((task) => task.id === damagedTaskId);

    expect(normalized.tasks).toHaveLength(validTaskCount);
    expect(normalized.projects.every((project) => Boolean(project.id && project.title))).toBe(true);
    expect(normalized.notes).not.toContain(null);
    expect(normalized.chat).toHaveLength(1);
    expect(normalized.aiConversations?.[0].messages).toEqual([]);
    expect(normalized.aiMemories[0].tags).toEqual(["keep"]);
    expect(normalized.scheduleTemplates?.[0].slots).toEqual([]);
    expect(damagedTask?.subtasks).toHaveLength(1);
    expect(damagedTask?.subtasks?.[0].subtasks).toEqual([]);
    expect(damagedTask?.timelineRecords).toEqual([]);
  });

  it("keeps the first persisted item when collection or subtask IDs repeat", () => {
    const malformed = fallbackData() as any;
    const originalTask = malformed.tasks[0];
    originalTask.subtasks = [
      { id: "duplicate-subtask", title: "Keep", completed: false },
      { id: "duplicate-subtask", title: "Drop", completed: false },
    ];
    malformed.tasks.unshift({ id: originalTask.id, title: 42 });
    malformed.tasks.push({ ...originalTask, title: "Duplicate task" });

    const normalized = normalizeData(malformed);
    const matchingTasks = normalized.tasks.filter((task) => task.id === originalTask.id);

    expect(matchingTasks).toHaveLength(1);
    expect(matchingTasks[0].title).toBe(originalTask.title);
    expect(matchingTasks[0].subtasks).toHaveLength(1);
    expect(matchingTasks[0].subtasks?.[0].title).toBe("Keep");
  });

  it("bounds excessively deep persisted subtask trees", () => {
    const malformed = fallbackData() as any;
    let nested = { id: "subtask-99", title: "Level 99", completed: false };
    for (let depth = 98; depth >= 0; depth -= 1) {
      nested = { id: `subtask-${depth}`, title: `Level ${depth}`, completed: false, subtasks: [nested] } as any;
    }
    malformed.tasks[0].subtasks = [nested];

    const normalized = normalizeData(malformed);
    let actualDepth = 0;
    let current = normalized.tasks[0].subtasks?.[0];
    while (current) {
      actualDepth += 1;
      current = current.subtasks?.[0];
    }

    expect(actualDepth).toBe(64);
  });

  it("bounds persisted task, project, and subtask identity and text fields", () => {
    const malformed = fallbackData() as any;
    const taskId = malformed.tasks[0].id;
    const projectId = malformed.projects[0].id;
    malformed.tasks[0].title = "T".repeat(10_001);
    malformed.tasks[0].notes = "N".repeat(60_001);
    malformed.tasks[0].projectId = "p".repeat(201);
    malformed.tasks[0].subtasks = [{
      id: "s".repeat(201),
      title: "S".repeat(10_001),
      completed: false,
      plannedTaskId: "p".repeat(201),
    }];
    malformed.tasks.push({ ...malformed.tasks[0], id: "i".repeat(201), title: "Drop oversized ID" });
    malformed.projects[0].title = "P".repeat(10_001);
    malformed.projects[0].notes = "D".repeat(60_001);

    const normalized = normalizeData(malformed);
    const boundedTask = normalized.tasks.find((task) => task.id === taskId);
    const boundedProject = normalized.projects.find((project) => project.id === projectId);

    expect(normalized.tasks.some((task) => task.id.length > 200)).toBe(false);
    expect(boundedTask?.title).toHaveLength(10_000);
    expect(boundedTask?.notes).toHaveLength(60_000);
    expect(boundedTask?.projectId).toBeUndefined();
    expect(boundedTask?.subtasks?.[0].id.length).toBeLessThanOrEqual(200);
    expect(boundedTask?.subtasks?.[0].title).toHaveLength(10_000);
    expect(boundedTask?.subtasks?.[0].plannedTaskId).toBeUndefined();
    expect(boundedProject?.title).toHaveLength(10_000);
    expect(boundedProject?.notes).toHaveLength(60_000);
  });

  it("normalizes persisted task planning fields and references", () => {
    const malformed = fallbackData() as any;
    const first = malformed.tasks[0];
    const second = malformed.tasks[1];
    const projectId = malformed.projects[0].id;
    const goalId = malformed.goals[0].id;
    first.category = "unknown";
    first.dueDate = "2026-99-99";
    first.estimatedHours = Number.POSITIVE_INFINITY;
    first.projectId = "missing-project";
    first.goalId = "missing-goal";
    first.parentTaskId = "missing-parent";
    first.plannedForDate = "tomorrow";
    first.executionLane = "unknown";
    first.completed = "false";
    first.completedAt = "not-a-timestamp";
    first.createdAt = 123;
    first.updatedAt = null;
    first.scheduledDate = "2026-07-28";
    first.scheduledStart = "25:00";
    first.scheduledEnd = "10:00";
    first.executionStatus = "scheduled";
    first.subtasks = [{
      id: "subtask-with-missing-plan",
      title: "Dangling plan",
      completed: false,
      plannedTaskId: "missing-task",
    }];
    second.category = "exam";
    second.dueDate = "2026-07-29";
    second.estimatedHours = 1_000_000;
    second.projectId = projectId;
    second.goalId = goalId;
    second.parentTaskId = first.id;
    second.plannedForDate = "2026-07-28";
    second.executionLane = "queued";
    second.scheduledDate = "2026-07-28";
    second.scheduledStart = "09:00";
    second.scheduledEnd = "10:00";
    second.executionStatus = "invalid";

    const normalized = normalizeData(malformed);
    const normalizedFirst = normalized.tasks.find((task) => task.id === first.id);
    const normalizedSecond = normalized.tasks.find((task) => task.id === second.id);

    expect(normalizedFirst).toMatchObject({
      category: "personal",
      dueDate: "",
      completed: false,
    });
    expect(normalizedFirst?.estimatedHours).toBeUndefined();
    expect(normalizedFirst?.projectId).toBeUndefined();
    expect(normalizedFirst?.goalId).toBe("");
    expect(normalizedFirst?.parentTaskId).toBeUndefined();
    expect(normalizedFirst?.plannedForDate).toBeUndefined();
    expect(normalizedFirst?.executionLane).toBeUndefined();
    expect(normalizedFirst?.completedAt).toBeUndefined();
    expect(normalizedFirst?.scheduledDate).toBeUndefined();
    expect(normalizedFirst?.scheduledStart).toBeUndefined();
    expect(normalizedFirst?.scheduledEnd).toBeUndefined();
    expect(normalizedFirst?.executionStatus).toBeUndefined();
    expect(normalizedFirst?.subtasks?.[0].plannedTaskId).toBeUndefined();
    expect(Number.isFinite(Date.parse(normalizedFirst?.createdAt || ""))).toBe(true);
    expect(normalizedFirst?.updatedAt).toBe(normalizedFirst?.createdAt);
    expect(normalizedSecond).toMatchObject({
      category: "exam",
      dueDate: "2026-07-29",
      estimatedHours: 24,
      projectId,
      goalId,
      parentTaskId: first.id,
      plannedForDate: "2026-07-28",
      executionLane: "queued",
      scheduledDate: "2026-07-28",
      scheduledStart: "09:00",
      scheduledEnd: "10:00",
      executionStatus: "scheduled",
    });
  });

  it("bounds persisted notes, AI conversations, messages, memories, and tags", () => {
    const malformed = fallbackData() as any;
    const tags = [
      " keep ",
      "keep",
      "x".repeat(201),
      ...Array.from({ length: 150 }, (_, index) => `tag-${index}`),
    ];
    malformed.notes = [{
      id: "n".repeat(201),
      content: "N".repeat(60_001),
      tags,
      createdAt: "2026-07-28T00:00:00.000Z",
    }];
    malformed.chat = [{
      id: "c".repeat(201),
      role: "user",
      content: "C".repeat(60_001),
      createdAt: "2026-07-28T00:00:00.000Z",
    }];
    malformed.aiConversations = [{
      id: "a".repeat(201),
      title: "A".repeat(10_001),
      messages: [{
        id: "m".repeat(201),
        role: "assistant",
        content: "M".repeat(60_001),
        createdAt: "2026-07-28T00:00:00.000Z",
      }],
      createdAt: "2026-07-28T00:00:00.000Z",
      updatedAt: "2026-07-28T00:00:00.000Z",
    }];
    malformed.activeAiConversationId = "missing-conversation";
    malformed.aiMemories = [{
      id: "r".repeat(201),
      content: "R".repeat(60_001),
      tags,
      sourceMessages: [{
        id: "s".repeat(201),
        role: "user",
        content: "S".repeat(60_001),
        createdAt: "2026-07-28T00:00:00.000Z",
      }],
      createdAt: "2026-07-28T00:00:00.000Z",
      updatedAt: "2026-07-28T00:00:00.000Z",
    }];

    const normalized = normalizeData(malformed);
    const normalizedTags = normalized.notes[0].tags;

    expect(normalized.notes[0].id.length).toBeLessThanOrEqual(200);
    expect(normalized.notes[0].content).toHaveLength(60_000);
    expect(normalized.chat[0].id?.length).toBeLessThanOrEqual(200);
    expect(normalized.chat[0].content).toHaveLength(60_000);
    expect(normalized.aiConversations?.[0].id.length).toBeLessThanOrEqual(200);
    expect(normalized.aiConversations?.[0].title).toHaveLength(10_000);
    expect(normalized.aiConversations?.[0].messages[0].content).toHaveLength(60_000);
    expect(normalized.activeAiConversationId).toBe(normalized.aiConversations?.[0].id);
    expect(normalized.aiMemories[0].id.length).toBeLessThanOrEqual(200);
    expect(normalized.aiMemories[0].content).toHaveLength(60_000);
    expect(normalized.aiMemories[0].sourceMessages?.[0].content).toHaveLength(60_000);
    expect(normalized.aiMemories[0].sourceMessages?.[0].saved).toBe(true);
    expect(normalizedTags).toHaveLength(100);
    expect(normalizedTags[0]).toBe("keep");
    expect(new Set(normalizedTags).size).toBe(normalizedTags.length);
    expect(normalizedTags.every((tag: string) => tag.length <= 200)).toBe(true);
    expect(normalized.aiMemories[0].tags).toEqual(normalizedTags);
  });

  it("bounds AI memories, personalization profiles, and task inference", () => {
    const malformed = fallbackData() as any;
    const projectId = malformed.projects[0].id;
    malformed.aiMemories = Array.from({ length: 5_001 }, (_, index) => ({
      id: `memory-${index}`,
      content: `Memory ${index}`,
      tags: [],
      source: index === 5_000 ? "unknown" : "auto",
      createdAt: "2026-07-28T00:00:00.000Z",
      updatedAt: "2026-07-28T00:00:00.000Z",
    }));
    malformed.aiProfile = {
      version: 99,
      updatedAt: 123,
      historySince: "not-a-timestamp",
      durationByProject: {
        [projectId]: { minutes: 1_000_000, sampleCount: 1_000_000_000 },
        "missing-project": { minutes: 90, sampleCount: 2 },
      },
      projectTokenWeights: {
        [projectId]: Object.fromEntries(
          Array.from({ length: 1_001 }, (_, index) => [`token-${index}`, 1_000_000_000]),
        ),
        "missing-project": { ignored: 5 },
      },
      preferredStartHourByProject: {
        [projectId]: 99,
        "missing-project": 10,
      },
      feedback: {
        durationCorrections: -5,
        projectCorrections: 1_000_000_000,
        assignmentUndos: "invalid",
        scheduleAccepts: Number.NaN,
        scheduleRejects: 10,
      },
    };
    malformed.tasks[0].aiInference = {
      duration: {
        minutes: 1_000_000,
        confidence: 5,
        source: "unknown",
        inferredAt: 123,
        modelVersion: "m".repeat(201),
        userOverridden: 1,
      },
      project: {
        projectId: "missing-project",
        confidence: -5,
        source: "unknown",
        inferredAt: "2026-07-28T00:00:00.000Z",
        modelVersion: "unknown-model",
      },
    };

    const normalized = normalizeData(malformed);
    const inference = normalized.tasks[0].aiInference;

    expect(normalized.aiMemories).toHaveLength(5_000);
    expect(normalized.aiMemories.some((memory) => memory.id === "memory-0")).toBe(false);
    expect(normalized.aiMemories.at(-1)?.id).toBe("memory-5000");
    expect(normalized.aiMemories.at(-1)?.source).toBe("auto");
    expect(normalized.aiProfile).toMatchObject({
      version: 1,
      historySince: undefined,
      durationByProject: {
        [projectId]: { minutes: 240, sampleCount: 1_000_000 },
      },
      preferredStartHourByProject: { [projectId]: 23 },
      feedback: {
        durationCorrections: 0,
        projectCorrections: 1_000_000,
        assignmentUndos: 0,
        scheduleAccepts: 0,
        scheduleRejects: 10,
      },
    });
    expect(Object.keys(normalized.aiProfile?.durationByProject || {})).toEqual([projectId]);
    expect(Object.keys(normalized.aiProfile?.projectTokenWeights || {})).toEqual([projectId]);
    expect(Object.keys(normalized.aiProfile?.projectTokenWeights[projectId] || {})).toHaveLength(1_000);
    expect(normalized.aiProfile?.projectTokenWeights[projectId]["token-0"]).toBe(1_000_000);
    expect(inference?.duration).toMatchObject({
      minutes: 1_440,
      confidence: 1,
      source: "default",
      modelVersion: "m".repeat(200),
      userOverridden: true,
    });
    expect(inference?.duration?.inferredAt).toBe(normalized.tasks[0].updatedAt);
    expect(inference?.project).toBeUndefined();
  });

  it("bounds persisted goals, long-term tasks, drafts, and schedule templates", () => {
    const malformed = fallbackData() as any;
    malformed.goals = [{
      id: "g".repeat(201),
      title: "G".repeat(10_001),
      description: "D".repeat(60_001),
      targetDate: "2027-05-01",
      status: "active",
    }];
    malformed.longTasks = [{
      id: "l".repeat(201),
      title: "L".repeat(10_001),
      notes: "N".repeat(60_001),
      targetDate: "2027-05-01",
      completed: false,
      createdAt: "2026-07-28T00:00:00.000Z",
      updatedAt: "2026-07-28T00:00:00.000Z",
    }];
    malformed.drafts = [{
      id: "d".repeat(201),
      type: "task",
      title: "T".repeat(10_001),
      projectId: "p".repeat(201),
      estimatedHours: 1,
      dueDate: "2026-07-29",
      details: "B".repeat(60_001),
      createdAt: "2026-07-28T00:00:00.000Z",
      updatedAt: "2026-07-28T00:00:00.000Z",
    }];
    malformed.scheduleTemplates = [{
      id: "t".repeat(201),
      title: "S".repeat(10_001),
      slots: Array.from({ length: 501 }, (_, index) => ({
        id: index === 0 ? "s".repeat(201) : `slot-${index}`,
        label: "P".repeat(10_001),
        start: index === 0 ? "invalid" : "09:00",
        end: index === 0 ? "also-invalid" : "10:00",
      })),
      createdAt: "2026-07-28T00:00:00.000Z",
      updatedAt: "2026-07-28T00:00:00.000Z",
    }];

    const normalized = normalizeData(malformed);
    const template = normalized.scheduleTemplates?.[0];

    expect(normalized.goals[0].id.length).toBeLessThanOrEqual(200);
    expect(normalized.goals[0].title).toHaveLength(10_000);
    expect(normalized.goals[0].description).toHaveLength(60_000);
    expect(normalized.longTasks[0].id.length).toBeLessThanOrEqual(200);
    expect(normalized.longTasks[0].title).toHaveLength(10_000);
    expect(normalized.longTasks[0].notes).toHaveLength(60_000);
    expect(normalized.drafts[0].id.length).toBeLessThanOrEqual(200);
    expect(normalized.drafts[0].title).toHaveLength(10_000);
    expect(normalized.drafts[0].details).toHaveLength(60_000);
    expect(normalized.drafts[0].projectId).toBe("");
    expect(template?.id.length).toBeLessThanOrEqual(200);
    expect(template?.title).toHaveLength(10_000);
    expect(template?.slots).toHaveLength(500);
    expect(template?.slots[0].id.length).toBeLessThanOrEqual(200);
    expect(template?.slots[0].label).toHaveLength(10_000);
    expect(template?.slots[0].start).toBe("09:00");
    expect(template?.slots[0].end).toBe("10:00");
  });

  it("normalizes persisted projects, goals, and long-term planning records", () => {
    const malformed = fallbackData() as any;
    const project = malformed.projects[0];
    const goal = malformed.goals[0];
    project.category = "unknown";
    project.completed = "false";
    project.color = "not-a-color".repeat(20);
    project.createdAt = 123;
    project.updatedAt = null;
    goal.targetDate = "2027-99-99";
    goal.status = "unknown";
    malformed.longTasks = [{
      id: "long-invalid",
      title: "Long-range plan",
      notes: "",
      targetDate: "tomorrow",
      completed: "false",
      createdAt: 123,
      updatedAt: null,
    }];

    const normalized = normalizeData(malformed);
    const normalizedProject = normalized.projects.find((item) => item.id === project.id);
    const normalizedGoal = normalized.goals.find((item) => item.id === goal.id);
    const normalizedLongTask = normalized.longTasks[0];

    expect(normalizedProject).toMatchObject({
      category: "personal",
      completed: false,
      color: "#584D3D",
    });
    expect(Number.isFinite(Date.parse(normalizedProject?.createdAt || ""))).toBe(true);
    expect(normalizedProject?.updatedAt).toBe(normalizedProject?.createdAt);
    expect(normalizedGoal).toMatchObject({ targetDate: "", status: "active" });
    expect(normalizedLongTask).toMatchObject({
      targetDate: "",
      completed: false,
    });
    expect(Number.isFinite(Date.parse(normalizedLongTask.createdAt))).toBe(true);
    expect(normalizedLongTask.updatedAt).toBe(normalizedLongTask.createdAt);
  });

  it("bounds restored habits, daily states, and time entries", () => {
    const malformed = fallbackData() as any;
    const taskId = malformed.tasks[0].id;
    malformed.habits = [{
      id: "habit-valid",
      title: "H".repeat(10_001),
      notes: "N".repeat(60_001),
      defaultDurationMinutes: 1_000_000,
      frequencyRule: "invalid",
      weeklyTarget: 1_000_000,
      targetCount: 1_000_000,
      activeWeekdays: [-1, 1, 1, 3, 7, 2.5],
      reminder: { enabled: true, time: "invalid" },
      createdAt: "2026-07-28T00:00:00.000Z",
      updatedAt: "2026-07-28T00:00:00.000Z",
    }];
    malformed.habitDailyStates = [
      {
        id: "state-valid",
        habitId: "habit-valid",
        date: "2026-07-28",
        completed: 1,
        timelineRecordId: "r".repeat(201),
        createdAt: "2026-07-28T00:00:00.000Z",
        updatedAt: "2026-07-28T00:00:00.000Z",
      },
      {
        id: "state-orphan",
        habitId: "missing-habit",
        date: "2026-07-28",
        completed: true,
      },
      {
        id: "state-invalid-date",
        habitId: "habit-valid",
        date: "2026-99-99",
        completed: true,
      },
      {
        id: "state-newer",
        habitId: "habit-valid",
        date: "2026-07-28",
        completed: false,
        createdAt: "2026-07-28T00:00:00.000Z",
        updatedAt: "2026-07-28T01:00:00.000Z",
      },
    ];
    malformed.timeEntries = [
      {
        id: "entry-valid",
        taskId,
        projectId: "p".repeat(201),
        timelineRecordId: "r".repeat(201),
        startAt: "2026-07-28T08:00:00.000Z",
        endAt: "2026-07-28T09:00:00.000Z",
        durationMinutes: 1_000_000,
        source: "invalid",
        note: "E".repeat(60_001),
      },
      {
        id: "entry-invalid-time",
        taskId,
        startAt: "invalid",
        endAt: "also-invalid",
        durationMinutes: 60,
        source: "timer",
      },
    ];

    const normalized = normalizeData(malformed);
    const habit = normalized.habits?.[0];
    const entry = normalized.timeEntries?.[0];

    expect(habit?.title).toHaveLength(10_000);
    expect(habit?.notes).toHaveLength(60_000);
    expect(habit?.defaultDurationMinutes).toBe(480);
    expect(habit?.frequencyRule).toBe("daily");
    expect(habit?.weeklyTarget).toBe(1_000);
    expect(habit?.targetCount).toBe(1_000);
    expect(habit?.activeWeekdays).toEqual([1, 3]);
    expect(habit?.reminder).toEqual({ enabled: true });
    expect(normalized.habitDailyStates).toHaveLength(1);
    expect(normalized.habitDailyStates?.[0].completed).toBe(false);
    expect(normalized.habitDailyStates?.[0].timelineRecordId).toBeUndefined();
    expect(normalized.timeEntries).toHaveLength(1);
    expect(entry?.durationMinutes).toBe(10_080);
    expect(entry?.source).toBe("timer");
    expect(entry?.projectId).toBe(normalized.tasks.find((task) => task.id === taskId)?.projectId);
    expect(entry?.timelineRecordId).toBeUndefined();
    expect(entry?.note).toHaveLength(60_000);
  });

  it("repairs time-entry references and removes orphaned entries", () => {
    const malformed = fallbackData() as any;
    const task = malformed.tasks[0];
    const projectId = task.projectId;
    task.timelineRecords = [{
      id: "timeline-valid",
      taskId: task.id,
      scheduledDate: "2026-07-28",
      scheduledStart: "08:00",
      scheduledEnd: "09:00",
      executionStatus: "completed",
      createdAt: "2026-07-28T08:00:00.000Z",
    }];
    malformed.timeEntries = [
      {
        id: "entry-repaired",
        taskId: task.id,
        projectId: "missing-project",
        timelineRecordId: "missing-record",
        startAt: "2026-07-28T08:00:00.000Z",
        endAt: "2026-07-28T09:00:00.000Z",
        durationMinutes: 60,
        source: "manual",
        createdAt: 123,
        updatedAt: null,
      },
      {
        id: "entry-linked",
        taskId: task.id,
        projectId,
        timelineRecordId: "timeline-valid",
        startAt: "2026-07-28T08:00:00.000Z",
        endAt: "2026-07-28T09:00:00.000Z",
        durationMinutes: 60,
        source: "timer",
        createdAt: "2026-07-28T09:00:00.000Z",
        updatedAt: "2026-07-28T09:00:00.000Z",
      },
      {
        id: "entry-orphan",
        taskId: "missing-task",
        startAt: "2026-07-28T08:00:00.000Z",
        endAt: "2026-07-28T09:00:00.000Z",
        durationMinutes: 60,
        source: "timer",
      },
    ];

    const normalized = normalizeData(malformed);
    const repaired = normalized.timeEntries?.find((entry) => entry.id === "entry-repaired");
    const linked = normalized.timeEntries?.find((entry) => entry.id === "entry-linked");

    expect(normalized.timeEntries).toHaveLength(2);
    expect(repaired?.projectId).toBe(projectId);
    expect(repaired?.timelineRecordId).toBeUndefined();
    expect(Number.isFinite(Date.parse(repaired?.createdAt || ""))).toBe(true);
    expect(repaired?.updatedAt).toBe(repaired?.createdAt);
    expect(linked?.timelineRecordId).toBe("timeline-valid");
  });

  it("repairs habit-state completion metadata and schedule references", () => {
    const malformed = fallbackData() as any;
    const firstHabit = malformed.habits[0];
    const secondHabit = malformed.habits[1];
    const date = "2026-07-28";
    const habitTaskId = `habit-task-${firstHabit.id}-${date}`;
    malformed.tasks.push({
      ...malformed.tasks[0],
      id: habitTaskId,
      title: firstHabit.title,
      timelineRecords: [{
        id: "habit-record-valid",
        taskId: habitTaskId,
        scheduledDate: date,
        scheduledStart: "08:00",
        scheduledEnd: "08:20",
        executionStatus: "scheduled",
        createdAt: "2026-07-28T08:00:00.000Z",
      }],
    });
    malformed.habitDailyStates = [
      {
        id: "habit-state-valid-link",
        habitId: firstHabit.id,
        date,
        completed: true,
        completedAt: "2026-07-28T08:20:00.000Z",
        timelineRecordId: "habit-record-valid",
        createdAt: "2026-07-28T08:00:00.000Z",
        updatedAt: "2026-07-28T08:20:00.000Z",
      },
      {
        id: "habit-state-wrong-link",
        habitId: secondHabit.id,
        date,
        completed: "false",
        completedAt: "not-a-timestamp",
        timelineRecordId: "habit-record-valid",
        createdAt: 123,
        updatedAt: null,
      },
    ];

    const normalized = normalizeData(malformed);
    const valid = normalized.habitDailyStates?.find((state) => state.id === "habit-state-valid-link");
    const repaired = normalized.habitDailyStates?.find((state) => state.id === "habit-state-wrong-link");

    expect(valid?.timelineRecordId).toBe("habit-record-valid");
    expect(valid?.completedAt).toBe("2026-07-28T08:20:00.000Z");
    expect(repaired?.completed).toBe(false);
    expect(repaired?.completedAt).toBeUndefined();
    expect(repaired?.timelineRecordId).toBeUndefined();
    expect(Number.isFinite(Date.parse(repaired?.createdAt || ""))).toBe(true);
    expect(repaired?.updatedAt).toBe(repaired?.createdAt);
  });

  it("caps legacy event migration before it can expand into millions of tasks", () => {
    const malformed = fallbackData() as any;
    malformed.events = [
      {
        id: "e".repeat(161),
        title: "Drop oversized event ID",
        date: "2026-01-01",
        category: "personal",
        details: "",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      ...Array.from({ length: 55 }, (_, index) => ({
        id: `legacy-event-${index}`,
        title: `Legacy event ${index}`,
        date: "2026-01-01",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        category: "personal",
        details: "",
        createdAt: "2026-01-01T00:00:00.000Z",
      })),
    ];

    const normalized = normalizeData(malformed);
    const migrated = normalized.tasks.filter((task) => (
      task.title.startsWith("Legacy event ") || task.title === "Drop oversized event ID"
    ));

    expect(migrated).toHaveLength(5_000);
    expect(migrated.some((task) => task.title === "Drop oversized event ID")).toBe(false);
    expect(migrated.every((task) => task.id.length <= 200)).toBe(true);
  });

  it("preserves a legacy event that crosses midnight", () => {
    const legacy = fallbackData();
    legacy.events = [{
      id: "legacy-overnight",
      title: "Overnight study",
      date: "2026-07-28",
      startDate: "2026-07-28",
      endDate: "2026-07-29",
      startTime: "23:30",
      endTime: "00:30",
      category: "exam",
      details: "",
      createdAt: "2026-07-28T00:00:00.000Z",
    }];

    const migrated = normalizeData(legacy).tasks.find((task) => task.title === "Overnight study");

    expect(migrated?.estimatedHours).toBe(1);
    expect(migrated?.timelineRecords?.[0]).toMatchObject({
      scheduledDate: "2026-07-28",
      scheduledStart: "23:30",
      scheduledEndDate: "2026-07-29",
      scheduledEnd: "00:30",
    });
  });

  it("uses recurrence duration instead of the recurring series end date", () => {
    const legacy = fallbackData();
    legacy.events = [{
      id: "legacy-recurring",
      title: "Daily review",
      date: "2026-07-28",
      startDate: "2026-07-28",
      endDate: "2026-12-31",
      startTime: "09:00",
      endTime: "10:00",
      category: "exam",
      details: "",
      recurrence: {
        mode: "scheduled",
        frequency: "daily",
        startDate: "2026-07-28",
        startTime: "09:00",
        durationMinutes: 60,
        endDate: "2026-12-31",
      },
      createdAt: "2026-07-28T00:00:00.000Z",
    }];

    const migrated = normalizeData(legacy).tasks.find((task) => task.title === "Daily review");

    expect(migrated?.estimatedHours).toBe(1);
  });

  it("bounds and repairs persisted timeline records", () => {
    const malformed = fallbackData() as any;
    const taskId = malformed.tasks[0].id;
    malformed.tasks.push({
      ...malformed.tasks[0],
      id: "task-invalid-timeline",
      plannedForDate: undefined,
      workflowStatus: undefined,
      timelineRecords: [{
        id: "invalid-only-record",
        taskId: "task-invalid-timeline",
        scheduledDate: "2026-07-28",
        scheduledStart: "25:00",
        scheduledEnd: "10:00",
        executionStatus: "scheduled",
      }],
    });
    malformed.tasks[0].timelineRecords = [
      ...Array.from({ length: 1_001 }, (_, index) => ({
        id: index === 0 ? "r".repeat(201) : `record-${index}`,
        taskId: "wrong-task",
        scheduledDate: "2026-07-28",
        scheduledStart: "09:00",
        scheduledEndDate: index === 0 ? "2026-07-27" : "2026-07-28",
        scheduledEnd: "10:00",
        executionStatus: index === 0 ? "invalid" : "scheduled",
        createdAt: "2026-07-28T00:00:00.000Z",
      })),
      {
        id: "invalid-date",
        taskId,
        scheduledDate: "2026-99-99",
        scheduledStart: "09:00",
        scheduledEnd: "10:00",
        executionStatus: "scheduled",
      },
      {
        id: "invalid-time",
        taskId,
        scheduledDate: "2026-07-28",
        scheduledStart: "25:00",
        scheduledEnd: "10:00",
        executionStatus: "scheduled",
      },
    ];

    const normalized = normalizeData(malformed);
    const records = normalized.tasks.find((task) => task.id === taskId)?.timelineRecords || [];

    expect(records).toHaveLength(1_000);
    expect(records[0].id.length).toBeLessThanOrEqual(200);
    expect(records[0].taskId).toBe(taskId);
    expect(records[0].scheduledEndDate).toBe("2026-07-28");
    expect(records[0].executionStatus).toBe("scheduled");
    expect(records.some((record) => record.id === "invalid-date")).toBe(false);
    expect(records.some((record) => record.id === "invalid-time")).toBe(false);
    expect(normalized.tasks.find((task) => task.id === "task-invalid-timeline")).toMatchObject({
      workflowStatus: "backlog",
      timelineRecords: [],
    });
  });

  it("infers a missing end date for a persisted cross-midnight record", () => {
    const persisted = fallbackData();
    persisted.tasks[0].timelineRecords = [{
      id: "legacy-cross-midnight",
      taskId: persisted.tasks[0].id,
      scheduledDate: "2026-07-28",
      scheduledStart: "23:30",
      scheduledEnd: "00:30",
      executionStatus: "scheduled",
      createdAt: "2026-07-28T00:00:00.000Z",
    }];

    const record = normalizeData(persisted).tasks[0].timelineRecords?.[0];

    expect(record?.scheduledEndDate).toBe("2026-07-29");
  });

  it("normalizes recurrence rules and bounded AI message metadata", () => {
    const malformed = fallbackData() as any;
    malformed.tasks[0].recurrence = {
      mode: "scheduled",
      frequency: "daily",
      startDate: "2026-07-28",
      startTime: "25:00",
      durationMinutes: 1_000_000,
      endDate: "2026-07-27",
      count: 1_000_000,
    };
    malformed.tasks[0].subtasks = [{
      id: "recurring-subtask",
      title: "Recurring subtask",
      completed: false,
    }];
    malformed.tasks.push({
      ...malformed.tasks[0],
      id: "invalid-recurrence-task",
      recurrence: {
        mode: "scheduled",
        frequency: "unexpected",
        startDate: "2026-07-28",
        startTime: "09:00",
      },
      subtasks: [],
    });
    malformed.tasks.push({
      ...malformed.tasks[0],
      id: "bounded-recurrence-task",
      recurrence: {
        mode: "scheduled",
        frequency: "weekly",
        startDate: "2026-07-28",
        startTime: "09:00",
        durationMinutes: 1_000_000,
        count: 1_000_000,
      },
      subtasks: [],
    });
    const complexMessage = {
      id: "complex-message",
      role: "assistant",
      content: "Keep",
      createdAt: "2026-07-28T00:00:00.000Z",
      status: "invalid",
      steps: Array.from({ length: 101 }, () => ({
        label: "S".repeat(10_001),
        status: "invalid",
      })),
      actions: Array.from({ length: 202 }, (_, index) => (
        index === 0
          ? { type: "import_schedule_item", kind: "task", title: "Invalid date", date: "2026-99-99" }
          : index === 1
            ? { type: "unknown-action", title: "Unknown" }
            : {
              type: "create_task",
              title: "A".repeat(10_001),
              nested: { one: { two: { three: { four: { five: { six: { seven: "too deep" } } } } } } },
            }
      )),
      selectedActions: { 0: false, 2: true, 201: false, invalid: true },
      actionState: "invalid",
      intent: "I".repeat(1_001),
      plan: Array.from({ length: 201 }, () => ({
        taskId: "t".repeat(201),
        title: "P".repeat(10_001),
        start: "09:00",
        end: "10:00",
        durationMinutes: 1_000_000,
        reason: "R".repeat(10_001),
      })),
      format: "html",
    };
    malformed.chat = [complexMessage];
    malformed.aiConversations = [{
      id: "conversation",
      title: "Conversation",
      messages: [
        ...Array.from({ length: 500 }, (_, index) => ({
          id: `simple-${index}`,
          role: "user",
          content: `Message ${index}`,
          createdAt: "2026-07-28T00:00:00.000Z",
        })),
        complexMessage,
      ],
      createdAt: "2026-07-28T00:00:00.000Z",
      updatedAt: "2026-07-28T00:00:00.000Z",
    }];

    const normalized = normalizeData(malformed);
    const recurringTask = normalized.tasks.find((task) => task.id === malformed.tasks[0].id);
    const invalidTask = normalized.tasks.find((task) => task.id === "invalid-recurrence-task");
    const boundedTask = normalized.tasks.find((task) => task.id === "bounded-recurrence-task");
    const message = normalized.aiConversations?.[0].messages.find((item) => item.id === "complex-message");

    expect(recurringTask?.recurrence).toEqual({
      mode: "flexible",
      frequency: "daily",
      startDate: "2026-07-28",
      count: 10_000,
    });
    expect(invalidTask?.recurrence).toBeUndefined();
    expect(boundedTask?.recurrence).toMatchObject({
      mode: "scheduled",
      frequency: "weekly",
      durationMinutes: 1_440,
      count: 10_000,
    });
    expect(normalized.aiConversations?.[0].messages).toHaveLength(500);
    expect(message?.status).toBe("done");
    expect(message?.steps).toHaveLength(100);
    expect(message?.steps?.[0]).toEqual({ label: "S".repeat(10_000), status: "pending" });
    expect(message?.actions).toHaveLength(200);
    expect((message?.actions?.[0] as any).title).toHaveLength(10_000);
    expect(message?.selectedActions).toEqual({ 0: true, 199: false });
    expect(message?.actionState).toBeUndefined();
    expect(message?.intent).toHaveLength(1_000);
    expect(message?.plan).toHaveLength(200);
    expect(message?.plan?.[0].taskId).toBeUndefined();
    expect(message?.plan?.[0].title).toHaveLength(10_000);
    expect(message?.plan?.[0].durationMinutes).toBe(1_440);
    expect(message?.plan?.[0].reason).toHaveLength(10_000);
    expect(message?.format).toBe("text");
  });

  it("preserves bounded global Agent confirmation and undo state in conversations", () => {
    const source = structuredClone(fallbackData()) as any;
    source.aiConversations = [{
      id: "agent-conversation",
      title: "Agent",
      createdAt: "2026-08-20T00:00:00.000Z",
      updatedAt: "2026-08-20T00:00:00.000Z",
      messages: [{
        id: "agent-message",
        role: "assistant",
        content: "Please confirm",
        createdAt: "2026-08-20T00:00:00.000Z",
        agent: {
          runId: "run-1",
          trace: [{ id: "tool-1", name: "search_workspace", status: "done" }],
          applied: [],
          pending: [{ id: "command-1", entity: "task", operation: "delete", targetId: "task-1", values: {}, reason: "Requested" }],
          decisionState: "pending",
        },
      }],
    }];
    const message = normalizeData(source).aiConversations?.[0].messages[0];
    expect(message?.agent).toMatchObject({ runId: "run-1", decisionState: "pending" });
    expect(message?.agent?.pending[0]).toMatchObject({ operation: "delete", targetId: "task-1" });
  });
});
