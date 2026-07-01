import type { Language, Priority, Task } from "../types";
import { normalizeTaskState, type UiWorkflowStatus } from "./productivityModel";

export type TaskMetaBadge = {
  key: "status" | "importance" | "urgency";
  label: string;
  className: string;
};

const statusLabels: Record<UiWorkflowStatus, Record<Language, string>> = {
  backlog: { zh: "未开始", en: "Not started" },
  doing: { zh: "进行中", en: "Doing" },
  done: { zh: "已完成", en: "Done" },
};

const importanceLabels: Record<"empty" | Priority, Record<Language, string>> = {
  empty: { zh: "空重要", en: "No importance" },
  low: { zh: "不重要", en: "Not important" },
  medium: { zh: "一般", en: "Normal" },
  high: { zh: "重要", en: "Important" },
};

const urgencyLabels: Record<Priority, Record<Language, string>> = {
  low: { zh: "不紧急", en: "Not urgent" },
  medium: { zh: "一般紧急", en: "Somewhat urgent" },
  high: { zh: "紧急", en: "Urgent" },
};

export function buildTaskMetaBadges(task: Task, lang: Language): TaskMetaBadge[] {
  const state = normalizeTaskState(task);
  const importanceKey = state.importance ?? "empty";
  return [
    {
      key: "status",
      label: statusLabels[state.workflow][lang],
      className: `df-task-meta-badge status-${state.workflow}`,
    },
    {
      key: "importance",
      label: importanceLabels[importanceKey][lang],
      className: `df-task-meta-badge importance-${importanceKey}`,
    },
    {
      key: "urgency",
      label: urgencyLabels[state.urgency][lang],
      className: `df-task-meta-badge urgency-${state.urgency}`,
    },
  ];
}
