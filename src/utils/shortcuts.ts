export type ShortcutScope = "global" | "timeline" | "mode" | "timer";

export type ShortcutDefinition = {
  id: string;
  labelZh: string;
  labelEn: string;
  keys: string[];
  scope: ShortcutScope;
};

export const SHORTCUTS: ShortcutDefinition[] = [
  { id: "command-search", labelZh: "搜索", labelEn: "Search", keys: ["Ctrl/Cmd+K"], scope: "global" },
  { id: "help", labelZh: "快捷键帮助", labelEn: "Shortcut help", keys: ["?"], scope: "global" },
  { id: "new-task", labelZh: "新任务", labelEn: "New task", keys: ["N"], scope: "global" },
  { id: "previous-date", labelZh: "上一天", labelEn: "Previous date", keys: ["J"], scope: "timeline" },
  { id: "next-date", labelZh: "下一天", labelEn: "Next date", keys: ["K"], scope: "timeline" },
  { id: "today", labelZh: "回到现在", labelEn: "Back to now", keys: ["T"], scope: "timeline" },
  { id: "day-view", labelZh: "日视图", labelEn: "Day view", keys: ["D"], scope: "timeline" },
  { id: "three-day-view", labelZh: "三日视图", labelEn: "3-day view", keys: ["3"], scope: "timeline" },
  { id: "week-view", labelZh: "周视图", labelEn: "Week view", keys: ["W"], scope: "timeline" },
  { id: "month-view", labelZh: "月视图", labelEn: "Month view", keys: ["M"], scope: "timeline" },
  { id: "planning", labelZh: "Planning", labelEn: "Planning", keys: ["P"], scope: "mode" },
  { id: "execute", labelZh: "Execute", labelEn: "Execute", keys: ["E"], scope: "mode" },
  { id: "timer-toggle", labelZh: "开始/暂停计时", labelEn: "Start/pause timer", keys: ["Space"], scope: "timer" },
];

export function isTypingContext(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;
  if (typeof HTMLElement !== "undefined" && target instanceof HTMLElement) {
    const tag = target.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
  }
  const candidate = target as { tagName?: string; isContentEditable?: boolean };
  const tag = String(candidate.tagName || "").toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || Boolean(candidate.isContentEditable);
}

export function matchShortcut(event: KeyboardEvent, shortcuts: ShortcutDefinition[] = SHORTCUTS): ShortcutDefinition | null {
  if (isTypingContext(event.target)) return null;
  const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
  const hasPrimary = event.ctrlKey || event.metaKey;
  return shortcuts.find((shortcut) => shortcut.keys.some((combo) => {
    if (combo === "Ctrl/Cmd+K") return hasPrimary && key === "K";
    return !event.ctrlKey && !event.metaKey && !event.altKey && combo.toUpperCase() === key.toUpperCase();
  })) || null;
}
