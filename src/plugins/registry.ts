/**
 * NavoPath Plugin System
 * ----------------------
 * Lightweight registry for built-in plugins and validated external metadata.
 * Built-ins may declare lifecycle hooks; external entries contribute metadata
 * and configuration fields only.
 *
 * Plugins are pure functions over the app state — they cannot run arbitrary code
 * from disk (no dynamic imports / no remote scripts) which keeps the Electron
 * build secure and CSP-compliant. The host decides how to surface a plugin's
 * contribution to the UI (status badge, action button, settings panel, …).
 *
 * Registration flow:
 *   1. registry.register(plugin)            // declare available plugin
 *   2. host reads settings.enabledPlugins    // user toggled ids
 *   3. registry.activate(id, host)            // run lifecycle hook
 *   4. registry.deactivate(id)               // cleanup on uninstall
 *
 * The registry is intentionally synchronous and side-effect free until
 * `activate` is called — this makes it easy to test.
 */

export type PluginPermission = "tasks" | "settings" | "ui" | "events" | "calendar";

export interface PluginHost {
  /** Read the current planner data (tasks, events, ...). */
  getData: () => unknown;
  /** Replace planner data. Built-in plugin implementations should call this sparingly. */
  saveData?: (next: unknown) => void;
  /** Patch a single plugin's config in settings. */
  savePluginConfig: (pluginId: string, patch: Record<string, unknown>) => void;
  /** Emit an arbitrary event other plugins can listen to. */
  emit: (event: string, payload?: unknown) => void;
  /** Show a transient toast message to the user. */
  toast: (message: string) => void;
}

export type LocalizedText = Partial<Record<"zh" | "en", string>>;

export interface PluginConfigField {
  key: string;
  label: string;
  labelI18n?: LocalizedText;
  type: "boolean" | "number" | "string" | "select";
  options?: { value: string; label: string; labelI18n?: LocalizedText }[];
  min?: number;
  max?: number;
  default: unknown;
}

export interface NavoPlugin {
  /** Stable unique id, lowercase kebab-case. */
  id: string;
  /** External entries contribute validated metadata and config only. */
  source?: "builtin" | "external";
  name: string;
  nameI18n?: LocalizedText;
  description: string;
  descriptionI18n?: LocalizedText;
  enabledSummaryI18n?: LocalizedText;
  version: string;
  author: string;
  icon: string;
  /** Declares which capabilities the plugin may touch. */
  permissions: PluginPermission[];
  /** Schema describing config fields shown in the Configure dialog. */
  configFields: PluginConfigField[];
  /** Called once when a built-in plugin is activated (install or enable). */
  onActivate?: (host: PluginHost, config: Record<string, unknown>) => void;
  /** Called when a built-in plugin is deactivated (uninstall or disable). */
  onDeactivate?: (host: PluginHost) => void;
}

const registry = new Map<string, NavoPlugin>();
const activePlugins = new Set<string>();

export function register(plugin: NavoPlugin): void {
  if (registry.has(plugin.id)) {
    // Idempotent — re-registering replaces the previous definition.
  }
  registry.set(plugin.id, plugin);
}

export function listPlugins(): NavoPlugin[] {
  return Array.from(registry.values());
}

export function getPlugin(id: string): NavoPlugin | undefined {
  return registry.get(id);
}

export function isActive(id: string): boolean {
  return activePlugins.has(id);
}

/** Merge a plugin's config fields with stored config, applying defaults. */
export function resolveConfig(
  plugin: NavoPlugin,
  stored?: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of plugin.configFields) {
    const has = stored && Object.prototype.hasOwnProperty.call(stored, field.key);
    result[field.key] = has ? (stored as Record<string, unknown>)[field.key] : field.default;
  }
  return result;
}

export function pluginText(
  text: string,
  localized: LocalizedText | undefined,
  lang: "zh" | "en",
): string {
  return localized?.[lang] || localized?.en || text;
}

/** Activate a plugin by id. Returns false if plugin unknown or already active. */
export function activate(id: string, host: PluginHost, config?: Record<string, unknown>): boolean {
  const plugin = registry.get(id);
  if (!plugin) return false;
  if (activePlugins.has(id)) return false;
  try {
    plugin.onActivate?.(host, resolveConfig(plugin, config));
    activePlugins.add(id);
    return true;
  } catch (err) {
    console.warn(`[plugins] activate failed for ${id}:`, err);
    return false;
  }
}

/** Deactivate a plugin by id. Returns false if plugin was not active. */
export function deactivate(id: string, host: PluginHost): boolean {
  const plugin = registry.get(id);
  if (!plugin) return false;
  if (!activePlugins.has(id)) return false;
  try {
    plugin.onDeactivate?.(host);
  } catch (err) {
    console.warn(`[plugins] deactivate failed for ${id}:`, err);
  }
  activePlugins.delete(id);
  return true;
}

/** Deactivate every currently-active plugin. Used on app shutdown. */
export function deactivateAll(host: PluginHost): void {
  for (const id of Array.from(activePlugins)) {
    void deactivate(id, host);
  }
}
