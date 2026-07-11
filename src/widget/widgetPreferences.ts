import type { WidgetAppearance, WidgetBounds, WidgetThemeColors } from "../types";

export const WIDGET_APPEARANCE_VERSION = 2;
export const WIDGET_MIN_WIDTH = 360;
export const WIDGET_MAX_WIDTH = 860;
export const WIDGET_MIN_HEIGHT = 84;
export const WIDGET_DEFAULT_BOUNDS = { width: 500, height: 88 } as const;
const WINDOW_MARGIN = 6;

export const DEFAULT_WIDGET_APPEARANCE: WidgetAppearance = {
  light: {
    backgroundColor: "#FBF9FF",
    fontColor: "#27231E",
    timerColor: "#5D9B63",
    overrunColor: "#B34F47",
  },
  dark: {
    backgroundColor: "#27231E",
    fontColor: "#EEE9DF",
    timerColor: "#70D978",
    overrunColor: "#E27C68",
  },
  opacity: 0.96,
  fontFamily: "system-ui, sans-serif",
  fontScale: 1,
  shadowEnabled: true,
  version: WIDGET_APPEARANCE_VERSION,
};

function normalizeHex(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toUpperCase()
    : fallback;
}

function normalizeOpacity(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_WIDGET_APPEARANCE.opacity;
  return Math.min(1, Math.max(0, parsed));
}

function normalizeScale(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_WIDGET_APPEARANCE.fontScale;
  return Math.min(2, Math.max(0.5, parsed));
}

function normalizeTheme(value: unknown, fallback: WidgetThemeColors): WidgetThemeColors {
  const theme = value && typeof value === "object" ? value as Partial<WidgetThemeColors> : {};
  return {
    backgroundColor: normalizeHex(theme.backgroundColor, fallback.backgroundColor),
    fontColor: normalizeHex(theme.fontColor, fallback.fontColor),
    timerColor: normalizeHex(theme.timerColor, fallback.timerColor),
    overrunColor: normalizeHex(theme.overrunColor, fallback.overrunColor),
  };
}

type LegacyWidgetAppearance = {
  backgroundColor?: unknown;
  fontColor?: unknown;
  accentColor?: unknown;
  opacity?: unknown;
};

export function normalizeWidgetAppearance(value?: Partial<WidgetAppearance> | LegacyWidgetAppearance | null): WidgetAppearance {
  const candidate = value && typeof value === "object" ? value as Partial<WidgetAppearance> & LegacyWidgetAppearance : {};
  const legacyLight = candidate.backgroundColor !== undefined || candidate.fontColor !== undefined || candidate.accentColor !== undefined
    ? {
        backgroundColor: candidate.backgroundColor,
        fontColor: candidate.fontColor,
        timerColor: candidate.accentColor,
      }
    : undefined;
  const fontFamily = typeof candidate.fontFamily === "string" && candidate.fontFamily.trim()
    ? candidate.fontFamily.trim()
    : DEFAULT_WIDGET_APPEARANCE.fontFamily;
  return {
    light: normalizeTheme(candidate.light ?? legacyLight, DEFAULT_WIDGET_APPEARANCE.light),
    dark: normalizeTheme(candidate.dark, DEFAULT_WIDGET_APPEARANCE.dark),
    opacity: normalizeOpacity(value?.opacity),
    fontFamily,
    fontScale: normalizeScale(candidate.fontScale),
    shadowEnabled: typeof candidate.shadowEnabled === "boolean"
      ? candidate.shadowEnabled
      : DEFAULT_WIDGET_APPEARANCE.shadowEnabled,
    version: WIDGET_APPEARANCE_VERSION,
  };
}

export function migrateLegacyWidgetAppearance(raw: string | null, currentVersion = 0): WidgetAppearance | null {
  if (!raw || currentVersion >= WIDGET_APPEARANCE_VERSION) return null;
  try {
    return normalizeWidgetAppearance(JSON.parse(raw) as LegacyWidgetAppearance);
  } catch {
    return null;
  }
}

export function clampWidgetBounds(bounds: WidgetBounds, workArea: WidgetBounds): WidgetBounds {
  const safeX = Number.isFinite(bounds.x) ? bounds.x : workArea.x;
  const safeY = Number.isFinite(bounds.y) ? bounds.y : workArea.y;
  const safeWidth = Number.isFinite(bounds.width) ? bounds.width : WIDGET_DEFAULT_BOUNDS.width;
  const safeHeight = Number.isFinite(bounds.height) ? bounds.height : WIDGET_DEFAULT_BOUNDS.height;
  const maxWidth = Math.min(WIDGET_MAX_WIDTH, Math.max(WIDGET_MIN_WIDTH, workArea.width - WINDOW_MARGIN * 2));
  const maxHeight = Math.min(Math.max(320, Math.round(workArea.height * 0.7)), Math.max(WIDGET_MIN_HEIGHT, workArea.height - WINDOW_MARGIN * 2));
  const width = Math.min(maxWidth, Math.max(WIDGET_MIN_WIDTH, Math.round(safeWidth)));
  const height = Math.min(maxHeight, Math.max(WIDGET_MIN_HEIGHT, Math.round(safeHeight)));
  const minX = workArea.x;
  const minY = workArea.y;
  const maxX = workArea.x + workArea.width - width - WINDOW_MARGIN;
  const maxY = workArea.y + workArea.height - height - WINDOW_MARGIN;
  return {
    x: Math.min(maxX, Math.max(minX, Math.round(safeX))),
    y: Math.min(maxY, Math.max(minY, Math.round(safeY))),
    width,
    height,
  };
}

export function restoreStoredWidgetBounds(raw: string | null): WidgetBounds | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<WidgetBounds> | null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const { x, y, width, height } = parsed;
    if (![x, y, width, height].every((value) => typeof value === "number" && Number.isFinite(value))) return null;
    return { x: x as number, y: y as number, width: width as number, height: height as number };
  } catch {
    return null;
  }
}

export function getWidgetLayout(_width: number, height: number): "strip" | "stacked" {
  return height >= 132 ? "stacked" : "strip";
}

export function hexToRgbTriplet(hex: string): string {
  const normalized = normalizeHex(hex, DEFAULT_WIDGET_APPEARANCE.light.backgroundColor).slice(1);
  return [0, 2, 4].map((index) => Number.parseInt(normalized.slice(index, index + 2), 16)).join(" ");
}
