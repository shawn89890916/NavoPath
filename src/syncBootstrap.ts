import type { PlannerData, Settings } from "./types";
import { normalizeData } from "./browserFallback";
import { getDefaultSettings, normalizeSettings } from "./defaultSettings";
import { mergePlannerData } from "./syncMerge";

export type BootstrapCache = {
  data: PlannerData;
  settings: Settings;
  savedAt?: string;
  dataDirty?: boolean;
  settingsDirty?: boolean;
  /** @deprecated Read only for caches written before per-resource save tokens. */
  pendingSavedAt?: string;
  dataPendingSavedAt?: string;
  settingsPendingSavedAt?: string;
  remoteRevision?: number;
};

export function parseBootstrapCache(raw: string | null): BootstrapCache | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const candidate = parsed as Record<string, unknown>;
    const data = candidate.data;
    const settings = candidate.settings;
    if (
      !data || typeof data !== "object" || Array.isArray(data)
      || !settings || typeof settings !== "object" || Array.isArray(settings)
    ) return null;
    const plannerData = data as Partial<PlannerData>;
    if (!Array.isArray(plannerData.tasks) || !Array.isArray(plannerData.projects)) return null;
    const dataDirty = candidate.dataDirty === true;
    const settingsDirty = candidate.settingsDirty === true;
    const legacyPendingSavedAt = typeof candidate.pendingSavedAt === "string" ? candidate.pendingSavedAt : undefined;
    return {
      data: normalizeData(plannerData as PlannerData),
      settings: normalizeSettings(settings),
      savedAt: typeof candidate.savedAt === "string" ? candidate.savedAt : undefined,
      dataDirty,
      settingsDirty,
      pendingSavedAt: legacyPendingSavedAt,
      dataPendingSavedAt: typeof candidate.dataPendingSavedAt === "string"
        ? candidate.dataPendingSavedAt
        : dataDirty ? legacyPendingSavedAt : undefined,
      settingsPendingSavedAt: typeof candidate.settingsPendingSavedAt === "string"
        ? candidate.settingsPendingSavedAt
        : settingsDirty ? legacyPendingSavedAt : undefined,
      remoteRevision: typeof candidate.remoteRevision === "number"
        && Number.isFinite(candidate.remoteRevision)
        && candidate.remoteRevision >= 0
        ? candidate.remoteRevision
        : undefined,
    };
  } catch {
    return null;
  }
}

export function resolveBootstrap(
  cached: BootstrapCache | null,
  remoteData: PlannerData | null,
  remoteSettings: Settings | null,
  options: { preferRemote?: boolean } = {},
) {
  if (options.preferRemote && remoteData && remoteSettings) {
    return {
      data: remoteData,
      settings: remoteSettings,
      replayData: false,
      replaySettings: false,
    };
  }
  const replayData = Boolean(cached?.dataDirty && cached.data && remoteData);
  const replaySettings = Boolean(cached?.settingsDirty && cached.settings && remoteSettings);
  return {
    // A dirty local snapshot is not merely "newer" than the cloud baseline: it
    // contains acknowledged offline edits. Merge both sides before replaying so
    // reconnecting cannot erase either offline work or concurrent cloud work.
    data: replayData ? mergePlannerData(remoteData!, cached!.data) : remoteData || cached?.data || null,
    settings: replaySettings ? cached!.settings : remoteSettings || cached?.settings || null,
    replayData,
    replaySettings,
  };
}

export function canAcknowledgeBootstrapSave(
  cached: BootstrapCache | null,
  resource: "data" | "settings",
  pendingSavedAt: string,
) {
  if (!cached) return true;
  const dirty = resource === "data" ? cached.dataDirty : cached.settingsDirty;
  const currentToken = resource === "data" ? cached.dataPendingSavedAt : cached.settingsPendingSavedAt;
  // A different token means another edit (or browser tab) superseded this save.
  // Its dirty marker must survive even if this older request succeeds later.
  return !dirty || currentToken === pendingSavedAt;
}

export function recoverAccountSettings(
  current: Settings,
  snapshotSettings: Settings | null | undefined,
  currentUserId: string | undefined,
  snapshotUserId: string | undefined,
) {
  if (!snapshotSettings || !currentUserId || currentUserId !== snapshotUserId) {
    return { settings: current, recovered: false };
  }

  const defaults = getDefaultSettings();
  const snapshot = normalizeSettings(snapshotSettings);
  const displayName = current.displayName === defaults.displayName
    && snapshot.displayName !== defaults.displayName
    ? snapshot.displayName
    : current.displayName;
  const avatarDataUrl = !current.avatarDataUrl && snapshot.avatarDataUrl
    ? snapshot.avatarDataUrl
    : current.avatarDataUrl;
  const recovered = displayName !== current.displayName || avatarDataUrl !== current.avatarDataUrl;

  return {
    settings: recovered ? { ...current, displayName, avatarDataUrl } : current,
    recovered,
  };
}
