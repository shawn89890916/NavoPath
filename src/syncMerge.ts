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

function items(data: PlannerData, collection: SyncCollection): SyncItem[] {
  const value = data[collection];
  return Array.isArray(value) ? value as SyncItem[] : [];
}

function itemTime(item: SyncItem) {
  return Date.parse(item.updatedAt || item.createdAt || item.savedAt || "") || 0;
}

function mergeDeleted(
  remote: Record<string, string> = {},
  local: Record<string, string> = {},
) {
  const merged = { ...remote };
  for (const [key, deletedAt] of Object.entries(local)) {
    const currentTime = Date.parse(merged[key] || "") || 0;
    const candidateTime = Date.parse(deletedAt || "") || 0;
    if (candidateTime >= currentTime) merged[key] = deletedAt;
  }
  return merged;
}

export function withDeletionTombstones(
  previous: PlannerData | null,
  next: PlannerData,
  deletedAt = new Date().toISOString(),
): PlannerData {
  if (!previous) return next;
  const deleted = mergeDeleted(previous.sync?.deleted, next.sync?.deleted);
  for (const collection of SYNC_COLLECTIONS) {
    const nextIds = new Set(items(next, collection).map((item) => item.id).filter(Boolean));
    for (const item of items(previous, collection)) {
      if (!item.id || nextIds.has(item.id)) continue;
      const key = `${collection}:${item.id}`;
      const existingTime = Date.parse(deleted[key] || "") || 0;
      if (Date.parse(deletedAt) >= existingTime) deleted[key] = deletedAt;
    }
  }
  return { ...next, sync: { deleted } };
}

export function mergePlannerData(
  remote: PlannerData,
  local: PlannerData,
  mergedAt = new Date().toISOString(),
): PlannerData {
  const deleted = mergeDeleted(remote.sync?.deleted, local.sync?.deleted);
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
      const deletedAt = Date.parse(deleted[`${collection}:${item.id}`] || "") || 0;
      return deletedAt < itemTime(item);
    });
  }
  merged.chat = local.chat || remote.chat || [];
  merged.events = local.events || remote.events || [];
  merged.savedAt = mergedAt;
  return normalizeData(merged);
}
