// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import { ingestWorkspaceEvent, normalizeTaskOperations, previewTaskOperations, processAssistantMessage, verifyWebhookSignature, type CloudAssistantEnv } from "./cloudAssistant.ts";

function task(overrides: Record<string, unknown> = {}) {
  return {
    id: "task-1",
    title: "Prepare ESAT practice",
    dueDate: "2026-08-28",
    completed: false,
    estimatedHours: 1,
    timelineRecords: [{
      id: "record-1",
      taskId: "task-1",
      scheduledDate: "2026-08-28",
      scheduledStart: "09:00",
      scheduledEndDate: "2026-08-28",
      scheduledEnd: "10:00",
      executionStatus: "scheduled",
      createdAt: "2026-08-28T00:00:00.000Z",
    }],
    createdAt: "2026-08-28T00:00:00.000Z",
    updatedAt: "2026-08-28T00:00:00.000Z",
    ...overrides,
  };
}

test("normalizes only bounded, allowlisted task operations", () => {
  const operations = normalizeTaskOperations([
    { type: "reschedule_task", taskId: "task-1", date: "2026-08-29", startTime: "23:50", durationMinutes: 10_000, reason: "Move it" },
    { type: "delete_task", taskId: "task-1" },
    { type: "update_task", taskId: "bad id with spaces", patch: { completed: true } },
  ]);
  assert.deepEqual(operations, [{ type: "reschedule_task", taskId: "task-1", date: "2026-08-29", startTime: "23:50", durationMinutes: 1440, reason: "Move it" }]);
});

test("reschedules an existing block across midnight and records exact before and after values", () => {
  const preview = previewTaskOperations({ tasks: [task()] }, [{ type: "reschedule_task", taskId: "task-1", date: "2026-08-29", startTime: "23:50", durationMinutes: 30, reason: "Prepare tomorrow" }]);
  assert.equal(preview.confirmationRequired.length, 0);
  assert.equal(preview.changes.length, 1);
  assert.deepEqual(preview.data.tasks[0].timelineRecords[0], {
    id: "record-1",
    taskId: "task-1",
    scheduledDate: "2026-08-29",
    scheduledStart: "23:50",
    scheduledEndDate: "2026-08-30",
    scheduledEnd: "00:20",
    executionStatus: "scheduled",
    createdAt: "2026-08-28T00:00:00.000Z",
  });
  assert.equal(preview.changes[0].before.id, "record-1");
  assert.equal(preview.changes[0].after.scheduledEndDate, "2026-08-30");
  assert.equal(preview.inverseOperations[0].type, "restore_schedule_block");
});

test("requires confirmation for locked schedules and hard-deadline moves", () => {
  const locked = previewTaskOperations({ tasks: [task({ agentLocked: true, hardDeadline: true })] }, [
    { type: "reschedule_task", taskId: "task-1", date: "2026-08-29", startTime: "11:00", durationMinutes: 60 },
    { type: "update_task", taskId: "task-1", patch: { dueDate: "2026-08-30" } },
  ]);
  assert.equal(locked.changes.length, 0);
  assert.equal(locked.confirmationRequired.length, 2);
  assert.equal(locked.data.tasks[0].dueDate, "2026-08-28");
  assert.equal(locked.data.tasks[0].timelineRecords[0].scheduledStart, "09:00");

  const confirmed = previewTaskOperations({ tasks: [task({ agentLocked: true, hardDeadline: true })] }, [
    { type: "reschedule_task", taskId: "task-1", date: "2026-08-29", startTime: "11:00", durationMinutes: 60 },
    { type: "update_task", taskId: "task-1", patch: { dueDate: "2026-08-30" } },
  ], { allowProtected: true });
  assert.equal(confirmed.confirmationRequired.length, 0);
  assert.equal(confirmed.changes.length, 2);
  assert.equal(confirmed.data.tasks[0].dueDate, "2026-08-30");
  assert.equal(confirmed.data.tasks[0].timelineRecords[0].scheduledStart, "11:00");
});

test("rejects schedule conflicts before any committed payload is built", () => {
  const other = task({ id: "task-2", title: "Fixed class", timelineRecords: [{ id: "record-2", taskId: "task-2", scheduledDate: "2026-08-29", scheduledStart: "11:00", scheduledEndDate: "2026-08-29", scheduledEnd: "12:00", executionStatus: "scheduled", createdAt: "now" }] });
  assert.throws(() => previewTaskOperations({ tasks: [task(), other] }, [{ type: "reschedule_task", taskId: "task-1", date: "2026-08-29", startTime: "11:30", durationMinutes: 30 }]), /SCHEDULE_CONFLICT/);
});

test("a duplicate workspace event is accepted without another queue message", async () => {
  const originalFetch = globalThis.fetch;
  let queueCalls = 0;
  globalThis.fetch = async () => new Response(JSON.stringify([{ id: "event-1", event_cursor: 7, status: "processed" }]), { status: 200, headers: { "content-type": "application/json" } });
  const env = {
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service",
    ASSISTANT_QUEUE: { send: async () => { queueCalls += 1; } },
  } as unknown as CloudAssistantEnv;
  try {
    const result = await ingestWorkspaceEvent(env, "user-1", { changed_files: ["升学/资料/plan.md"], summary: "Updated plan", schedule_impact: "none", timestamp: "2026-08-28T08:00:00+08:00", dedupe_key: "event-key-0001" });
    assert.equal(result.duplicate, true);
    assert.equal(queueCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("an event wake-up with no newly claimable events does not call the model", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  globalThis.fetch = async (input) => {
    requestedUrls.push(String(input));
    return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
  };
  const env = {
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service",
    ASSISTANT_QUEUE: { send: async () => undefined },
  } as unknown as CloudAssistantEnv;
  try {
    assert.deepEqual(await processAssistantMessage(env, { userId: "user-1", trigger: "workspace_event" }), { skipped: "no_new_events" });
    assert.equal(requestedUrls.length, 1);
    assert.equal(requestedUrls.some((url) => url.includes("/functions/v1/ai-assistant")), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("accepts a fresh event signature and rejects replay or body tampering", async () => {
  const token = `nvp_${"a".repeat(64)}`;
  const body = JSON.stringify({ dedupe_key: "event-1" });
  const now = Date.parse("2026-08-28T01:00:00.000Z");
  const timestamp = String(Math.floor(now / 1000));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(token), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`));
  const signature = `sha256=${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;

  assert.equal(await verifyWebhookSignature(timestamp, signature, body, token, now), true);
  assert.equal(await verifyWebhookSignature(timestamp, signature, `${body} `, token, now), false);
  assert.equal(await verifyWebhookSignature(timestamp, signature, body, token, now + 6 * 60 * 1000), false);
});
