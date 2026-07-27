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
  type NavoPlugin,
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

  it("normalizes stored config values and ignores unsafe field keys", () => {
    const plugin: NavoPlugin = {
      id: "config-safety",
      name: "Config safety",
      description: "test",
      version: "1.0.0",
      author: "test",
      icon: "T",
      permissions: [],
      configFields: [
        { key: "__proto__", label: "Unsafe", type: "string", default: "polluted" },
        { key: "count", label: "Count", type: "number", min: 1, max: 10, default: 5 },
        { key: "label", label: "Label", type: "string", default: "" },
        { key: "mode", label: "Mode", type: "select", options: [{ value: "safe", label: "Safe" }], default: "safe" },
      ],
    };
    const config = resolveConfig(plugin, {
      count: Number.POSITIVE_INFINITY,
      label: "x".repeat(12_000),
      mode: "unknown",
    });

    expect(Object.prototype.hasOwnProperty.call(config, "__proto__")).toBe(false);
    expect(Object.getPrototypeOf(config)).toBe(Object.prototype);
    expect(config.count).toBe(5);
    expect(String(config.label)).toHaveLength(10_000);
    expect(config.mode).toBe("safe");
  });

  it("does not register plugins with unsafe storage ids", () => {
    register({
      id: "__proto__",
      name: "Unsafe",
      description: "test",
      version: "1.0.0",
      author: "test",
      icon: "T",
      permissions: [],
      configFields: [],
    });
    expect(getPlugin("__proto__")).toBeUndefined();
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
