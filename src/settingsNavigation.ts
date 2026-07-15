import type { Language } from "./types";

export type SettingsCategory = "general" | "appearance" | "workflow" | "account-data" | "advanced";
export type SettingsDetail = "ai" | "widget" | "integrations" | "recovery";

export type LegacySettingsSection =
  | "general"
  | "appearance"
  | "execution"
  | "planning"
  | "templates"
  | "habits"
  | "metrics"
  | "widget"
  | "data"
  | "shortcuts"
  | "ai"
  | "mcp"
  | "plugins"
  | "account"
  | "advanced"
  | "page"
  | "features";

export interface SettingsTarget {
  category: SettingsCategory;
  detail?: SettingsDetail;
  anchor?: string;
}

export type SettingsTargetInput = SettingsTarget | LegacySettingsSection | undefined;

export interface SettingsCategoryDefinition {
  id: SettingsCategory;
  labelZh: string;
  labelEn: string;
}

export const SETTINGS_CATEGORIES: readonly SettingsCategoryDefinition[] = [
  { id: "general", labelZh: "通用", labelEn: "General" },
  { id: "appearance", labelZh: "外观", labelEn: "Appearance" },
  { id: "workflow", labelZh: "工作流", labelEn: "Workflow" },
  { id: "account-data", labelZh: "账户与数据", labelEn: "Account & Data" },
  { id: "advanced", labelZh: "高级", labelEn: "Advanced" },
];

const legacyTargets: Record<LegacySettingsSection, SettingsTarget> = {
  general: { category: "general" },
  appearance: { category: "appearance" },
  execution: { category: "general", anchor: "execution-defaults" },
  planning: { category: "workflow", anchor: "planning-views" },
  templates: { category: "workflow", anchor: "templates" },
  habits: { category: "workflow", anchor: "habits" },
  metrics: { category: "workflow", anchor: "metrics" },
  widget: { category: "advanced", detail: "widget" },
  data: { category: "account-data", anchor: "data-backup" },
  shortcuts: { category: "general", anchor: "shortcuts" },
  ai: { category: "advanced", detail: "ai" },
  mcp: { category: "advanced", detail: "integrations", anchor: "mcp" },
  plugins: { category: "advanced", detail: "integrations", anchor: "plugins" },
  account: { category: "account-data", anchor: "account" },
  advanced: { category: "advanced" },
  page: { category: "general" },
  features: { category: "workflow", anchor: "planning-views" },
};

export function normalizeSettingsTarget(input?: SettingsTargetInput): SettingsTarget {
  if (!input) return { category: "general" };
  if (typeof input === "string") return legacyTargets[input] ?? { category: "general" };
  if (!SETTINGS_CATEGORIES.some((category) => category.id === input.category)) return { category: "general" };
  if (input.detail && !["ai", "widget", "integrations", "recovery"].includes(input.detail)) {
    return { category: input.category, anchor: input.anchor };
  }
  return { category: input.category, detail: input.detail, anchor: input.anchor };
}

export function settingsCategoryLabel(category: SettingsCategory, lang: Language): string {
  const definition = SETTINGS_CATEGORIES.find((item) => item.id === category) ?? SETTINGS_CATEGORIES[0];
  return lang === "zh" ? definition.labelZh : definition.labelEn;
}

export function settingsDetailLabel(detail: SettingsDetail, lang: Language): string {
  const labels: Record<SettingsDetail, [string, string]> = {
    ai: ["Navo AI", "Navo AI"],
    widget: ["桌面窗口", "Desktop Windows"],
    integrations: ["插件与 MCP", "Plugins & MCP"],
    recovery: ["恢复与重置", "Recovery & Reset"],
  };
  return labels[detail][lang === "zh" ? 0 : 1];
}

export interface SettingsSearchEntry {
  id: string;
  target: SettingsTarget;
  labelZh: string;
  labelEn: string;
  descriptionZh?: string;
  descriptionEn?: string;
  keywords?: string;
}

const entry = (
  id: string,
  target: SettingsTarget,
  labelZh: string,
  labelEn: string,
  keywords = "",
  descriptionZh = "",
  descriptionEn = "",
): SettingsSearchEntry => ({ id, target: { ...target, anchor: target.anchor ?? id }, labelZh, labelEn, keywords, descriptionZh, descriptionEn });

