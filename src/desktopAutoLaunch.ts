export interface DesktopAutoLaunchApi {
  getAutoLaunch: () => Promise<boolean>;
  setAutoLaunch: (enabled: boolean) => Promise<boolean>;
}

export async function readAutoLaunchState(api: DesktopAutoLaunchApi, fallback: boolean): Promise<boolean> {
  try {
    const enabled = await api.getAutoLaunch();
    return typeof enabled === "boolean" ? enabled : fallback;
  } catch {
    return fallback;
  }
}

export async function toggleAutoLaunchState(api: DesktopAutoLaunchApi, current: boolean): Promise<boolean> {
  try {
    const enabled = await api.setAutoLaunch(!current);
    return typeof enabled === "boolean" ? enabled : current;
  } catch {
    return current;
  }
}
