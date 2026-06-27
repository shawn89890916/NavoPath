/**
 * Built-in NavoPath plugins.
 *
 * These ship with the app so the marketplace is never empty, and they exercise
 * every part of the plugin contract (config fields, lifecycle hooks, host API).
 */

import {
  type NavoPlugin,
  type PluginHost,
  activate,
  register,
  resolveConfig,
} from "./registry";

/** Pomodoro Timer — tracks work/break intervals against the focused task. */
const pomodoroPlugin: NavoPlugin = {
  id: "pomodoro",
  name: "Pomodoro Timer",
  nameI18n: { zh: "番茄钟", en: "Pomodoro Timer" },
  description:
    "Run 25/5 focus cycles with desktop notifications. The timer is local-only — no network calls.",
  descriptionI18n: {
    zh: "运行本地专注/休息循环，不请求外部网络。适合把当前任务推进一段固定时间。",
    en: "Run local focus and break cycles. It stays inside NavoPath and makes a timer panel available after enabling.",
  },
  enabledSummaryI18n: {
    zh: "启用后会在下方显示可直接开始、暂停和重置的番茄钟面板。",
    en: "After enabling, a start/pause/reset timer appears in the enabled tools area.",
  },
  version: "1.0.0",
  author: "NavoPath Team",
  icon: "P",
  permissions: ["tasks", "ui"],
  configFields: [
    { key: "focusMinutes", label: "Focus minutes", labelI18n: { zh: "专注分钟数", en: "Focus minutes" }, type: "number", min: 5, max: 90, default: 25 },
    { key: "breakMinutes", label: "Break minutes", labelI18n: { zh: "休息分钟数", en: "Break minutes" }, type: "number", min: 1, max: 30, default: 5 },
    {
      key: "autoStartBreak",
      label: "Auto start break",
      labelI18n: { zh: "自动开始休息", en: "Auto start break" },
      type: "boolean",
      default: true,
    },
  ],
  onActivate: (host: PluginHost, config) => {
    const focus = Number(config.focusMinutes) || 25;
    host.toast(`Pomodoro ready: ${focus} min focus cycle.`);
  },
  onDeactivate: (host) => {
    host.toast("Pomodoro stopped.");
  },
};

/** Habit Tracker — surfaces a simple daily-checkin panel. */
const habitTrackerPlugin: NavoPlugin = {
  id: "habit-tracker",
  name: "Habit Tracker",
  nameI18n: { zh: "习惯打卡", en: "Habit Tracker" },
  description:
    "Mark daily habits done and keep a local streak counter. Habits are stored in plugin config.",
  descriptionI18n: {
    zh: "在 NavoPath 内记录每日习惯完成情况，习惯列表和打卡数据保存在本地设置中。",
    en: "Mark daily habits done and keep local check-ins in plugin config.",
  },
  enabledSummaryI18n: {
    zh: "启用后会出现今日习惯清单；可在配置里一行一个习惯。",
    en: "After enabling, today's habit checklist appears; configure one habit per line.",
  },
  version: "1.2.0",
  author: "Community",
  icon: "H",
  permissions: ["tasks", "settings"],
  configFields: [
    { key: "habits", label: "Habit list (one per line)", labelI18n: { zh: "习惯列表（一行一个）", en: "Habit list (one per line)" }, type: "string", default: "" },
    {
      key: "reminderHour",
      label: "Daily reminder hour",
      labelI18n: { zh: "每日提醒小时", en: "Daily reminder hour" },
      type: "number",
      min: 0,
      max: 23,
      default: 9,
    },
  ],
  onActivate: (host) => {
    host.toast("Habit Tracker active.");
  },
};

