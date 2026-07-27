import { describe, expect, it } from "vitest";
import { normalizeSettings } from "./defaultSettings";

describe("plugin settings normalization", () => {
  it("deduplicates and bounds enabled plugin ids", () => {
    const enabledPlugins = [
      "pomodoro",
      "pomodoro",
      "__proto__",
      "constructor",
      "",
      ...Array.from({ length: 150 }, (_, index) => `plugin-${index}`),
    ];

    const normalized = normalizeSettings({ enabledPlugins });
    expect(normalized.enabledPlugins).toHaveLength(100);
    expect(normalized.enabledPlugins?.[0]).toBe("pomodoro");
    expect(new Set(normalized.enabledPlugins).size).toBe(normalized.enabledPlugins?.length);
    expect(normalized.enabledPlugins).not.toContain("__proto__");
    expect(normalized.enabledPlugins).not.toContain("constructor");
  });

  it("preserves valid nested runtime config while filtering unsafe or oversized values", () => {
    const validConfig = JSON.parse(`{
      "habits": "Read",
      "doneByDate": { "2026-07-27": ["Read"] },
      "__proto__": { "polluted": true }
    }`) as Record<string, unknown>;
    validConfig.longText = "x".repeat(12_000);
    validConfig.invalidNumber = Number.POSITIVE_INFINITY;
    validConfig.wideArray = Array.from({ length: 6_000 }, (_, index) => index);

    const normalized = normalizeSettings({
      pluginConfigs: JSON.parse(`{
        "__proto__": { "polluted": true },
        "constructor": { "polluted": true },
        "not-an-object": "invalid"
      }`),
    });
    const withValid = normalizeSettings({
      pluginConfigs: {
        ...(normalized.pluginConfigs ?? {}),
        "habit-tracker": validConfig,
      },
    });
    const config = withValid.pluginConfigs?.["habit-tracker"];

    expect(Object.prototype.hasOwnProperty.call(withValid.pluginConfigs, "__proto__")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(withValid.pluginConfigs, "constructor")).toBe(false);
    expect(withValid.pluginConfigs?.["not-an-object"]).toBeUndefined();
    expect(config?.habits).toBe("Read");
    expect(config?.doneByDate).toEqual({ "2026-07-27": ["Read"] });
    expect(Object.prototype.hasOwnProperty.call(config, "__proto__")).toBe(false);
    expect(String(config?.longText)).toHaveLength(10_000);
    expect(config?.invalidNumber).toBeUndefined();
    expect(config?.wideArray).toHaveLength(5_000);
  });

  it("bounds plugin config count and nesting depth", () => {
    let deeplyNested: unknown = "leaf";
    for (let depth = 0; depth < 12; depth += 1) deeplyNested = { child: deeplyNested };
    const pluginConfigs = {
      "deep-plugin": { deeplyNested },
      ...Object.fromEntries(Array.from({ length: 150 }, (_, index) => [`plugin-${index}`, { enabled: true }])),
    };

    const normalized = normalizeSettings({ pluginConfigs });
    expect(Object.keys(normalized.pluginConfigs ?? {})).toHaveLength(100);
    expect(JSON.stringify(normalized.pluginConfigs?.["deep-plugin"])).not.toContain("leaf");
  });
});
