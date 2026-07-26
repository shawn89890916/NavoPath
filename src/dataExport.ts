import type { PlannerData, Project, Settings, Task } from "./types";
import { normalizeData } from "./browserFallback";
import { normalizeSettings } from "./defaultSettings";

export const MAX_BACKUP_IMPORT_BYTES = 20 * 1024 * 1024;
export const MAX_TASK_CSV_IMPORT_BYTES = 10 * 1024 * 1024;

export function isImportFileSizeAllowed(size: number, kind: "backup" | "tasks") {
  const limit = kind === "backup" ? MAX_BACKUP_IMPORT_BYTES : MAX_TASK_CSV_IMPORT_BYTES;
  return Number.isFinite(size) && size >= 0 && size <= limit;
}

export const TASK_CSV_HEADERS = [
  "ID",
  "Title",
  "Project",
  "Status",
  "Due Date",
  "Estimated Hours",
  "Priority",
  "Created At",
  "Completed",
] as const;

export type TaskCsvRow = {
  id: string;
  title: string;
  projectTitle: string;
  status: string;
  dueDate: string;
  estimatedHours: string;
  priority: string;
  createdAt: string;
  completed: string;
};

const SPREADSHEET_FORMULA_PREFIX = /^[=+\-@\t\r\n]/;

function protectSpreadsheetCell(value: string) {
  return SPREADSHEET_FORMULA_PREFIX.test(value) ? `'${value}` : value;
}

function restoreSpreadsheetCell(value: string) {
  return value.startsWith("'") && SPREADSHEET_FORMULA_PREFIX.test(value.slice(1))
    ? value.slice(1)
    : value;
}

function csvCell(value: unknown) {
  const protectedValue = protectSpreadsheetCell(String(value ?? ""));
  return `"${protectedValue.replace(/"/g, '""')}"`;
}

export function buildPlannerBackupJson(data: PlannerData, settings: Settings, exportedAt = new Date().toISOString()) {
  return JSON.stringify({ exportedAt, version: data.version, data, settings }, null, 2);
}

export function parsePlannerBackupJson(content: string): { data: PlannerData; settings: Settings } {
  const parsed: unknown = JSON.parse(content);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid planner backup envelope.");
  }
  const { data, settings } = parsed as { data?: unknown; settings?: unknown };
  if (!data || typeof data !== "object" || Array.isArray(data) || !settings || typeof settings !== "object" || Array.isArray(settings)) {
    throw new Error("Planner backup is missing data or settings.");
  }
  const candidate = data as Partial<PlannerData>;
  if (!Array.isArray(candidate.tasks) || !Array.isArray(candidate.projects)) {
    throw new Error("Planner backup is missing required collections.");
  }
  return {
    data: normalizeData(candidate as PlannerData),
    settings: normalizeSettings(settings),
  };
}

export function buildTasksCsv(data: PlannerData) {
  const projectMap = new Map(data.projects.map((project) => [project.id, project.title]));
  const rows = data.tasks.map((task) => {
    const projectTitle = projectMap.get(task.projectId || "") || "";
    const status = task.completed ? "Completed" : (task.plannedForDate ? "Scheduled" : "Pending");
    return [
      task.id,
      task.title,
      projectTitle,
      status,
      task.dueDate || "",
      task.estimatedHours || "",
      task.priority || "",
      task.createdAt || "",
      task.completed ? "Yes" : "No",
    ].map(csvCell).join(",");
  });
  return `\uFEFF${[TASK_CSV_HEADERS.map(csvCell).join(","), ...rows].join("\r\n")}`;
}

export function parseCsv(content: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    if (char === '"') {
      if (inQuotes && content[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && content[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  if (rows[0]?.[0]?.startsWith("\uFEFF")) rows[0][0] = rows[0][0].slice(1);
  return rows;
}

export function parseTaskCsvRows(content: string): TaskCsvRow[] {
  const rows = parseCsv(content);
  if (rows.length < 2) return [];
  return rows.slice(1).map((values) => ({
    id: restoreSpreadsheetCell(values[0] || ""),
    title: restoreSpreadsheetCell(values[1] || ""),
    projectTitle: restoreSpreadsheetCell(values[2] || ""),
    status: restoreSpreadsheetCell(values[3] || ""),
    dueDate: restoreSpreadsheetCell(values[4] || ""),
    estimatedHours: restoreSpreadsheetCell(values[5] || ""),
    priority: restoreSpreadsheetCell(values[6] || ""),
    createdAt: restoreSpreadsheetCell(values[7] || ""),
    completed: restoreSpreadsheetCell(values[8] || ""),
  }));
}

export function parseTasksCsv(content: string, projects: Project[], now = new Date().toISOString()): Task[] {
  const projectIdsByTitle = new Map(projects.map((project) => [project.title.trim().toLowerCase(), project.id]));
  return parseTaskCsvRows(content).map((row) => {
    const estimatedHours = Number(row.estimatedHours);
    const priority = row.priority === "high" || row.priority === "low" ? row.priority : "medium";
    const completed = row.completed.toLowerCase() === "yes" || row.status.toLowerCase() === "completed";
    const createdAt = Number.isNaN(Date.parse(row.createdAt)) ? now : row.createdAt;
    return {
      id: row.id || `task_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`,
      title: row.title || "Untitled Task",
      projectId: projectIdsByTitle.get(row.projectTitle.trim().toLowerCase()) || "",
      category: "personal",
      priority,
      notes: "",
      goalId: "",
      completed,
      estimatedHours: Number.isFinite(estimatedHours) && estimatedHours > 0 ? estimatedHours : undefined,
      dueDate: row.dueDate,
      subtasks: [],
      createdAt,
      updatedAt: now,
    };
  });
}

function downloadText(content: string, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(url);
  }
}

export function exportDataAsJson(data: PlannerData, settings: Settings) {
  const now = new Date().toISOString();
  downloadText(buildPlannerBackupJson(data, settings, now), "application/json", `navopath-backup-${now.slice(0, 10)}.json`);
}

export function exportTasksAsCsv(data: PlannerData) {
  const date = new Date().toISOString().slice(0, 10);
  downloadText(buildTasksCsv(data), "text/csv;charset=utf-8", `navopath-tasks-${date}.csv`);
}
