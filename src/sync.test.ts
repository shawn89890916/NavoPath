import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  SYNC_INTERVAL_PRESETS,
  SyncScheduler,
  formatLastSyncedAt,
  isManualOnly,
  isCurrentWorkspaceLoad,
  presetForMinutes,
  readSyncInterval,
  shouldApplyRemoteRevision,
  shouldApplyWorkspaceRevision,
  shouldRequeueFailedSave,
} from "./sync";

describe("sync host account isolation", () => {
  const mainSource = readFileSync(new URL("./main.tsx", import.meta.url), "utf8");

  it("reads the active account from a ref in delayed cache and snapshot work", () => {
    expect(mainSource).toContain("const authStateRef = useRef<AuthState | null>(authState);");
    expect(mainSource).toContain("authStateRef.current = authState;");
    expect(mainSource).toContain("authUser: authStateRef.current?.user ?? null");
    expect(mainSource).not.toMatch(/(?:read|write)BootstrapCache\([^\n]*authState\?\.user\?\.id/);
  });
});

describe("sync race guards", () => {
  it("requeues only the still-current failed save", () => {
    expect(shouldRequeueFailedSave(2, 2)).toBe(true);
    expect(shouldRequeueFailedSave(2, 2, 1)).toBe(true);
    expect(shouldRequeueFailedSave(1, 2)).toBe(false);
    expect(shouldRequeueFailedSave(1, 2, 2)).toBe(false);
  });

  it("rejects stale positive remote revisions while allowing unversioned local data", () => {
    expect(shouldApplyRemoteRevision(5, 4)).toBe(false);
    expect(shouldApplyRemoteRevision(5, 5)).toBe(true);
    expect(shouldApplyRemoteRevision(5, 6)).toBe(true);
    expect(shouldApplyRemoteRevision(5, 0)).toBe(true);
  });

  it("rejects responses for a workspace that is no longer active", () => {
    expect(shouldApplyWorkspaceRevision("cloud:a", "cloud:b", 5, 6)).toBe(false);
    expect(shouldApplyWorkspaceRevision("cloud:a", "cloud:a", 5, 4)).toBe(false);
    expect(shouldApplyWorkspaceRevision("cloud:a", "cloud:a", 5, 6)).toBe(true);
  });

  it("accepts only the latest workspace load", () => {
    expect(isCurrentWorkspaceLoad(3, 3)).toBe(true);
    expect(isCurrentWorkspaceLoad(2, 3)).toBe(false);
  });
});

describe("isManualOnly", () => {
  it("treats 0 / undefined / null as manual-only", () => {
    expect(isManualOnly(0)).toBe(true);
    expect(isManualOnly(undefined)).toBe(true);
    expect(isManualOnly(null)).toBe(true);
    expect(isManualOnly(-1)).toBe(true);
  });
  it("treats positive minutes as auto-sync", () => {
    expect(isManualOnly(15)).toBe(false);
    expect(isManualOnly(60)).toBe(false);
  });
});

describe("presetForMinutes", () => {
  it("matches each preset exactly", () => {
    for (const preset of SYNC_INTERVAL_PRESETS) {
      expect(presetForMinutes(preset.minutes)).toBe(preset.key);
    }
  });
  it("falls back to 1h when the value is not in the preset list", () => {
    expect(presetForMinutes(45)).toBe("1h");
  });
  it("returns manual for 0 / null", () => {
    expect(presetForMinutes(0)).toBe("manual");
    expect(presetForMinutes(null)).toBe("manual");
  });
});

describe("readSyncInterval", () => {
  it("returns 0 when settings is missing", () => {
    expect(readSyncInterval(null)).toBe(0);
    expect(readSyncInterval(undefined)).toBe(0);
  });
  it("returns 0 for invalid or non-positive values", () => {
    expect(readSyncInterval({ syncIntervalMinutes: undefined })).toBe(0);
    expect(readSyncInterval({ syncIntervalMinutes: 0 })).toBe(0);
    expect(readSyncInterval({ syncIntervalMinutes: -5 })).toBe(0);
  });
  it("floors positive values", () => {
    expect(readSyncInterval({ syncIntervalMinutes: 60.9 })).toBe(60);
    expect(readSyncInterval({ syncIntervalMinutes: 15 })).toBe(15);
  });
});

describe("formatLastSyncedAt", () => {
  const now = new Date("2026-06-22T12:00:00Z");
  it("returns a not-synced label for missing or unparseable input", () => {
    expect(formatLastSyncedAt(undefined, "en", now)).toBe("Not synced yet");
    expect(formatLastSyncedAt("not-a-date", "zh", now)).toBe("尚未同步");
  });
  it("uses 'just now' inside the 45s window", () => {
    expect(formatLastSyncedAt(new Date(now.getTime() - 10_000).toISOString(), "en", now)).toBe("Just now");
    expect(formatLastSyncedAt(new Date(now.getTime() - 10_000).toISOString(), "zh", now)).toBe("刚刚");
  });
  it("scales minutes / hours / days", () => {
    expect(formatLastSyncedAt(new Date(now.getTime() - 5 * 60_000).toISOString(), "en", now)).toBe("5 minutes ago");
    expect(formatLastSyncedAt(new Date(now.getTime() - 2 * 60 * 60_000).toISOString(), "zh", now)).toBe("2 小时前");
    expect(formatLastSyncedAt(new Date(now.getTime() - 3 * 24 * 60 * 60_000).toISOString(), "en", now)).toBe("3 days ago");
  });
  it("labels future timestamps without describing them as past", () => {
    expect(formatLastSyncedAt(new Date(now.getTime() + 60_000).toISOString(), "en", now)).toBe("In 1 minute");
    expect(formatLastSyncedAt(new Date(now.getTime() + 5 * 60_000).toISOString(), "zh", now)).toBe("5 分钟后");
    expect(formatLastSyncedAt(new Date(now.getTime() + 2 * 60 * 60_000).toISOString(), "en", now)).toBe("In 2 hours");
    expect(formatLastSyncedAt(new Date(now.getTime() + 3 * 24 * 60 * 60_000).toISOString(), "zh", now)).toBe("3 天后");
  });
});

describe("SyncScheduler", () => {
  it("is manual-only by default and never fires a tick", async () => {
    let ticks = 0;
    const scheduler = new SyncScheduler({ onTick: () => (ticks += 1) });
    expect(scheduler.isRunning()).toBe(false);
    expect(scheduler.getIntervalMinutes()).toBe(0);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(ticks).toBe(0);
  });

  it("builds an auto-sync timer when interval is set", () => {
    const scheduler = new SyncScheduler();
    scheduler.setIntervalMinutes(60);
    expect(scheduler.isRunning()).toBe(true);
    expect(scheduler.getIntervalMinutes()).toBe(60);
    scheduler.stop();
    expect(scheduler.isRunning()).toBe(false);
  });

  it("skips a tick when the host reports busy or paused", async () => {
    const calls = { push: 0, pull: 0, ticks: 0 };
    const scheduler = new SyncScheduler({
      isBusy: () => true,
      isPaused: () => false,
      pushLocal: async () => {
        calls.push += 1;
      },
      pullRemote: async () => {
        calls.pull += 1;
      },
      onTick: () => {
        calls.ticks += 1;
      },
    });
    scheduler.setIntervalMinutes(15);
    const result = await scheduler.runNow();
    expect(result.pushedLocal).toBe(false);
    expect(result.pulledRemote).toBe(false);
    expect(calls.push).toBe(0);
    expect(calls.pull).toBe(0);
    expect(calls.ticks).toBe(1);
    scheduler.stop();
  });

  it("pushes then pulls, marks lastSyncedAt, and reports errors", async () => {
    const order: string[] = [];
    const scheduler = new SyncScheduler({
      pushLocal: async () => {
        order.push("push");
      },
      pullRemote: async () => {
        order.push("pull");
        throw new Error("offline");
      },
      onTick: (result) => {
        order.push(`tick:${result.ok ? "ok" : "err"}`);
      },
    });
    scheduler.setIntervalMinutes(15);
    let thrown: Error | null = null;
    try {
      await scheduler.runNow();
    } catch (caught) {
      thrown = caught as Error;
    }
    expect(order).toEqual(["push", "pull", "tick:err"]);
    expect(thrown?.message).toBe("offline");
    scheduler.stop();
  });

  it("setIntervalMinutes rebuilds the timer when the value changes", () => {
    const scheduler = new SyncScheduler();
    scheduler.setIntervalMinutes(15);
    const first = (scheduler as unknown as { timer: unknown }).timer;
    scheduler.setIntervalMinutes(60);
    const second = (scheduler as unknown as { timer: unknown }).timer;
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(first).not.toBe(second);
    scheduler.stop();
  });

  it("runPushOnly pushes local without pulling remote", async () => {
    const calls = { push: 0, pull: 0 };
    const scheduler = new SyncScheduler({
      pushLocal: async () => { calls.push += 1; },
      pullRemote: async () => { calls.pull += 1; },
    });
    const result = await scheduler.runPushOnly();
    expect(result.pushedLocal).toBe(true);
    expect(result.pulledRemote).toBe(false);
    expect(calls.push).toBe(1);
    expect(calls.pull).toBe(0);
  });

  it("runPullOnly pulls remote without pushing local", async () => {
    const calls = { push: 0, pull: 0 };
    const scheduler = new SyncScheduler({
      pushLocal: async () => { calls.push += 1; },
      pullRemote: async () => { calls.pull += 1; },
    });
    const result = await scheduler.runPullOnly();
    expect(result.pushedLocal).toBe(false);
    expect(result.pulledRemote).toBe(true);
    expect(calls.push).toBe(0);
    expect(calls.pull).toBe(1);
  });

  it("runNow does both push and pull", async () => {
    const calls = { push: 0, pull: 0 };
    const scheduler = new SyncScheduler({
      pushLocal: async () => { calls.push += 1; },
      pullRemote: async () => { calls.pull += 1; },
    });
    const result = await scheduler.runNow();
    expect(result.pushedLocal).toBe(true);
    expect(result.pulledRemote).toBe(true);
    expect(calls.push).toBe(1);
    expect(calls.pull).toBe(1);
  });

  it("preserves a queued manual direction when the scheduler stops", async () => {
    const order: string[] = [];
    let releasePush: (() => void) | undefined;
    const pushBlocked = new Promise<void>((resolve) => {
      releasePush = resolve;
    });
    const scheduler = new SyncScheduler({
      pushLocal: async () => {
        order.push("push:start");
        await pushBlocked;
        order.push("push:end");
      },
      pullRemote: async () => {
        order.push("pull");
      },
    });

    const pushResult = scheduler.runPushOnly();
    const pullResult = scheduler.runPullOnly();
    scheduler.stop();
    await Promise.resolve();
    expect(order).toEqual(["push:start"]);

    releasePush?.();
    await expect(pushResult).resolves.toMatchObject({ pushedLocal: true, pulledRemote: false });
    await expect(pullResult).resolves.toMatchObject({ pushedLocal: false, pulledRemote: true });
    expect(order).toEqual(["push:start", "push:end", "pull"]);
  });

  it("does not overlap an interval tick with an in-flight manual sync", async () => {
    vi.useFakeTimers();
    let releaseFirstPush: (() => void) | undefined;
    let finishInterval: (() => void) | undefined;
    const firstPushBlocked = new Promise<void>((resolve) => {
      releaseFirstPush = resolve;
    });
    const intervalFinished = new Promise<void>((resolve) => {
      finishInterval = resolve;
    });
    let pushCalls = 0;
    let activeCalls = 0;
    let maxActiveCalls = 0;
    const scheduler = new SyncScheduler({
      pushLocal: async () => {
        pushCalls += 1;
        activeCalls += 1;
        maxActiveCalls = Math.max(maxActiveCalls, activeCalls);
        if (pushCalls === 1) await firstPushBlocked;
        activeCalls -= 1;
      },
      pullRemote: async () => {
        activeCalls += 1;
        maxActiveCalls = Math.max(maxActiveCalls, activeCalls);
        activeCalls -= 1;
        finishInterval?.();
      },
    });

    try {
      scheduler.setIntervalMinutes(1);
      const manualResult = scheduler.runPushOnly();
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(60_000);

      expect(pushCalls).toBe(1);
      expect(maxActiveCalls).toBe(1);

      releaseFirstPush?.();
      await manualResult;
      await intervalFinished;
      expect(pushCalls).toBe(2);
      expect(maxActiveCalls).toBe(1);
    } finally {
      scheduler.stop();
      vi.useRealTimers();
    }
  });

  it("cancels a queued interval tick when automatic sync stops", async () => {
    vi.useFakeTimers();
    let releaseManualPush: (() => void) | undefined;
    const manualPushBlocked = new Promise<void>((resolve) => {
      releaseManualPush = resolve;
    });
    const calls = { push: 0, pull: 0 };
    const scheduler = new SyncScheduler({
      pushLocal: async () => {
        calls.push += 1;
        if (calls.push === 1) await manualPushBlocked;
      },
      pullRemote: async () => {
        calls.pull += 1;
      },
    });

    try {
      scheduler.setIntervalMinutes(1);
      const manualResult = scheduler.runPushOnly();
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(calls).toEqual({ push: 1, pull: 0 });

      scheduler.stop();
      releaseManualPush?.();
      await manualResult;
      await vi.advanceTimersByTimeAsync(0);
      expect(calls).toEqual({ push: 1, pull: 0 });
    } finally {
      scheduler.stop();
      vi.useRealTimers();
    }
  });
});
