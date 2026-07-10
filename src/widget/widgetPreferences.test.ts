import { describe, expect, it } from "vitest";
import {
  DEFAULT_WIDGET_APPEARANCE,
  WIDGET_APPEARANCE_VERSION,
  clampWidgetBounds,
  getWidgetLayout,
  migrateLegacyWidgetAppearance,
  normalizeWidgetAppearance,
  restoreStoredWidgetBounds,
} from "./widgetPreferences";

describe("widget appearance", () => {
  it("normalizes invalid persisted appearance values", () => {
    expect(normalizeWidgetAppearance({
      backgroundColor: "lime",
      fontColor: "#123456",
      accentColor: "#abcdef",
      opacity: 4,
      version: 99,
    })).toEqual({
      ...DEFAULT_WIDGET_APPEARANCE,
      fontColor: "#123456",
      accentColor: "#ABCDEF",
      opacity: 1,
      version: WIDGET_APPEARANCE_VERSION,
    });
    expect(normalizeWidgetAppearance({ opacity: -2 })).toEqual({
      ...DEFAULT_WIDGET_APPEARANCE,
      opacity: 0,
    });
    expect(normalizeWidgetAppearance({ opacity: 0 })).toEqual({
      ...DEFAULT_WIDGET_APPEARANCE,
      opacity: 0,
    });
  });

  it("migrates legacy local preferences only before the settings version is recorded", () => {
    const legacy = JSON.stringify({
      backgroundColor: "#eee9df",
      fontColor: "#27231e",
      accentColor: "#7ea172",
      opacity: 0.72,
      timeColorMode: "project",
    });

    expect(migrateLegacyWidgetAppearance(legacy, 0)).toEqual({
      backgroundColor: "#EEE9DF",
      fontColor: "#27231E",
      accentColor: "#7EA172",
      opacity: 0.72,
      version: WIDGET_APPEARANCE_VERSION,
    });
    expect(migrateLegacyWidgetAppearance(legacy, WIDGET_APPEARANCE_VERSION)).toBeNull();
  });
});

describe("widget geometry", () => {
  const workArea = { x: 0, y: 0, width: 1280, height: 720 };

  it("restores valid persisted bounds and ignores malformed JSON", () => {
    expect(restoreStoredWidgetBounds(
      JSON.stringify({ x: 1200, y: -50, width: 2000, height: 40 }),
      workArea,
    )).toEqual({ x: 414, y: 0, width: 860, height: 84 });
    expect(restoreStoredWidgetBounds("{malformed", workArea)).toBeNull();
  });

  it("clamps restored bounds into the visible display work area", () => {
    expect(clampWidgetBounds({ x: 1200, y: -50, width: 2000, height: 40 }, workArea)).toEqual({
      x: 414,
      y: 0,
      width: 860,
      height: 84,
    });
  });

  it("falls back safely when persisted geometry is not numeric", () => {
    expect(clampWidgetBounds({ x: Number.NaN, y: Number.NaN, width: Number.NaN, height: Number.NaN }, workArea)).toEqual({
      x: 0,
      y: 0,
      width: 500,
      height: 88,
    });
  });

  it("preserves the 320px max-height floor within the available work area", () => {
    expect(clampWidgetBounds(
      { x: 0, y: 0, width: 500, height: 500 },
      { x: 0, y: 0, width: 800, height: 400 },
    )).toEqual({ x: 0, y: 0, width: 500, height: 320 });
    expect(clampWidgetBounds(
      { x: 0, y: 0, width: 500, height: 500 },
      { x: 0, y: 0, width: 800, height: 300 },
    )).toEqual({ x: 0, y: 0, width: 500, height: 288 });
  });

  it("uses the stacked layout only for tall windows", () => {
    expect(getWidgetLayout(700, 100)).toBe("strip");
    expect(getWidgetLayout(480, 100)).toBe("strip");
    expect(getWidgetLayout(480, 132)).toBe("stacked");
    expect(getWidgetLayout(700, 180)).toBe("stacked");
  });
});