export const SETTINGS_SEARCH_ENTRIES: readonly SettingsSearchEntry[] = [
  entry("language", { category: "general" }, "语言", "Language", "中文 English locale"),
  entry("day-start", { category: "general" }, "一天开始时间", "Day start time", "timeline boundary 跨天"),
  entry("default-page", { category: "general" }, "默认打开页面", "Default page", "启动 执行 规划 execution planning"),
  entry("default-timeline", { category: "general" }, "默认时间轴视图", "Default timeline view", "day 3-day week month 日 周 月"),
  entry("continuous-scroll", { category: "general" }, "开启无限跨天滚动", "Continuous cross-day scroll", "timeline"),
  entry("focus-mode", { category: "general" }, "默认专注模式", "Default focus mode", "timer stopwatch pomodoro flowtime 计时"),
  entry("idle-threshold", { category: "general" }, "空闲阈值", "Idle threshold", "auto pause 自动暂停"),
  entry("hide-completed", { category: "general" }, "隐藏已完成任务", "Hide completed tasks", "timeline 时间轴"),
  entry("shortcuts", { category: "general" }, "快捷键", "Shortcuts", "keyboard hotkeys help 帮助"),
  entry("restart-onboarding", { category: "general" }, "重新开始新手指南", "Restart onboarding guide", "tutorial 引导"),

  entry("theme", { category: "appearance" }, "界面模式", "Interface mode", "light dark 浅色 深色 主题"),
  entry("typography", { category: "appearance" }, "字体风格", "Typography", "serif sans 衬线 无衬线"),
  entry("timeline-font", { category: "appearance" }, "时间轴字体大小", "Timeline font size", "scale 字号"),
  entry("task-block-fill", { category: "appearance" }, "任务块颜色填充", "Fill task block with project color", "project color 项目色"),
  entry("accent-colors", { category: "appearance" }, "自定义点缀色", "Customize accent colors", "execute planning color 强调色"),

  entry("planning-views", { category: "workflow" }, "规划视图", "Planning views", "kanban matrix list 看板 四象限 列表"),
  entry("schedule-start", { category: "workflow" }, "规划开始", "Planning starts", "AI schedule 排程"),
  entry("schedule-end", { category: "workflow" }, "规划结束", "Planning ends", "AI schedule 排程"),
  entry("schedule-buffer", { category: "workflow" }, "任务缓冲", "Task buffer", "minutes AI schedule 间隔 排程"),
  entry("templates", { category: "workflow" }, "模板", "Templates", "schedule template 时间段"),
  entry("habits", { category: "workflow" }, "习惯", "Habits", "candidate metrics 每日 每周"),
  entry("metrics", { category: "workflow" }, "指标", "Metrics", "range grouping completion 统计 范围 分组 完成"),

  entry("account", { category: "account-data" }, "个人资料与账户", "Profile & account", "avatar name plan subscription 头像 用户名 方案"),
  entry("sync", { category: "account-data" }, "同步", "Sync", "cloud interval push pull 云端"),
  entry("updates", { category: "account-data" }, "应用更新", "App updates", "desktop version 桌面 版本"),
  entry("auto-launch", { category: "account-data" }, "开机启动", "Launch at startup", "desktop login 开机自启"),
  entry("data-backup", { category: "account-data" }, "数据与备份", "Data & Backup", "import export json csv 导入 导出"),
  entry("clear-local-data", { category: "account-data" }, "清空本地数据", "Clear local data", "delete danger 删除 危险"),
  entry("delete-account", { category: "account-data" }, "删除账户", "Delete account", "danger sign out logout 危险 退出"),

  entry("ai-model", { category: "advanced", detail: "ai" }, "高级模型偏好", "Advanced model preference", "model routing 模型"),
  entry("ai-reasoning", { category: "advanced", detail: "ai" }, "思考模式", "Reasoning mode", "instant high xhigh"),
  entry("ai-estimate", { category: "advanced", detail: "ai" }, "自动估算任务用时", "Estimate task duration", "AI duration"),
  entry("ai-project", { category: "advanced", detail: "ai" }, "自动归入项目", "Auto-assign project", "AI confidence"),
  entry("ai-memory", { category: "advanced", detail: "ai" }, "AI 记忆", "AI memory", "context personalization 上下文 个性化"),
  entry("hide-ai", { category: "advanced", detail: "ai" }, "隐藏所有 AI", "Hide all AI", "disable"),
  entry("ai-reset", { category: "advanced", detail: "ai" }, "重置 AI 个性化", "Reset AI personalization", "clear history 清空历史"),

  entry("portrait-window", { category: "advanced", detail: "widget" }, "竖屏小窗", "Portrait window", "desktop compact 置顶"),
  entry("desktop-widget", { category: "advanced", detail: "widget" }, "桌面小组件", "Desktop widget", "launch always on top opacity 启动 置顶 透明度"),
  entry("widget-font", { category: "advanced", detail: "widget" }, "小组件字体", "Widget font", "family scale 字号"),
  entry("widget-light", { category: "advanced", detail: "widget" }, "小组件浅色外观", "Widget light appearance", "background text timer overrun color 背景 文字 计时 超时"),
  entry("widget-light-background", { category: "advanced", detail: "widget" }, "浅色背景", "Light background", "widget color 小组件 背景颜色"),
  entry("widget-light-text", { category: "advanced", detail: "widget" }, "浅色文字", "Light text", "widget font color 小组件 文字颜色"),
  entry("widget-light-timer", { category: "advanced", detail: "widget" }, "浅色计时", "Light timer", "widget timer color 小组件 计时颜色"),
  entry("widget-light-overrun", { category: "advanced", detail: "widget" }, "浅色超时", "Light overrun", "widget overtime color 小组件 超时颜色"),
  entry("widget-dark", { category: "advanced", detail: "widget" }, "小组件深色外观", "Widget dark appearance", "background text timer overrun color 背景 文字 计时 超时"),
  entry("widget-dark-background", { category: "advanced", detail: "widget" }, "深色背景", "Dark background", "widget color 小组件 背景颜色"),
  entry("widget-dark-text", { category: "advanced", detail: "widget" }, "深色文字", "Dark text", "widget font color 小组件 文字颜色"),
  entry("widget-dark-timer", { category: "advanced", detail: "widget" }, "深色计时", "Dark timer", "widget timer color 小组件 计时颜色"),
  entry("widget-dark-overrun", { category: "advanced", detail: "widget" }, "深色超时", "Dark overrun", "widget overtime color 小组件 超时颜色"),
  entry("widget-timer", { category: "advanced", detail: "widget" }, "小组件计时模式", "Widget timer mode", "stopwatch pomodoro countdown 正计时 番茄钟 倒计时"),
  entry("widget-reset", { category: "advanced", detail: "widget" }, "重置小组件", "Reset widget", "appearance position size 外观 位置 尺寸"),

  entry("plugins", { category: "advanced", detail: "integrations" }, "插件", "Plugins", "extension local built-in 扩展 本地 内置"),
  entry("mcp", { category: "advanced", detail: "integrations" }, "MCP", "MCP", "token server integration 令牌 服务"),
  entry("reset-settings", { category: "advanced", detail: "recovery" }, "重置所有设置", "Reset all settings", "restore defaults danger 恢复默认 危险"),
];

