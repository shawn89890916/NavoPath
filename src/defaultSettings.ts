import type { Settings } from "./types";
import { DEFAULT_WIDGET_APPEARANCE, normalizeWidgetAppearance } from "./widget/widgetPreferences";
import { DEFAULT_WIDGET_TIMER_PREFERENCES, normalizeWidgetTimerPreferences } from "./widget/widgetTimer";

/**
 * Canonical NavoPath default settings.
 *
 * Used as the merge base by both the local preview store and the Supabase
 * profile store, and as the reset target by the Settings > Advanced
 * "Reset all settings" action. Keep this in sync with the merge logic in
 * `browserFallback.ts` and `supabasePlannerApi.ts` — both files retain their
 * own internal copies for now to avoid a larger refactor, but any new field
 * added to {@link Settings} should land here first.
 */
export const defaultSettings: Settings = {
  activeMode: "execute",
  defaultTimelineView: "daily",
  continuousCrossDayScroll: true,
  language: "en",
  planningView: "tree",
  metricsRangePreset: "today",
  metricsGroupBy: "project",
  metricsDisplayMetric: "percentage",
  metricsIncludeHabits: "include",
  metricsCompletionFilter: "all",
  aiDockOpen: false,
  appTitle: "NavoPath",
  model: "deepseek-ai/DeepSeek-V3.2",
  reasoningMode: "instant",
  baseUrl: "https://api.siliconflow.cn/v1/chat/completions",
  hasApiKey: false,
  apiKeyPreview: "",
  displayName: "NavoPath",
  avatarDataUrl: "",
  onboardingVersion: 2,
  onboardingStep: "done",
  dailyFocusTime: "20:00",
  weekStartsOn: 0,
  theme: "light",
  typographyStyle: "editorial",
  accentColor: "",
  executeAccentColor: "",
  planningAccentColor: "",
  aiTone: "direct",
  hideCompleted: false,
  reminderLeadDays: 7,
  taskNoteDisplay: "summary",
  glassEnabled: false,
  backgroundImagePath: "",
  glassBlur: 18,
  glassOpacity: 88,
  backgroundDim: 12,
  collapsedPanels: [],
  collapsedSections: [],
  panelWidths: { left: 360, right: 390 },
  chatMessageMaxHeight: 220,
  aiMemoryEnabled: true,
  hideAi: false,
  addAdvancedOpen: false,
  uiStyle: "gradient",
  dayStartTime: "00:00",
  scheduleDayStartTime: "08:00",
  dayEndTime: "22:00",
  scheduleBufferMinutes: 5,
  autoEstimateTaskDuration: true,
  autoAssignTaskProject: true,
  syncIntervalMinutes: 60,
  lastSyncedAt: undefined,
  idleThresholdMinutes: 5,
  focusModeDefault: "stopwatch",
  featureKanbanViewEnabled: false,
  featureQuadrantViewEnabled: false,
  featureListViewEnabled: false,
  featureHabitsEnabled: true,
  featureHabitCandidatesEnabled: true,
  featureTemplatesEnabled: true,
  featureMetricsEnabled: true,
  featureWidgetEnabled: true,
  widgetAlwaysOnTop: true,
  widgetOpenOnLaunch: false,
  compactWindowAlwaysOnTop: true,
  widgetAppearance: { ...DEFAULT_WIDGET_APPEARANCE },
  widgetTimerPreferences: { ...DEFAULT_WIDGET_TIMER_PREFERENCES },
  widgetAppearanceMigrated: false,
};

/**
 * Returns a fresh copy of the default settings. Use this when resetting user
 * settings back to factory defaults — never mutate the shared constant.
 */
