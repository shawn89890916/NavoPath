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
  model: "deepseek-ai/DeepSeek-V4-Flash",
  reasoningMode: "instant",
  aiSafetyLevel: "standard",
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
  aiBriefsEnabled: false,
  aiStartBriefTime: "08:00",
  aiEndBriefTime: "21:30",
  proactiveAssistantEnabled: true,
  proactiveAssistantIntroSeen: false,
  proactiveAssistantAutoAdjust: true,
  proactiveAssistantGapChecks: true,
  proactiveAssistantGapThresholdMinutes: 30,
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

const MAX_ENABLED_PLUGINS = 100;
const MAX_PLUGIN_ID_SCAN = 1_000;
const MAX_PLUGIN_CONFIGS = 100;
const MAX_PLUGIN_CONFIG_SCAN = 500;
const MAX_PLUGIN_CONFIG_DEPTH = 8;
const MAX_PLUGIN_CONFIG_NODES = 50_000;
const MAX_PLUGIN_CONFIG_OBJECT_KEYS = 5_000;
const MAX_PLUGIN_CONFIG_ARRAY_ITEMS = 5_000;
const MAX_PLUGIN_CONFIG_STRING_LENGTH = 10_000;
const MAX_COLLAPSED_SETTING_ITEMS = 100;
const MAX_COLLAPSED_SETTING_SCAN = 1_000;
const MAX_COLLAPSED_SETTING_ID_LENGTH = 100;
const MAX_AVATAR_DATA_URL_LENGTH = 512 * 1024;
const OMIT_PLUGIN_CONFIG_VALUE = Symbol("omit-plugin-config-value");
const unsafeStorageKeys = new Set(["__proto__", "prototype", ...Object.getOwnPropertyNames(Object.prototype)]);

function isSafePluginId(value: string): boolean {
  return /^[a-zA-Z0-9_.-]{1,80}$/.test(value) && !unsafeStorageKeys.has(value);
}

function isSafePluginConfigKey(value: string): boolean {
  return value.length > 0 && value.length <= 100 && !unsafeStorageKeys.has(value);
}

