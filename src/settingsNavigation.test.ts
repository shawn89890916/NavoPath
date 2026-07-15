import { describe, expect, it } from "vitest";
import {
  SETTINGS_CATEGORIES,
  SETTINGS_SEARCH_ENTRIES,
  normalizeSettingsTarget,
  searchSettings,
  settingsSearchPath,
} from "./settingsNavigation";

describe("settings navigation", () => {
  it("exposes exactly five top-level categories", () => {
    expect(SETTINGS_CATEGORIES.map((category) => category.id)).toEqual([
      "general",
      "appearance",
      "workflow",
      "account-data",
      "advanced",
    ]);
  });

  it("maps every legacy destination to a reachable target", () => {
    expect(normalizeSettingsTarget("execution")).toEqual({ category: "general", anchor: "execution-defaults" });
    expect(normalizeSettingsTarget("templates")).toEqual({ category: "workflow", anchor: "templates" });
    expect(normalizeSettingsTarget("account")).toEqual({ category: "account-data", anchor: "account" });
    expect(normalizeSettingsTarget("mcp")).toEqual({ category: "advanced", detail: "integrations", anchor: "mcp" });
    expect(normalizeSettingsTarget("page")).toEqual({ category: "general" });
    expect(normalizeSettingsTarget("features")).toEqual({ category: "workflow", anchor: "planning-views" });
  });

  it("falls back safely for an invalid object target", () => {
    expect(normalizeSettingsTarget({ category: "missing" } as never)).toEqual({ category: "general" });
  });

  it("searches across Chinese, English, and keywords", () => {
    expect(searchSettings("点缀色", "zh")[0].id).toBe("accent-colors");
    expect(searchSettings("desktop opacity", "en")[0].id).toBe("desktop-widget");
    expect(searchSettings("排程", "zh").map((item) => item.id)).toContain("schedule-buffer");
    expect(searchSettings("深色背景", "zh")[0].id).toBe("widget-dark-background");
  });

  it("returns advanced details with a complete breadcrumb", () => {
    const result = searchSettings("dark appearance", "en")[0];
    expect(result.target).toEqual({ category: "advanced", detail: "widget", anchor: "widget-dark" });
    expect(settingsSearchPath(result, "en")).toBe("Advanced › Desktop Windows › Widget dark appearance");
  });

  it("keeps search ids unique", () => {
    const ids = SETTINGS_SEARCH_ENTRIES.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
