import type { PlannerData, Settings } from "../types";
import { focusTargetForRecord, type TimelineFocusTarget } from "./timelineRecords";

export type CommandKind = "task" | "project" | "event" | "note" | "habit" | "setting";
export type CommandAction = "open" | "focus" | "complete" | "start_timer" | "add_today" | "schedule_now";

export type CommandSearchResult = {
  id: string;
  kind: CommandKind;
  title: string;
  subtitle: string;
  text: string;
  actions: CommandAction[];
  focusTarget?: TimelineFocusTarget;
};

export function buildCommandSearchIndex(data: PlannerData, _settings: Settings): CommandSearchResult[] {
  const taskResults = (data.tasks || []).map((task): CommandSearchResult => {
    const record = (task.timelineRecords || []).find((item) => item.executionStatus === "scheduled");
    return {
      id: `task:${task.id}`,
      kind: "task",
      title: task.title,
      subtitle: task.dueDate || "",
      text: `${task.title} ${task.notes || ""}`.toLowerCase(),
      actions: record ? ["open", "focus", "complete", "start_timer"] : ["open", "add_today", "schedule_now", "start_timer"],
      focusTarget: record ? focusTargetForRecord(record) : undefined,
    };
  });
  const projectResults = (data.projects || []).map((project): CommandSearchResult => ({
    id: `project:${project.id}`,
    kind: "project",
    title: project.title,
    subtitle: project.completed ? "Completed project" : "Project",
    text: `${project.title} ${project.notes || ""}`.toLowerCase(),
    actions: ["open"],
  }));
  const habitResults = (data.habits || []).filter((habit) => !habit.archived).map((habit): CommandSearchResult => ({
    id: `habit:${habit.id}`,
    kind: "habit",
    title: habit.title,
    subtitle: "Habit",
    text: habit.title.toLowerCase(),
    actions: ["open", "schedule_now"],
  }));
  const settingResults: CommandSearchResult[] = [
    { id: "setting:shortcuts", kind: "setting", title: "Shortcuts", subtitle: "Settings", text: "shortcuts keyboard hotkeys kuaijiejian", actions: ["open"] },
    { id: "setting:productivity", kind: "setting", title: "Productivity", subtitle: "Settings", text: "productivity habits metrics templates widget", actions: ["open"] },
  ];
  return [...taskResults, ...projectResults, ...habitResults, ...settingResults];
}

export function searchCommands(index: CommandSearchResult[], query: string): CommandSearchResult[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return index.slice(0, 12);
  return index
    .map((item) => ({ item, rank: item.title.toLowerCase().includes(normalized) ? 0 : item.text.includes(normalized) ? 1 : 9 }))
    .filter(({ rank }) => rank < 9)
    .sort((a, b) => a.rank - b.rank || a.item.title.localeCompare(b.item.title))
    .map(({ item }) => item)
    .slice(0, 20);
}
