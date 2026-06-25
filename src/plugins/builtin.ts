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
  description:
    "Run 25/5 focus cycles with desktop notifications. The timer is local-only — no network calls.",
  version: "1.0.0",
  author: "NavoPath Team",
  icon: "🍅",
  permissions: ["tasks", "ui"],
  configFields: [
    { key: "focusMinutes", label: "Focus minutes", type: "number", min: 5, max: 90, default: 25 },
    { key: "breakMinutes", label: "Break minutes", type: "number", min: 1, max: 30, default: 5 },
    {
      key: "autoStartBreak",
      label: "Auto start break",
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
  description:
    "Mark daily habits done and keep a local streak counter. Habits are stored in plugin config.",
  version: "1.2.0",
  author: "Community",
  icon: "✅",
  permissions: ["tasks", "settings"],
  configFields: [
    { key: "habits", label: "Habit list (one per line)", type: "string", default: "" },
    {
      key: "reminderHour",
      label: "Daily reminder hour",
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
  description:
    "Display a small weather badge. The default city can be customised; no API key is required for the placeholder badge.",
  version: "0.9.0",
  author: "NavoPath Team",
  icon: "🌤️",
  permissions: ["ui"],
  configFields: [
    { key: "city", label: "City", type: "string", default: "Shanghai" },
    {
      key: "units",
      label: "Units",
      type: "select",
      options: [
        { value: "c", label: "Celsius" },
        { value: "f", label: "Fahrenheit" },
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
  description:
    "Attach a markdown-capable note panel to each task. Notes are stored with the task's own `notes` field.",
  version: "2.1.0",
  author: "Community",
  icon: "📝",
  permissions: ["tasks", "ui"],
  configFields: [
    {
      key: "enableMarkdown",
      label: "Enable markdown rendering",
      type: "boolean",
      default: true,
    },
    {
      key: "autoSave",
      label: "Auto-save (ms)",
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
