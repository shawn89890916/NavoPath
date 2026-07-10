import type { WidgetAppearance, WidgetBounds } from "../types";

export const WIDGET_APPEARANCE_VERSION = 1;
export const WIDGET_MIN_WIDTH = 360;
export const WIDGET_MAX_WIDTH = 860;
export const WIDGET_MIN_HEIGHT = 84;
export const WIDGET_MENU_MIN_HEIGHT = 320;
const WINDOW_MARGIN = 6;

export const DEFAULT_WIDGET_APPEARANCE: WidgetAppearance = {
  backgroundColor: "#FBF9FF",
  fontColor: "#27231E",
  accentColor: "#27231E",
  opacity: 0.96,
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
  return Math.min(1, Math.max(0.35, parsed));
}

export function normalizeWidgetAppearance(value?: Partial<WidgetAppearance> | null): WidgetAppearance {
  return {
    backgroundColor: normalizeHex(value?.backgroundColor, DEFAULT_WIDGET_APPEARANCE.backgroundColor),
    fontColor: normalizeHex(value?.fontColor, DEFAULT_WIDGET_APPEARANCE.fontColor),
    accentColor: normalizeHex(value?.accentColor, DEFAULT_WIDGET_APPEARANCE.accentColor),
    opacity: normalizeOpacity(value?.opacity),
    version: WIDGET_APPEARANCE_VERSION,
  };
}

export function migrateLegacyWidgetAppearance(raw: string | null, currentVersion = 0): WidgetAppearance | null {
  if (!raw || currentVersion >= WIDGET_APPEARANCE_VERSION) return null;
  try {
    return normalizeWidgetAppearance(JSON.parse(raw) as Partial<WidgetAppearance>);
  } catch {
    return null;
  }
}

export function getWidgetMaxHeight(workAreaHeight: number): number {
  return Math.max(WIDGET_MENU_MIN_HEIGHT, Math.round(workAreaHeight * 0.7));
}

export function clampWidgetBounds(bounds: WidgetBounds, workArea: WidgetBounds): WidgetBounds {
  const safeX = Number.isFinite(bounds.x) ? bounds.x : workArea.x;
  const safeY = Number.isFinite(bounds.y) ? bounds.y : workArea.y;
  const safeWidth = Number.isFinite(bounds.width) ? bounds.width : 620;
  const safeHeight = Number.isFinite(bounds.height) ? bounds.height : 100;
  const maxWidth = Math.min(WIDGET_MAX_WIDTH, Math.max(WIDGET_MIN_WIDTH, workArea.width - WINDOW_MARGIN * 2));
  const maxHeight = Math.min(getWidgetMaxHeight(workArea.height), Math.max(WIDGET_MIN_HEIGHT, workArea.height - WINDOW_MARGIN * 2));
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

export function getExpandedWidgetBounds(
  current: WidgetBounds,
  workArea: WidgetBounds,
  minimumHeight = WIDGET_MENU_MIN_HEIGHT,
): { bounds: WidgetBounds; autoExpanded: boolean; previousHeight: number } {
  if (current.height >= minimumHeight) {
    return { bounds: clampWidgetBounds(current, workArea), autoExpanded: false, previousHeight: current.height };
  }
  return {
    bounds: clampWidgetBounds({ ...current, height: minimumHeight }, workArea),
    autoExpanded: true,
    previousHeight: current.height,
  };
}

export function getWidgetLayout(width: number, height: number): "strip" | "stacked" {
  return width >= 520 && height < 140 ? "strip" : "stacked";
}

export function hexToRgbTriplet(hex: string): string {
  const normalized = normalizeHex(hex, DEFAULT_WIDGET_APPEARANCE.backgroundColor).slice(1);
  return [0, 2, 4].map((index) => Number.parseInt(normalized.slice(index, index + 2), 16)).join(" ");
}
