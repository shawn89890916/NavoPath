import type { PlannerData, Settings } from "./types";
import { normalizeData } from "./browserFallback";
import { normalizeSettings } from "./defaultSettings";

export type BootstrapCache = {
  data: PlannerData;
  settings: Settings;
  savedAt?: string;
  dataDirty?: boolean;
  settingsDirty?: boolean;
  pendingSavedAt?: string;
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
    return {
      data: normalizeData(plannerData as PlannerData),
      settings: normalizeSettings(settings),
      savedAt: typeof candidate.savedAt === "string" ? candidate.savedAt : undefined,
      dataDirty: candidate.dataDirty === true,
      settingsDirty: candidate.settingsDirty === true,
      pendingSavedAt: typeof candidate.pendingSavedAt === "string" ? candidate.pendingSavedAt : undefined,
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
    data: replayData ? cached!.data : remoteData || cached?.data || null,
    settings: replaySettings ? cached!.settings : remoteSettings || cached?.settings || null,
    replayData,
    replaySettings,
  };
}
