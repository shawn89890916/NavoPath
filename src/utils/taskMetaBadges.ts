import type { Language, Task } from "../types";
import { normalizeTaskState } from "./productivityModel";

export type TaskMetaBadge = {
  key: "status";
  label: string;
  className: string;
};

const doneLabels: Record<Language, string> = {
  zh: "已完成",
  en: "Done",
};

export function buildTaskMetaBadges(task: Task, lang: Language): TaskMetaBadge[] {
  if (normalizeTaskState(task).workflow !== "done") return [];
  return [{ key: "status", label: doneLabels[lang], className: "df-task-meta-badge status-done" }];
}
