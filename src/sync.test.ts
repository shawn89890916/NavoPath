import { describe, expect, it } from "vitest";
import {
  SYNC_INTERVAL_PRESETS,
  SyncScheduler,
  formatLastSyncedAt,
  isManualOnly,
  presetForMinutes,
  readSyncInterval,
} from "./sync";

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
});
