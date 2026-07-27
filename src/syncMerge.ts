import type { PlannerData } from "./types";
import { normalizeData } from "./browserFallback";

export const SYNC_COLLECTIONS = [
  "goals",
  "projects",
  "tasks",
  "habits",
  "habitDailyStates",
  "timeEntries",
  "longTasks",
  "notes",
  "drafts",
  "aiConversations",
  "aiMemories",
  "scheduleTemplates",
] as const;

type SyncCollection = typeof SYNC_COLLECTIONS[number];
type SyncItem = { id?: string; updatedAt?: string; createdAt?: string; savedAt?: string };
const SYNC_COLLECTION_NAMES = new Set<string>(SYNC_COLLECTIONS);
const MAX_SYNC_CLOCK_SKEW_MS = 7 * 24 * 60 * 60 * 1_000;
const MAX_SYNC_TIMESTAMP_MS = Date.parse("9999-12-31T23:59:59.999Z");

function items(data: PlannerData, collection: SyncCollection): SyncItem[] {
  const value = data[collection];
  return Array.isArray(value) ? value as SyncItem[] : [];
}

function itemTime(item: SyncItem) {
  return Date.parse(item.updatedAt || item.createdAt || item.savedAt || "") || 0;
}

function syncReferenceTime(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed <= MAX_SYNC_TIMESTAMP_MS ? parsed : Date.now();
}

function tombstoneTime(value: unknown, referenceTime: number) {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed)
    && parsed <= MAX_SYNC_TIMESTAMP_MS
    && parsed <= referenceTime + MAX_SYNC_CLOCK_SKEW_MS
    ? parsed
    : null;
}

function isTombstoneKey(key: string) {
  const separator = key.indexOf(":");
  return separator > 0
    && separator < key.length - 1
    && SYNC_COLLECTION_NAMES.has(key.slice(0, separator));
}

function mergeDeleted(
  remote: unknown,
  local: unknown,
  referenceTime: number,
) {
  const merged: Record<string, string> = {};
  for (const source of [remote, local]) {
    if (!source || typeof source !== "object" || Array.isArray(source)) continue;
    for (const [key, deletedAt] of Object.entries(source)) {
      if (!isTombstoneKey(key)) continue;
      const candidateTime = tombstoneTime(deletedAt, referenceTime);
      if (candidateTime === null) continue;
      const currentTime = tombstoneTime(merged[key], referenceTime);
      if (currentTime === null || candidateTime >= currentTime) merged[key] = deletedAt;
    }
  }
  return merged;
}

function pruneSupersededTombstones(
  data: PlannerData,
  deleted: Record<string, string>,
  referenceTime: number,
) {
  for (const collection of SYNC_COLLECTIONS) {
    for (const item of items(data, collection)) {
      if (!item.id) continue;
      const key = `${collection}:${item.id}`;
      const deletedAt = tombstoneTime(deleted[key], referenceTime);
      if (deletedAt !== null && deletedAt < itemTime(item)) delete deleted[key];
    }
  }
}

export function withDeletionTombstones(
  previous: PlannerData | null,
  next: PlannerData,
  deletedAt = new Date().toISOString(),
): PlannerData {
  const deletionTime = syncReferenceTime(deletedAt);
  const effectiveDeletedAt = new Date(deletionTime).toISOString();
  const deleted = mergeDeleted(previous?.sync?.deleted, next.sync?.deleted, deletionTime);
  if (previous) {
    for (const collection of SYNC_COLLECTIONS) {
      const nextIds = new Set(items(next, collection).map((item) => item.id).filter(Boolean));
      for (const item of items(previous, collection)) {
        if (!item.id || nextIds.has(item.id)) continue;
        const key = `${collection}:${item.id}`;
        const existingTime = tombstoneTime(deleted[key], deletionTime);
        if (existingTime === null || deletionTime >= existingTime) deleted[key] = effectiveDeletedAt;
      }
    }
  }
  pruneSupersededTombstones(next, deleted, deletionTime);
  if (!previous && Object.keys(deleted).length === 0 && !next.sync) return next;
  return { ...next, sync: { deleted } };
}

export function preparePlannerDataRestore(
  data: PlannerData,
  previous: PlannerData | null = null,
  restoredAt = new Date().toISOString(),
): PlannerData {
  let restoredTime = syncReferenceTime(restoredAt);
  const deleted = mergeDeleted(previous?.sync?.deleted, data.sync?.deleted, restoredTime);
  for (const deletedAt of Object.values(deleted)) {
    const deletedTime = tombstoneTime(deletedAt, restoredTime);
    if (deletedTime !== null) restoredTime = Math.max(restoredTime, deletedTime + 1);
  }
  const effectiveRestoredAt = new Date(restoredTime).toISOString();
  const restored: any = { ...data };
  for (const collection of SYNC_COLLECTIONS) {
    restored[collection] = items(data, collection).map((item) => ({
      ...item,
      updatedAt: effectiveRestoredAt,
    }));
  }
  return normalizeData(restored);
}

export function mergePlannerData(
  remote: PlannerData,
  local: PlannerData,
  mergedAt = new Date().toISOString(),
): PlannerData {
  const referenceTime = syncReferenceTime(mergedAt);
  const deleted = mergeDeleted(remote.sync?.deleted, local.sync?.deleted, referenceTime);
  const merged: any = {
    ...remote,
    ...local,
    sync: { deleted },
  };
  for (const collection of SYNC_COLLECTIONS) {
    const byId = new Map<string, SyncItem>();
    for (const item of items(remote, collection)) if (item.id) byId.set(item.id, item);
    for (const item of items(local, collection)) {
      if (!item.id) continue;
      const current = byId.get(item.id);
      if (!current || itemTime(item) >= itemTime(current)) byId.set(item.id, item);
    }
    merged[collection] = Array.from(byId.values()).filter((item) => {
      const deletedAt = tombstoneTime(deleted[`${collection}:${item.id}`], referenceTime);
      return deletedAt === null || deletedAt < itemTime(item);
    });
  }
  pruneSupersededTombstones(merged, deleted, referenceTime);
  merged.chat = local.chat || remote.chat || [];
  merged.events = local.events || remote.events || [];
  merged.savedAt = mergedAt;
  return normalizeData(merged);
}