function searchableText(item: SettingsSearchEntry): string {
  return [item.labelZh, item.labelEn, item.descriptionZh, item.descriptionEn, item.keywords].filter(Boolean).join(" ").toLocaleLowerCase();
}

export function searchSettings(query: string, lang: Language): SettingsSearchEntry[] {
  const tokens = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  return SETTINGS_SEARCH_ENTRIES
    .filter((item) => tokens.every((token) => searchableText(item).includes(token)))
    .sort((a, b) => {
      const aLabel = (lang === "zh" ? a.labelZh : a.labelEn).toLocaleLowerCase();
      const bLabel = (lang === "zh" ? b.labelZh : b.labelEn).toLocaleLowerCase();
      const normalizedQuery = tokens.join(" ");
      return Number(bLabel.startsWith(normalizedQuery)) - Number(aLabel.startsWith(normalizedQuery));
    })
    .slice(0, 8);
}

export function settingsSearchPath(item: SettingsSearchEntry, lang: Language): string {
  const path = [settingsCategoryLabel(item.target.category, lang)];
  if (item.target.detail) path.push(settingsDetailLabel(item.target.detail, lang));
  path.push(lang === "zh" ? item.labelZh : item.labelEn);
  return path.join(" › ");
}

export function settingsTargetForSearchId(id: string): SettingsTarget | undefined {
  return SETTINGS_SEARCH_ENTRIES.find((item) => item.id === id)?.target;
}