function normalizeEnabledPlugins(value: unknown[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  const limit = Math.min(value.length, MAX_PLUGIN_ID_SCAN);
  for (let index = 0; index < limit && result.length < MAX_ENABLED_PLUGINS; index += 1) {
    const id = value[index];
    if (typeof id !== "string" || !isSafePluginId(id) || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

function sanitizePluginConfigValue(
  value: unknown,
  depth: number,
  budget: { nodes: number },
  ancestors: WeakSet<object>,
): unknown {
  if (budget.nodes >= MAX_PLUGIN_CONFIG_NODES) return OMIT_PLUGIN_CONFIG_VALUE;
  budget.nodes += 1;
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return typeof value === "string" ? value.slice(0, MAX_PLUGIN_CONFIG_STRING_LENGTH) : value;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : OMIT_PLUGIN_CONFIG_VALUE;
  if (depth >= MAX_PLUGIN_CONFIG_DEPTH || !value || typeof value !== "object" || ancestors.has(value)) {
    return OMIT_PLUGIN_CONFIG_VALUE;
  }

  ancestors.add(value);
  if (Array.isArray(value)) {
    const result: unknown[] = [];
    const limit = Math.min(value.length, MAX_PLUGIN_CONFIG_ARRAY_ITEMS);
    for (let index = 0; index < limit; index += 1) {
      const sanitized = sanitizePluginConfigValue(value[index], depth + 1, budget, ancestors);
      if (sanitized !== OMIT_PLUGIN_CONFIG_VALUE) result.push(sanitized);
    }
    ancestors.delete(value);
    return result;
  }
  if (!isRecord(value)) {
    ancestors.delete(value);
    return OMIT_PLUGIN_CONFIG_VALUE;
  }

  const result: Record<string, unknown> = {};
  let inspected = 0;
  for (const key in value) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    inspected += 1;
    if (inspected > MAX_PLUGIN_CONFIG_OBJECT_KEYS) break;
    if (!isSafePluginConfigKey(key)) continue;
    const sanitized = sanitizePluginConfigValue(value[key], depth + 1, budget, ancestors);
    if (sanitized !== OMIT_PLUGIN_CONFIG_VALUE) result[key] = sanitized;
  }
  ancestors.delete(value);
  return result;
}

function normalizePluginConfigs(value: Record<string, unknown>): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {};
  const budget = { nodes: 0 };
  let inspected = 0;
  let accepted = 0;
  for (const pluginId in value) {
    if (!Object.prototype.hasOwnProperty.call(value, pluginId)) continue;
    inspected += 1;
    if (inspected > MAX_PLUGIN_CONFIG_SCAN || accepted >= MAX_PLUGIN_CONFIGS) break;
    if (!isSafePluginId(pluginId) || !isRecord(value[pluginId])) continue;
    const sanitized = sanitizePluginConfigValue(value[pluginId], 0, budget, new WeakSet<object>());
    if (!isRecord(sanitized)) continue;
    result[pluginId] = sanitized;
    accepted += 1;
  }
  return result;
}

function boundedString(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, maxLength) || fallback;
}

function normalizeAvatarDataUrl(value: unknown): string {
  if (typeof value !== "string" || value.length > MAX_AVATAR_DATA_URL_LENGTH) return "";
  return /^data:image\/(?:jpeg|png|webp);base64,[a-zA-Z0-9+/]+={0,2}$/i.test(value) ? value : "";
}

function normalizeCollapsedSettingIds(value: unknown[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  const limit = Math.min(value.length, MAX_COLLAPSED_SETTING_SCAN);
  for (let index = 0; index < limit && result.length < MAX_COLLAPSED_SETTING_ITEMS; index += 1) {
    const item = value[index];
    if (typeof item !== "string") continue;
    const id = item.trim().slice(0, MAX_COLLAPSED_SETTING_ID_LENGTH);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
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
    || (typeof stored.model === "string" && /^(?:deepseek-ai\/DeepSeek-(?:V3\.2|R1)|Qwen\/Qwen3\.5-|zai-org\/GLM-4\.6|moonshotai\/Kimi-K2\.7$|MiniMaxAI\/MiniMax-M3)/i.test(stored.model))
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
  normalized.aiSafetyLevel = allowedValue(normalized.aiSafetyLevel, ["standard", "strict", "readonly"], defaults.aiSafetyLevel);
  normalized.onboardingStep = allowedValue(normalized.onboardingStep, ["add", "drag", "candidates", "schedule", "calendar", "planning", "ai", "done"], defaults.onboardingStep!);
  normalized.weekStartsOn = allowedValue(normalized.weekStartsOn, [0, 1], defaults.weekStartsOn);
  normalized.theme = allowedValue(normalized.theme, ["light", "dark"], defaults.theme);
  normalized.typographyStyle = allowedValue(normalized.typographyStyle, ["editorial", "balanced", "sans"], defaults.typographyStyle);
  normalized.aiTone = allowedValue(normalized.aiTone, ["direct", "gentle", "strict"], defaults.aiTone);
  normalized.taskNoteDisplay = allowedValue(normalized.taskNoteDisplay, ["summary", "collapsed", "full"], defaults.taskNoteDisplay);
  normalized.uiStyle = allowedValue(normalized.uiStyle, ["gradient", "neumorphic"], defaults.uiStyle);
  normalized.focusModeDefault = allowedValue(normalized.focusModeDefault, ["stopwatch", "pomodoro", "flowtime"], defaults.focusModeDefault!);
  normalized.appTitle = boundedString(stored.appTitle, defaults.appTitle, 120);
  normalized.displayName = boundedString(stored.displayName, defaults.displayName, 64);
  normalized.avatarDataUrl = normalizeAvatarDataUrl(stored.avatarDataUrl);
  normalized.model = boundedString(stored.model, defaults.model, 200);
  normalized.baseUrl = boundedString(stored.baseUrl, defaults.baseUrl, 2_048);
  normalized.backgroundImagePath = boundedString(stored.backgroundImagePath, defaults.backgroundImagePath, 4_096);
  normalized.accentColor = boundedString(stored.accentColor, defaults.accentColor, 64);
  normalized.executeAccentColor = boundedString(stored.executeAccentColor, defaults.executeAccentColor, 64);
  normalized.planningAccentColor = boundedString(stored.planningAccentColor, defaults.planningAccentColor, 64);
  normalized.hasApiKey = false;
  normalized.apiKeyPreview = "";
  normalized.aiStartBriefTime = typeof stored.aiStartBriefTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(stored.aiStartBriefTime)
    ? stored.aiStartBriefTime
    : defaults.aiStartBriefTime;
  normalized.aiEndBriefTime = typeof stored.aiEndBriefTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(stored.aiEndBriefTime)
    ? stored.aiEndBriefTime
    : defaults.aiEndBriefTime;
  normalized.proactiveAssistantGapThresholdMinutes = typeof stored.proactiveAssistantGapThresholdMinutes === "number" && Number.isFinite(stored.proactiveAssistantGapThresholdMinutes)
    ? Math.max(15, Math.min(180, Math.round(stored.proactiveAssistantGapThresholdMinutes / 15) * 15))
    : defaults.proactiveAssistantGapThresholdMinutes;
  const location = isRecord(stored.proactiveAssistantLocation) ? stored.proactiveAssistantLocation : null;
  normalized.proactiveAssistantLocation = location
    && typeof location.latitude === "number" && Number.isFinite(location.latitude) && Math.abs(location.latitude) <= 90
    && typeof location.longitude === "number" && Number.isFinite(location.longitude) && Math.abs(location.longitude) <= 180
    && typeof location.capturedAt === "string"
    ? { latitude: location.latitude, longitude: location.longitude, capturedAt: location.capturedAt }
    : undefined;
  if (typeof normalized.syncIntervalMinutes !== "number" || normalized.syncIntervalMinutes < 0) {
    normalized.syncIntervalMinutes = defaults.syncIntervalMinutes;
  }

  normalized.collapsedPanels = Array.isArray(stored.collapsedPanels)
    ? normalizeCollapsedSettingIds(stored.collapsedPanels)
    : defaults.collapsedPanels;
  normalized.collapsedSections = Array.isArray(stored.collapsedSections)
    ? normalizeCollapsedSettingIds(stored.collapsedSections)
    : defaults.collapsedSections;
  normalized.enabledPlugins = Array.isArray(stored.enabledPlugins)
    ? normalizeEnabledPlugins(stored.enabledPlugins)
    : defaults.enabledPlugins;
  normalized.pluginConfigs = isRecord(stored.pluginConfigs)
    ? normalizePluginConfigs(stored.pluginConfigs)
    : defaults.pluginConfigs;

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
  if (typeof stored.aiLastStartBriefDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(stored.aiLastStartBriefDate)) normalized.aiLastStartBriefDate = undefined;
  if (typeof stored.aiLastEndReviewDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(stored.aiLastEndReviewDate)) normalized.aiLastEndReviewDate = undefined;
  if (stored.timelineFontScale !== undefined) {
    normalized.timelineFontScale = typeof stored.timelineFontScale === "number" && Number.isFinite(stored.timelineFontScale)
      ? Math.min(1.3, Math.max(0.85, stored.timelineFontScale))
      : undefined;
  }
  if (stored.metricsCustomStart !== undefined && typeof stored.metricsCustomStart !== "string") normalized.metricsCustomStart = undefined;
  if (stored.metricsCustomEnd !== undefined && typeof stored.metricsCustomEnd !== "string") normalized.metricsCustomEnd = undefined;

  return normalized as unknown as Settings;
}
