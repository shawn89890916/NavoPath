import { describe, expect, it } from "vitest";
import type { PlannerData, Task } from "./types";
import { mergePlannerData, preparePlannerDataRestore, withDeletionTombstones } from "./syncMerge";

function task(id: string, updatedAt: string): Task {
  return {
    id,
    title: id,
    dueDate: "",
    category: "personal",
    priority: "medium",
    notes: "",
    goalId: "",
    completed: false,
    createdAt: updatedAt,
    updatedAt,
  };
}

function data(tasks: Task[], deleted: Record<string, string> = {}): PlannerData {
  return {
    version: 2,
    importedSeedVersion: "test",
    generatedAt: "2026-07-26T00:00:00.000Z",
    goals: [],
    projects: [],
    tasks,
    longTasks: [],
    events: [],
    notes: [],
    drafts: [],
    chat: [],
    aiMemories: [],
    sync: { deleted },
  };
}

describe("sync deletion tombstones", () => {
  it("records objects removed from the previous complete profile", () => {
    const deletedAt = "2026-07-26T10:00:00.000Z";
    const next = withDeletionTombstones(
      data([task("removed", "2026-07-26T09:00:00.000Z"), task("kept", "2026-07-26T09:00:00.000Z")]),
      data([task("kept", "2026-07-26T09:30:00.000Z")]),
      deletedAt,
    );

    expect(next.sync?.deleted).toEqual({ "tasks:removed": deletedAt });
  });

  it("keeps the newest tombstone and prevents stale objects from returning", () => {
    const remote = data(
      [task("stale", "2026-07-26T09:00:00.000Z")],
      { "tasks:stale": "2026-07-26T11:00:00.000Z" },
    );
    const local = data(
      [task("stale", "2026-07-26T10:00:00.000Z")],
      { "tasks:stale": "2026-07-26T08:00:00.000Z" },
    );

    const merged = mergePlannerData(remote, local, "2026-07-26T12:00:00.000Z");

    expect(merged.tasks).toEqual([]);
    expect(merged.sync?.deleted["tasks:stale"]).toBe("2026-07-26T11:00:00.000Z");
  });

  it("allows an object updated after its tombstone to survive", () => {
    const remote = data([], { "tasks:restored": "2026-07-26T10:00:00.000Z" });
    const local = data([task("restored", "2026-07-26T11:00:00.000Z")]);

    expect(mergePlannerData(remote, local).tasks.map((item) => item.id)).toEqual(["restored"]);
  });

  it("keeps legacy objects without timestamps when no valid tombstone exists", () => {
    const legacy = task("legacy", "2026-07-26T09:00:00.000Z") as Partial<Task>;
    delete legacy.createdAt;
    delete legacy.updatedAt;

    expect(mergePlannerData(data([legacy as Task]), data([])).tasks.map((item) => item.id)).toEqual(["legacy"]);
    expect(mergePlannerData(
      data([legacy as Task], { "tasks:legacy": "damaged timestamp" }),
      data([]),
    ).tasks.map((item) => item.id)).toEqual(["legacy"]);
    expect(mergePlannerData(
      data([legacy as Task], { "tasks:legacy": "1970-01-01T00:00:00.000Z" }),
      data([]),
    ).tasks).toEqual([]);
  });

  it("makes an explicit backup restore newer than existing tombstones", () => {
    const current = data([], { "tasks:restored": "2026-07-26T12:00:00.000Z" });
    const backup = data([task("restored", "2026-07-25T09:00:00.000Z")]);
    const restored = preparePlannerDataRestore(backup, current, "2026-07-26T11:00:00.000Z");
    const tracked = withDeletionTombstones(current, restored, "2026-07-26T11:00:00.000Z");

    expect(mergePlannerData(current, tracked).tasks.map((item) => item.id)).toEqual(["restored"]);
    expect(restored.tasks[0].updatedAt).toBe("2026-07-26T12:00:00.001Z");
  });
});
