/**
 * Cloud sync scheduler — drives both the auto-sync timer and the manual "Sync now"
 * action. Web and desktop builds share the same code path; the desktop app reads
 * `lastSyncedAt` from settings just like the web build.
 *
 * The scheduler never throws: a single failed tick must not stop future ticks.
 * When a save is already in-flight we skip the tick — `runNow()` will retry once
 * the in-flight job settles, and the next scheduled tick will pick up the slack.
 */
import type { Settings } from "./types";

export const SYNC_INTERVAL_PRESETS = [
  { minutes: 0, key: "manual" },
  { minutes: 15, key: "15m" },
  { minutes: 60, key: "1h" },
  { minutes: 360, key: "6h" },
  { minutes: 1440, key: "24h" },
] as const;

export type SyncIntervalPresetKey = (typeof SYNC_INTERVAL_PRESETS)[number]["key"];

export type SyncTickResult = {
  ok: boolean;
  syncedAt: string;
  /** When false the caller did not push local changes (e.g. another save in-flight). */
  pushedLocal: boolean;
  /** When false the caller could not reach the remote (e.g. offline). */
  pulledRemote: boolean;
  error?: string;
};

type SyncDirection = "push" | "pull" | "both";
type SyncReason = "manual" | "interval";

export type SyncSchedulerOptions = {
  /** Returns true when the scheduler should defer (e.g. another save in-flight). */
  isBusy?: () => boolean;
  /** Returns true when the scheduler should defer (e.g. document hidden in web build). */
  isPaused?: () => boolean;
  /** Push any pending local data/settings. Resolves once the writes complete. */
  pushLocal?: () => Promise<void>;
  /** Pull the latest remote baseline and apply it locally if newer. */
  pullRemote?: () => Promise<void>;
  /** Notify the host that a tick completed — used to persist lastSyncedAt. */
  onTick?: (result: SyncTickResult) => void;
  /** Used as the source of timestamps; exposed for tests. */
  now?: () => Date;
};

export function shouldRequeueFailedSave(
  jobVersion: number,
  currentVersion: number,
  pendingVersion?: number,
) {
  return jobVersion === currentVersion
    && (pendingVersion === undefined || pendingVersion < jobVersion);
}

export function shouldApplyRemoteRevision(currentRevision: number, incomingRevision: number) {
  return incomingRevision <= 0 || incomingRevision >= currentRevision;
}

export function shouldApplyWorkspaceRevision(
  expectedWorkspaceKey: string,
  currentWorkspaceKey: string,
  currentRevision: number,
  incomingRevision: number,
) {
  return expectedWorkspaceKey === currentWorkspaceKey
    && shouldApplyRemoteRevision(currentRevision, incomingRevision);
}

export function isCurrentWorkspaceLoad(loadVersion: number, currentVersion: number) {
  return loadVersion === currentVersion;
}

export function isManualOnly(intervalMinutes: number | null | undefined) {
  return !intervalMinutes || intervalMinutes <= 0;
}

export function presetForMinutes(minutes: number | null | undefined): SyncIntervalPresetKey {
  if (isManualOnly(minutes)) return "manual";
  const match = SYNC_INTERVAL_PRESETS.find((preset) => preset.minutes === minutes);
  return (match?.key || "1h") as SyncIntervalPresetKey;
}