/** Weather Info — placeholder that demonstrates config + events. */
const weatherPlugin: NavoPlugin = {
  id: "weather",
  name: "Weather Info",
  nameI18n: { zh: "天气徽章", en: "Weather Info" },
  description:
    "Display a small weather badge. The default city can be customised; no API key is required for the placeholder badge.",
  descriptionI18n: {
    zh: "显示一个本地预览天气徽章。城市和单位可配置，不需要外部 API Key。",
    en: "Display a local preview weather badge with configurable city and units.",
  },
  enabledSummaryI18n: {
    zh: "启用后会显示城市、温度和天气状态的本地预览徽章。",
    en: "After enabling, a local city, temperature, and condition badge appears.",
  },
  version: "0.9.0",
  author: "NavoPath Team",
  icon: "W",
  permissions: ["ui"],
  configFields: [
    { key: "city", label: "City", labelI18n: { zh: "城市", en: "City" }, type: "string", default: "Shanghai" },
    {
      key: "units",
      label: "Units",
      labelI18n: { zh: "温度单位", en: "Units" },
      type: "select",
      options: [
        { value: "c", label: "Celsius", labelI18n: { zh: "摄氏度", en: "Celsius" } },
        { value: "f", label: "Fahrenheit", labelI18n: { zh: "华氏度", en: "Fahrenheit" } },
      ],
      default: "c",
    },
  ],
  onActivate: (host, config) => {
    host.toast(`Weather badge: ${config.city}`);
  },
};

/** Notes Enhanced — enables a richer notes editor for tasks. */
const notesPlugin: NavoPlugin = {
  id: "notes",
  name: "Notes Enhanced",
  nameI18n: { zh: "任务笔记", en: "Notes Enhanced" },
  description:
    "Attach a markdown-capable note panel to each task. Notes are stored with the task's own `notes` field.",
  descriptionI18n: {
    zh: "为任务提供一个快速笔记面板，内容保存到任务自己的 notes 字段。",
    en: "Attach a quick notes panel to tasks and save content to each task's notes field.",
  },
  enabledSummaryI18n: {
    zh: "启用后可以在插件工具区快速选择任务并编辑它的笔记。",
    en: "After enabling, choose a task and edit its notes from the plugin tools area.",
  },
  version: "2.1.0",
  author: "Community",
  icon: "N",
  permissions: ["tasks", "ui"],
  configFields: [
    {
      key: "enableMarkdown",
      label: "Enable markdown rendering",
      labelI18n: { zh: "启用 Markdown 渲染", en: "Enable markdown rendering" },
      type: "boolean",
      default: true,
    },
    {
      key: "autoSave",
      label: "Auto-save (ms)",
      labelI18n: { zh: "自动保存间隔（毫秒）", en: "Auto-save (ms)" },
      type: "number",
      min: 200,
      max: 5000,
      default: 800,
    },
  ],
  onActivate: (host) => {
    host.toast("Notes Enhanced loaded.");
  },
};

const BUILTIN_PLUGINS: NavoPlugin[] = [
  pomodoroPlugin,
  habitTrackerPlugin,
  weatherPlugin,
  notesPlugin,
];

let registered = false;

/** Register every built-in plugin with the global registry. Idempotent. */
export function registerBuiltinPlugins(): void {
  if (registered) return;
  registered = true;
  for (const plugin of BUILTIN_PLUGINS) {
    register(plugin);
  }
}

export { BUILTIN_PLUGINS };

/** Convenience helper used by tests and the host bootstrap. */
export function bootstrapPlugins(
  enabledIds: string[] | undefined,
  host: PluginHost,
  configs: Record<string, Record<string, unknown>> | undefined,
): { activated: string[]; failed: string[] } {
  registerBuiltinPlugins();
  const activated: string[] = [];
  const failed: string[] = [];
  for (const id of enabledIds ?? []) {
    const plugin = BUILTIN_PLUGINS.find((p) => p.id === id);
    if (!plugin) {
      failed.push(id);
      continue;
    }
    const ok = activate(id, host, resolveConfig(plugin, configs?.[id]));
    if (ok) activated.push(id);
    else failed.push(id);
  }
  return { activated, failed };
}
