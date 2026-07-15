import type { Settings } from "./types";
import { DEFAULT_WIDGET_APPEARANCE } from "./widget/widgetPreferences";
import { DEFAULT_WIDGET_TIMER_PREFERENCES } from "./widget/widgetTimer";

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
