/**
 * Tests for the NavoPath plugin registry and built-in plugin bootstrap.
 *
 * Run with: npx vitest run src/plugins/registry.test.ts
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  activate,
  deactivate,
  getPlugin,
  isActive,
  listPlugins,
  register,
  resolveConfig,
} from "./registry";
import { BUILTIN_PLUGINS, bootstrapPlugins, registerBuiltinPlugins } from "./builtin";

function makeHost() {
  const toasts: string[] = [];
  const events: Array<{ event: string; payload?: unknown }> = [];
  return {
    toasts,
    events,
    host: {
      getData: () => null,
      savePluginConfig: () => {},
      emit: (event: string, payload?: unknown) => events.push({ event, payload }),
      toast: (msg: string) => toasts.push(msg),
    },
  };
}

describe("plugin registry", () => {
  beforeEach(() => {
    // Built-in plugins register themselves; we only need to deactivate them.
    for (const plugin of listPlugins()) {
      deactivate(plugin.id, { getData: () => null, savePluginConfig: () => {}, emit: () => {}, toast: () => {} });
    }
  });

  it("registers all built-in plugins", () => {
    registerBuiltinPlugins();
    const ids = listPlugins().map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(["pomodoro", "habit-tracker", "weather", "notes"]));
    expect(listPlugins().length).toBeGreaterThanOrEqual(BUILTIN_PLUGINS.length);
  });

  it("applies default config when none stored", () => {
    registerBuiltinPlugins();
    const plugin = getPlugin("pomodoro")!;
    const cfg = resolveConfig(plugin, undefined);
    expect(cfg.focusMinutes).toBe(25);
    expect(cfg.breakMinutes).toBe(5);
    expect(cfg.autoStartBreak).toBe(true);
  });

  it("activates a plugin and runs its lifecycle hook", () => {
    const ctx = makeHost();
    registerBuiltinPlugins();
    const ok = activate("pomodoro", ctx.host, { focusMinutes: 30, breakMinutes: 5, autoStartBreak: false });
    expect(ok).toBe(true);
    expect(isActive("pomodoro")).toBe(true);
    expect(ctx.toasts[0]).toContain("30");
  });

  it("deactivates an active plugin", () => {
    const ctx = makeHost();
    registerBuiltinPlugins();
    activate("pomodoro", ctx.host);
    ctx.toasts.length = 0;
    const ok = deactivate("pomodoro", ctx.host);
    expect(ok).toBe(true);
    expect(isActive("pomodoro")).toBe(false);
    expect(ctx.toasts[0]).toContain("stopped");
  });

  it("does not double-activate a plugin", () => {
    const ctx = makeHost();
    registerBuiltinPlugins();
    activate("weather", ctx.host);
    const second = activate("weather", ctx.host);
    expect(second).toBe(false);
  });

  it("returns false for unknown plugin ids", () => {
    const ctx = makeHost();
    expect(activate("does-not-exist", ctx.host)).toBe(false);
    expect(deactivate("does-not-exist", ctx.host)).toBe(false);
  });

  it("bootstrapPlugins activates every enabled id", () => {
    const ctx = makeHost();
    const result = bootstrapPlugins(["pomodoro", "weather"], ctx.host, {});
    expect(result.activated).toEqual(["pomodoro", "weather"]);
    expect(result.failed).toEqual([]);
    expect(isActive("pomodoro")).toBe(true);
    expect(isActive("weather")).toBe(true);
  });

  it("bootstrapPlugins reports unknown ids as failed without throwing", () => {
    const ctx = makeHost();
    const result = bootstrapPlugins(["pomodoro", "ghost"], ctx.host, {});
    expect(result.activated).toEqual(["pomodoro"]);
    expect(result.failed).toEqual(["ghost"]);
  });
});
