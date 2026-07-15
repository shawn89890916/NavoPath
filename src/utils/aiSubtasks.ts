import type { Subtask } from "../types";

export type AiSubtaskSuggestion = { title?: string; estimateMinutes?: number };

export function appendAiSubtasks(
  existing: Subtask[] | undefined,
  suggestions: AiSubtaskSuggestion[] | undefined,
  createId: () => string,
  createdAt: string,
): Subtask[] {
  const current = existing || [];
  const seen = new Set(current.map((subtask) => subtask.title.trim().toLocaleLowerCase()));
  const additions: Subtask[] = [];

  for (const suggestion of suggestions || []) {
    const title = suggestion.title?.trim();
    const key = title?.toLocaleLowerCase();
    if (!title || !key || seen.has(key)) continue;
    seen.add(key);
    additions.push({
      id: createId(),
      title,
      completed: false,
      done: false,
      order: current.length + additions.length,
      subtasks: [],
      createdAt,
    });
  }

  return [...current, ...additions];
}