export function formatLastSyncedAt(value: string | undefined, lang: "en" | "zh", now: Date = new Date()): string {
  if (!value) {
    return lang === "zh" ? "尚未同步" : "Not synced yet";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return lang === "zh" ? "尚未同步" : "Not synced yet";
  }
  const diffMs = now.getTime() - parsed.getTime();
  const future = diffMs < 0;
  const absSec = Math.round(Math.abs(diffMs) / 1000);
  if (absSec < 45) {
    return lang === "zh" ? "刚刚" : "Just now";
  }
  if (absSec < 90) {
    return future
      ? lang === "zh" ? "1 分钟后" : "In 1 minute"
      : lang === "zh" ? "1 分钟前" : "1 minute ago";
  }
  const minutes = Math.round(absSec / 60);
  if (minutes < 60) {
    return future
      ? lang === "zh" ? `${minutes} 分钟后` : `In ${minutes} minutes`
      : lang === "zh" ? `${minutes} 分钟前` : `${minutes} minutes ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return future
      ? lang === "zh" ? `${hours} 小时后` : `In ${hours} hours`
      : lang === "zh" ? `${hours} 小时前` : `${hours} hours ago`;
  }
  const days = Math.round(hours / 24);
  if (days < 7) {
    return future
      ? lang === "zh" ? `${days} 天后` : `In ${days} days`
      : lang === "zh" ? `${days} 天前` : `${days} days ago`;
  }
  return parsed.toLocaleString(lang === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export class SyncScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private runningPromise: Promise<SyncTickResult> | null = null;
  private runningDirection: SyncDirection | null = null;
  private queuedPromise: Promise<SyncTickResult> | null = null;
  private queuedDirection: SyncDirection | null = null;
  private queuedReason: SyncReason | null = null;
  private intervalMinutes = 0;

  constructor(private readonly options: SyncSchedulerOptions = {}) {}

  /** Rebuild the auto-sync timer to match the desired interval. 0 = manual only. */
  setIntervalMinutes(intervalMinutes: number | null | undefined) {
    const normalized = isManualOnly(intervalMinutes) ? 0 : Math.max(1, Math.floor(intervalMinutes || 0));
    if (normalized === this.intervalMinutes && this.timer) return;
    this.intervalMinutes = normalized;
    this.stop();
    if (normalized <= 0) return;
    this.timer = setInterval(() => {
      void this.runScheduled("interval", "both").catch(() => undefined);
    }, normalized * 60 * 1000);
  }

  /** Stop auto-sync and cancel any interval tick that has not started. Idempotent. */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.queuedReason === "interval") {
      this.queuedDirection = null;
      this.queuedReason = null;
    }
  }

  /** True when the auto-sync timer is currently active. */
  isRunning() {
    return this.timer !== null;
  }

  /** Current interval in minutes, or 0 for manual-only. */
  getIntervalMinutes() {
    return this.intervalMinutes;
  }

  /** Run a sync now. Compatible calls share the current tick; missing work is queued. */
  runNow(): Promise<SyncTickResult> {
    return this.runScheduled("manual", "both");
  }

  /** Push local changes to the cloud only (no pull). */
  runPushOnly(): Promise<SyncTickResult> {
    return this.runScheduled("manual", "push");
  }

  /** Pull the latest cloud data to local only (no push). */
  runPullOnly(): Promise<SyncTickResult> {
    return this.runScheduled("manual", "pull");
  }

  private runScheduled(reason: SyncReason, direction: SyncDirection): Promise<SyncTickResult> {
    if (!this.runningPromise) return this.startTick(reason, direction);
    if (this.runningDirection === "both" || this.runningDirection === direction) {
      return this.runningPromise;
    }

    this.queuedDirection = this.mergeDirections(this.queuedDirection, direction);
    if (!this.queuedReason || reason === "manual") this.queuedReason = reason;
    if (!this.queuedPromise) {
      const activeRun = this.runningPromise;
      this.queuedPromise = activeRun
        .catch(() => undefined)
        .then(() => {
          const nextDirection = this.queuedDirection;
          const nextReason = this.queuedReason;
          this.queuedDirection = null;
          this.queuedReason = null;
          this.queuedPromise = null;
          if (!nextDirection || !nextReason) {
            return {
              ok: true,
              syncedAt: (this.options.now?.() || new Date()).toISOString(),
              pushedLocal: false,
              pulledRemote: false,
            };
          }
          return this.startTick(nextReason, nextDirection);
        });
    }
    return this.queuedPromise;
  }

  private startTick(reason: SyncReason, direction: SyncDirection): Promise<SyncTickResult> {
    let trackedPromise: Promise<SyncTickResult>;
    trackedPromise = this.runTick({ reason, direction }).finally(() => {
      if (this.runningPromise === trackedPromise) {
        this.runningPromise = null;
        this.runningDirection = null;
      }
    });
    this.runningDirection = direction;
    this.runningPromise = trackedPromise;
    return trackedPromise;
  }

  private mergeDirections(current: SyncDirection | null, incoming: SyncDirection): SyncDirection {
    if (!current) return incoming;
    return current === incoming ? current : "both";
  }

  private async runTick({ reason, direction }: { reason: SyncReason; direction: SyncDirection }): Promise<SyncTickResult> {
    const now = this.options.now?.() || new Date();
    const startedAt = now.toISOString();
    const busy = () => this.options.isBusy?.();
    const paused = () => this.options.isPaused?.();
    const push = this.options.pushLocal;
    const pull = this.options.pullRemote;
    const wantPush = direction !== "pull" && Boolean(push);
    const wantPull = direction !== "push" && Boolean(pull);

    if (busy?.() || paused?.() || (!wantPush && !wantPull)) {
      const result: SyncTickResult = { ok: true, syncedAt: startedAt, pushedLocal: false, pulledRemote: false };
      this.options.onTick?.(result);
      return result;
    }

    let pushedLocal = false;
    let pulledRemote = false;
    let error: string | undefined;
    try {
      if (wantPush) {
        await push!();
        pushedLocal = true;
      }
      if (wantPull) {
        await pull!();
        pulledRemote = true;
      }
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    }
    const syncedAt = (this.options.now?.() || new Date()).toISOString();
    const result: SyncTickResult = { ok: !error, syncedAt, pushedLocal, pulledRemote, error };
    this.options.onTick?.(result);
    if (reason === "manual" && error) {
      // Surface errors thrown to the caller for the manual button.
      throw new Error(error);
    }
    return result;
  }
}

/**
 * Pull `syncIntervalMinutes` out of a settings object with safe fallbacks.
 * Returns 0 when the field is missing or invalid — manual-only is the safe default.
 */
export function readSyncInterval(settings: Pick<Settings, "syncIntervalMinutes"> | null | undefined): number {
  if (!settings) return 0;
  const value = settings.syncIntervalMinutes;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}
