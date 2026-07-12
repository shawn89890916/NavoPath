import { describe, expect, it } from "vitest";
import {
  DEFAULT_WIDGET_APPEARANCE,
  WIDGET_APPEARANCE_VERSION,
  clampWidgetBounds,
  getWidgetDensity,
  migrateLegacyWidgetAppearance,
  normalizeWidgetAppearance,
  restoreStoredWidgetBounds,
} from "./widgetPreferences";

describe("widget appearance", () => {
  it("normalizes invalid persisted appearance values", () => {
    expect(normalizeWidgetAppearance({
      light: {
        backgroundColor: "lime",
        fontColor: "#123456",
        timerColor: "#abcdef",
        overrunColor: "invalid",
      },
      dark: { ...DEFAULT_WIDGET_APPEARANCE.dark, backgroundColor: "#010203" },
      opacity: 4,
      fontFamily: "",
      fontScale: 5,
      version: 99,
    } as never)).toEqual({
      ...DEFAULT_WIDGET_APPEARANCE,
      light: {
        ...DEFAULT_WIDGET_APPEARANCE.light,
        fontColor: "#123456",
        timerColor: "#ABCDEF",
      },
      dark: {
        ...DEFAULT_WIDGET_APPEARANCE.dark,
        backgroundColor: "#010203",
      },
      opacity: 1,
      fontScale: 2,
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

  it("uses compact density thresholds", () => {
    expect(getWidgetDensity(280)).toBe("full");
    expect(getWidgetDensity(279)).toBe("timerControls");
    expect(getWidgetDensity(200)).toBe("timerControls");
    expect(getWidgetDensity(199)).toBe("timerOnly");
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
      ...DEFAULT_WIDGET_APPEARANCE,
      light: {
        backgroundColor: "#EEE9DF",
        fontColor: "#27231E",
        timerColor: "#7EA172",
        overrunColor: DEFAULT_WIDGET_APPEARANCE.light.overrunColor,
      },
      opacity: 0.72,
      version: WIDGET_APPEARANCE_VERSION,
    });
    expect(migrateLegacyWidgetAppearance(legacy, WIDGET_APPEARANCE_VERSION)).toBeNull();
  });
});

describe("widget geometry", () => {
  const workArea = { x: 0, y: 0, width: 1280, height: 720 };

  it("preserves complete finite bounds for Electron to restore on the target display", () => {
    const secondaryDisplayBounds = { x: 1500, y: 120, width: 700, height: 300 };
    expect(restoreStoredWidgetBounds(JSON.stringify(secondaryDisplayBounds))).toEqual(secondaryDisplayBounds);
    expect(restoreStoredWidgetBounds("{malformed")).toBeNull();
    expect(restoreStoredWidgetBounds(JSON.stringify({ x: 1500, y: 120, width: 700 }))).toBeNull();
    expect(restoreStoredWidgetBounds(JSON.stringify({ x: 1500, y: 120, width: "700", height: 300 }))).toBeNull();
  });

  it("clamps restored bounds into the visible display work area", () => {
    expect(clampWidgetBounds({ x: 1200, y: -50, width: 2000, height: 40 }, workArea)).toEqual({
      x: 414,
      y: 0,
      width: 860,
      height: 80,
    });
  });

  it("falls back safely when persisted geometry is not numeric", () => {
    expect(clampWidgetBounds({ x: Number.NaN, y: Number.NaN, width: Number.NaN, height: Number.NaN }, workArea)).toEqual({
      x: 0,
      y: 0,
      width: 400,
      height: 80,
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

  it("uses exact width thresholds for adaptive density", () => {
    expect(getWidgetDensity(500)).toBe("full");
    expect(getWidgetDensity(280)).toBe("full");
    expect(getWidgetDensity(279)).toBe("timerControls");
    expect(getWidgetDensity(200)).toBe("timerControls");
    expect(getWidgetDensity(199)).toBe("timerOnly");
  });
});