export function getDefaultSettings(): Settings {
  return {
    ...defaultSettings,
    panelWidths: { ...defaultSettings.panelWidths },
    widgetAppearance: {
      ...DEFAULT_WIDGET_APPEARANCE,
      light: { ...DEFAULT_WIDGET_APPEARANCE.light },
      dark: { ...DEFAULT_WIDGET_APPEARANCE.dark },
    },
    widgetTimerPreferences: { ...DEFAULT_WIDGET_TIMER_PREFERENCES },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function allowedValue<T extends string | number>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(value as T) ? value as T : fallback;
}

/**
 * Migrates and validates persisted or imported settings against the canonical
 * defaults. Unknown keys are preserved for forward compatibility.
 */
export function normalizeSettings(value: unknown): Settings {
  const defaults = getDefaultSettings();
  const stored = isRecord(value) ? { ...value } : {};

  if (stored.executeAccentColor === "#C69CF9") stored.executeAccentColor = "";
  if (stored.planningAccentColor === "#CAFF72") stored.planningAccentColor = "";
  if (
    stored.model === "deepseek-v4-flash"
    || stored.model === "deepseek-chat"
    || (typeof stored.model === "string" && /^deepseek-ai\/DeepSeek-V4-(?:Flash|Pro)$/i.test(stored.model))
  ) {
    stored.model = defaults.model;
  }
  if (!stored.baseUrl || stored.baseUrl === "https://api.deepseek.com/chat/completions") {
    stored.baseUrl = defaults.baseUrl;
  }

  const normalized = { ...defaults, ...stored } as Record<string, unknown>;
  for (const [key, fallback] of Object.entries(defaults)) {
    if (typeof fallback === "boolean" && typeof normalized[key] !== "boolean") normalized[key] = fallback;
    if (typeof fallback === "number" && (typeof normalized[key] !== "number" || !Number.isFinite(normalized[key]))) {
      normalized[key] = fallback;
    }
    if (typeof fallback === "string" && typeof normalized[key] !== "string") normalized[key] = fallback;
  }

  normalized.activeMode = allowedValue(normalized.activeMode, ["execute", "planning"], defaults.activeMode);
  normalized.defaultTimelineView = allowedValue(normalized.defaultTimelineView, ["daily", "3day", "weekly", "month"], defaults.defaultTimelineView!);
  normalized.language = allowedValue(normalized.language, ["en", "zh"], defaults.language);
  normalized.planningView = allowedValue(normalized.planningView, ["tree", "matrix", "split"], defaults.planningView);
  normalized.metricsRangePreset = allowedValue(normalized.metricsRangePreset, ["all", "today", "yesterday", "thisWeek", "lastWeek", "thisMonth", "custom"], defaults.metricsRangePreset!);
  normalized.metricsGroupBy = allowedValue(normalized.metricsGroupBy, ["project", "customCategory", "tag", "importance", "urgency", "completion", "taskType"], defaults.metricsGroupBy!);
  normalized.metricsDisplayMetric = allowedValue(normalized.metricsDisplayMetric, ["percentage", "duration", "taskCount", "completionRate"], defaults.metricsDisplayMetric!);
  normalized.metricsIncludeHabits = allowedValue(normalized.metricsIncludeHabits, ["include", "exclude", "only"], defaults.metricsIncludeHabits!);
  normalized.metricsCompletionFilter = allowedValue(normalized.metricsCompletionFilter, ["all", "completed", "incomplete"], defaults.metricsCompletionFilter!);
  normalized.reasoningMode = allowedValue(normalized.reasoningMode, ["instant", "high", "xhigh"], defaults.reasoningMode);
  normalized.onboardingStep = allowedValue(normalized.onboardingStep, ["add", "drag", "candidates", "schedule", "calendar", "planning", "ai", "done"], defaults.onboardingStep!);
  normalized.weekStartsOn = allowedValue(normalized.weekStartsOn, [0, 1], defaults.weekStartsOn);
  normalized.theme = allowedValue(normalized.theme, ["light", "dark"], defaults.theme);
  normalized.typographyStyle = allowedValue(normalized.typographyStyle, ["editorial", "balanced", "sans"], defaults.typographyStyle);
  normalized.aiTone = allowedValue(normalized.aiTone, ["direct", "gentle", "strict"], defaults.aiTone);
  normalized.taskNoteDisplay = allowedValue(normalized.taskNoteDisplay, ["summary", "collapsed", "full"], defaults.taskNoteDisplay);
  normalized.uiStyle = allowedValue(normalized.uiStyle, ["gradient", "neumorphic"], defaults.uiStyle);
  normalized.focusModeDefault = allowedValue(normalized.focusModeDefault, ["stopwatch", "pomodoro", "flowtime"], defaults.focusModeDefault!);
  if (typeof normalized.syncIntervalMinutes !== "number" || normalized.syncIntervalMinutes < 0) {
    normalized.syncIntervalMinutes = defaults.syncIntervalMinutes;
  }

  normalized.collapsedPanels = Array.isArray(stored.collapsedPanels)
    ? stored.collapsedPanels.filter((item): item is string => typeof item === "string")
    : defaults.collapsedPanels;
  normalized.collapsedSections = Array.isArray(stored.collapsedSections)
    ? stored.collapsedSections.filter((item): item is string => typeof item === "string")
    : defaults.collapsedSections;
  normalized.enabledPlugins = Array.isArray(stored.enabledPlugins)
    ? stored.enabledPlugins.filter((item): item is string => typeof item === "string")
    : defaults.enabledPlugins;
  normalized.pluginConfigs = isRecord(stored.pluginConfigs) ? stored.pluginConfigs : defaults.pluginConfigs;

  const widths = isRecord(stored.panelWidths) ? stored.panelWidths : {};
  normalized.panelWidths = {
    left: typeof widths.left === "number" && Number.isFinite(widths.left) && widths.left > 0
      ? widths.left
      : defaults.panelWidths.left,
    right: typeof widths.right === "number" && Number.isFinite(widths.right) && widths.right > 0
      ? widths.right
      : defaults.panelWidths.right,
  };
  normalized.widgetAppearance = normalizeWidgetAppearance(
    isRecord(stored.widgetAppearance) ? stored.widgetAppearance : undefined,
  );
  normalized.widgetTimerPreferences = normalizeWidgetTimerPreferences(
    isRecord(stored.widgetTimerPreferences) ? stored.widgetTimerPreferences : undefined,
  );

  if (typeof stored.lastSyncedAt !== "string") normalized.lastSyncedAt = undefined;
  if (stored.timelineFontScale !== undefined) {
    normalized.timelineFontScale = typeof stored.timelineFontScale === "number" && Number.isFinite(stored.timelineFontScale)
      ? Math.min(1.3, Math.max(0.85, stored.timelineFontScale))
      : undefined;
  }
  if (stored.metricsCustomStart !== undefined && typeof stored.metricsCustomStart !== "string") normalized.metricsCustomStart = undefined;
  if (stored.metricsCustomEnd !== undefined && typeof stored.metricsCustomEnd !== "string") normalized.metricsCustomEnd = undefined;

  return normalized as unknown as Settings;
}
