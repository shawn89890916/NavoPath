import { describe, expect, it, vi } from "vitest";
import { readAutoLaunchState, toggleAutoLaunchState } from "./desktopAutoLaunch";

describe("desktop auto-launch state", () => {
  it("uses the operating system state returned after a toggle", async () => {
    const api = {
      getAutoLaunch: vi.fn(),
      setAutoLaunch: vi.fn().mockResolvedValue(false),
    };

    await expect(toggleAutoLaunchState(api, false)).resolves.toBe(false);
    expect(api.setAutoLaunch).toHaveBeenCalledWith(true);
  });

  it("keeps the current state when changing auto-launch fails", async () => {
    const api = {
      getAutoLaunch: vi.fn(),
      setAutoLaunch: vi.fn().mockRejectedValue(new Error("unavailable")),
    };

    await expect(toggleAutoLaunchState(api, true)).resolves.toBe(true);
  });

  it("falls back cleanly when reading auto-launch fails", async () => {
    const api = {
      getAutoLaunch: vi.fn().mockRejectedValue(new Error("unavailable")),
      setAutoLaunch: vi.fn(),
    };

    await expect(readAutoLaunchState(api, false)).resolves.toBe(false);
  });
});
