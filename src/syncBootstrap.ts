import type { PlannerData, Settings } from "./types";

export type BootstrapCache = {
  data: PlannerData;
  settings: Settings;
  savedAt?: string;
  dataDirty?: boolean;
  settingsDirty?: boolean;
  pendingSavedAt?: string;
  remoteRevision?: number;
};

export function resolveBootstrap(
  cached: BootstrapCache | null,
  remoteData: PlannerData | null,
  remoteSettings: Settings | null,
) {
  const replayData = Boolean(cached?.dataDirty && cached.data && remoteData);
  const replaySettings = Boolean(cached?.settingsDirty && cached.settings && remoteSettings);
  return {
    data: replayData ? cached!.data : remoteData || cached?.data || null,
    settings: replaySettings ? cached!.settings : remoteSettings || cached?.settings || null,
    replayData,
    replaySettings,
  };
}
