const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  createWidgetIpcPolicy,
  sanitizeWidgetAction,
} = require("./widget-ipc-policy.cjs");

function createPolicyFixture() {
  const windows = {
    main: { id: "main" },
    compact: { id: "compact" },
    widget: { id: "widget" },
    popover: { id: "popover" },
  };
  const senders = Object.fromEntries(Object.entries(windows).map(([key, win]) => [key, { key, win }]));
  const policy = createWidgetIpcPolicy({
    BrowserWindow: {
      fromWebContents: (sender) => sender?.win || null,
    },
    widgetWindowService: {
      ownsWindow: (win) => win === windows.widget || win === windows.popover,
    },
    getPrimaryWindow: () => windows.main,
  });
  return { policy, senders };
}

test("accepts widget actions only from widget-owned renderer windows", () => {
  const { policy, senders } = createPolicyFixture();
  assert.equal(policy.canSendAction({ sender: senders.widget }), true);
  assert.equal(policy.canSendAction({ sender: senders.popover }), true);
  assert.equal(policy.canSendAction({ sender: senders.main }), false);
  assert.equal(policy.canSendAction({ sender: senders.compact }), false);
  assert.equal(policy.canSendAction({ sender: {} }), false);
});

test("accepts snapshots only from the primary application window", () => {
  const { policy, senders } = createPolicyFixture();
  assert.equal(policy.canPushSnapshot({ sender: senders.main }), true);
  assert.equal(policy.canPushSnapshot({ sender: senders.compact }), false);
  assert.equal(policy.canPushSnapshot({ sender: senders.widget }), false);
  assert.equal(policy.canPushSnapshot({ sender: senders.popover }), false);
  assert.equal(policy.canPushSnapshot(null), false);
});

test("whitelists valid widget action fields and rejects malformed actions", () => {
  assert.deepEqual(sanitizeWidgetAction({ type: "requestSnapshot", ignored: "value" }), {
    type: "requestSnapshot",
  });
  assert.deepEqual(sanitizeWidgetAction({ type: "quickAdd", title: "  Review physics  " }), {
    type: "quickAdd",
    title: "Review physics",
  });
  assert.deepEqual(sanitizeWidgetAction({ type: "timerStart", taskId: "task-1", ignored: true }), {
    type: "timerStart",
    taskId: "task-1",
  });
  assert.deepEqual(sanitizeWidgetAction({ type: "setAlwaysOnTop", enabled: false }), {
    type: "setAlwaysOnTop",
    enabled: false,
  });
  assert.deepEqual(sanitizeWidgetAction({
    type: "saveTimerSettings",
    draft: {
      mode: "pomodoro",
      focusMinutes: 25,
      breakMinutes: 5,
      rounds: 4,
      countdownSeconds: 1500,
    },
  }), {
    type: "saveTimerSettings",
    draft: {
      mode: "pomodoro",
      focusMinutes: 25,
      breakMinutes: 5,
      rounds: 4,
      countdownSeconds: 1500,
    },
  });
  assert.deepEqual(sanitizeWidgetAction({
    type: "scheduleWidgetCountdown",
    durationMinutes: 45,
  }), {
    type: "scheduleWidgetCountdown",
    durationMinutes: 45,
  });

  assert.equal(sanitizeWidgetAction(null), null);
  assert.equal(sanitizeWidgetAction({ type: "unknown" }), null);
  assert.equal(sanitizeWidgetAction({ type: "setAlwaysOnTop", enabled: "yes" }), null);
  assert.equal(sanitizeWidgetAction({ type: "timerStart", taskId: 4 }), null);
  assert.deepEqual(sanitizeWidgetAction({ type: "timerStart", taskId: undefined }), {
    type: "timerStart",
  });
  assert.equal(sanitizeWidgetAction({ type: "scheduleWidgetCountdown", durationMinutes: 0 }), null);
  assert.equal(sanitizeWidgetAction({ type: "saveTimerSettings", draft: {} }), null);
  assert.equal(sanitizeWidgetAction({
    type: "updateTimerPreferences",
    patch: { mode: "countdown" },
  }), null);
  assert.equal(sanitizeWidgetAction({
    type: "updateTimerPreferences",
    patch: { autoStartNextPhase: "yes" },
  }), null);
  assert.equal(sanitizeWidgetAction({
    type: "updateAppearance",
    patch: { value: "x".repeat(20_000) },
  }), null);
});

test("wires ownership checks and action sanitization into both widget relays", () => {
  const source = fs.readFileSync(path.resolve("electron", "main.cjs"), "utf8");
  assert.match(source, /if \(!widgetIpcPolicy\.canSendAction\(event\)\) return;/);
  assert.match(source, /const safeAction = sanitizeWidgetAction\(action\);/);
  assert.match(source, /broadcastToLiveWindows\(\[main\], "widget:action", safeAction\)/);
  assert.match(source, /if \(!widgetIpcPolicy\.canPushSnapshot\(event\)\) return;/);
});
