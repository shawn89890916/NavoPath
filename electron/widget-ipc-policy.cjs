const MAX_WIDGET_ACTION_RECORD_BYTES = 16 * 1024;
const TIMER_MODES = new Set(["stopwatch", "pomodoro", "countdown"]);
const SIMPLE_ACTIONS = new Set([
  "requestSnapshot",
  "timerPause",
  "timerResume",
  "timerStop",
  "toggleWidgetTimer",
  "resetPosition",
]);
const TIMER_NUMBER_FIELDS = [
  "focusMinutes",
  "breakMinutes",
  "rounds",
  "countdownSeconds",
  "minWorkMinutes",
  "maxWorkMinutes",
  "longBreakMinutes",
  "minBreakMinutes",
  "minLongBreakMinutes",
  "longBreakEvery",
];
const TIMER_BOOLEAN_FIELDS = [
  "autoStartNextPhase",
  "allowWorkAdjustment",
  "allowBreakShortening",
];

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanRecord(value) {
  if (!isRecord(value)) return null;
  try {
    const source = JSON.stringify(value);
    if (Buffer.byteLength(source, "utf8") > MAX_WIDGET_ACTION_RECORD_BYTES) return null;
    const clean = JSON.parse(source);
    return isRecord(clean) ? clean : null;
  } catch {
    return null;
  }
}

function cleanOptionalTaskId(action) {
  if (!Object.hasOwn(action, "taskId") || action.taskId === undefined) return {};
  if (typeof action.taskId !== "string" || !action.taskId.trim() || action.taskId.length > 200) {
    return null;
  }
  return { taskId: action.taskId };
}

function cleanTimerSettings(value, options = {}) {
  if (!isRecord(value)) return null;
  if (options.forbidMode && Object.hasOwn(value, "mode")) return null;
  if (Object.hasOwn(value, "mode") && !TIMER_MODES.has(value.mode)) return null;
  for (const field of TIMER_NUMBER_FIELDS) {
    if (Object.hasOwn(value, field) && !Number.isFinite(value[field])) return null;
  }
  for (const field of TIMER_BOOLEAN_FIELDS) {
    if (Object.hasOwn(value, field) && typeof value[field] !== "boolean") return null;
  }
  if (options.requireCore) {
    if (!TIMER_MODES.has(value.mode)) return null;
    for (const field of ["focusMinutes", "breakMinutes", "rounds", "countdownSeconds"]) {
      if (!Number.isFinite(value[field])) return null;
    }
  }
  return cleanRecord(value);
}

function sanitizeWidgetAction(action) {
  if (!isRecord(action) || typeof action.type !== "string") return null;
  if (SIMPLE_ACTIONS.has(action.type)) return { type: action.type };
  if (action.type === "quickAdd") {
    if (typeof action.title !== "string") return null;
    const title = action.title.trim();
    return title && title.length <= 200 ? { type: action.type, title } : null;
  }
  if (action.type === "timerStart" || action.type === "complete") {
    const task = cleanOptionalTaskId(action);
    return task ? { type: action.type, ...task } : null;
  }
  if (action.type === "setAlwaysOnTop") {
    return typeof action.enabled === "boolean"
      ? { type: action.type, enabled: action.enabled }
      : null;
  }
  if (action.type === "updateAppearance" || action.type === "updateWidgetAppearance") {
    const patch = cleanRecord(action.patch);
    return patch ? { type: action.type, patch } : null;
  }
  if (action.type === "setTimerMode") {
    return TIMER_MODES.has(action.mode) ? { type: action.type, mode: action.mode } : null;
  }
  if (action.type === "updateTimerPreferences") {
    const patch = cleanTimerSettings(action.patch, { forbidMode: true });
    return patch ? { type: action.type, patch } : null;
  }
  if (action.type === "saveTimerSettings" || action.type === "resetWidgetTimer") {
    const draft = cleanTimerSettings(action.draft, { requireCore: true });
    return draft ? { type: action.type, draft } : null;
  }
  if (action.type === "scheduleWidgetCountdown") {
    return Number.isInteger(action.durationMinutes)
      && action.durationMinutes >= 1
      && action.durationMinutes <= 1_440
      ? { type: action.type, durationMinutes: action.durationMinutes }
      : null;
  }
  return null;
}

function createWidgetIpcPolicy({ BrowserWindow, widgetWindowService, compactWindowService }) {
  function senderWindow(event) {
    try {
      return BrowserWindow.fromWebContents(event?.sender) || null;
    } catch {
      return null;
    }
  }

  function isOwnedWindow(win) {
    return widgetWindowService.ownsWindow(win) || compactWindowService.ownsWindow(win);
  }

  function primaryWindow() {
    return BrowserWindow.getAllWindows().find((win) => !isOwnedWindow(win)) || null;
  }

  return {
    canSendAction: (event) => {
      const win = senderWindow(event);
      return Boolean(win && widgetWindowService.ownsWindow(win));
    },
    canPushSnapshot: (event) => {
      const win = senderWindow(event);
      return Boolean(win && win === primaryWindow());
    },
  };
}

module.exports = {
  MAX_WIDGET_ACTION_RECORD_BYTES,
  createWidgetIpcPolicy,
  sanitizeWidgetAction,
};
