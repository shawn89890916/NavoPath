import { describe, expect, it } from "vitest";
import {
  MAX_BACKUP_IMPORT_BYTES,
  MAX_BACKUP_STRUCTURE_NODES,
  MAX_TASK_CSV_IMPORT_BYTES,
  MAX_TASK_CSV_ID_LENGTH,
  MAX_TASK_CSV_METADATA_LENGTH,
  MAX_TASK_CSV_ROWS,
  MAX_TASK_CSV_TEXT_LENGTH,
  TASK_CSV_HEADERS,
  buildPlannerBackupJson,
  buildTasksCsv,
  isImportFileSizeAllowed,
  parsePlannerBackupJson,
  parseTaskCsvRows,
  parseTasksCsv,
} from "./dataExport";
import { assertSafeDocxArchive } from "./fileParser";
import {
  MAX_RASTER_PIXELS,
  assertSafeRasterDimensions,
  boundedCanvasScale,
  readRasterDimensions,
} from "./imageSafety";
import type { PlannerData, Project, Settings, Task } from "./types";

function task(id: string, title: string, projectId?: string): Task {
  return {
    id,
    title,
    projectId,
    dueDate: "2026-07-26",
    category: "personal",
    priority: "medium",
    notes: "",
    goalId: "",
    completed: false,
    estimatedHours: 1,
    subtasks: [],
    order: 0,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
  };
}

function plannerData(tasks: Task[], projects: Project[] = []): PlannerData {
  return {
    version: 1,
    importedSeedVersion: "test",
    generatedAt: "2026-07-01T00:00:00.000Z",
    goals: [],
    projects,
    tasks,
    longTasks: [],
    events: [],
    notes: [],
    drafts: [],
    chat: [],
    aiMemories: [],
  };
}

describe("planner backup export", () => {
  it("limits backup and CSV files before reading them", () => {
    expect(isImportFileSizeAllowed(MAX_BACKUP_IMPORT_BYTES, "backup")).toBe(true);
    expect(isImportFileSizeAllowed(MAX_BACKUP_IMPORT_BYTES + 1, "backup")).toBe(false);
    expect(isImportFileSizeAllowed(MAX_TASK_CSV_IMPORT_BYTES, "tasks")).toBe(true);
    expect(isImportFileSizeAllowed(MAX_TASK_CSV_IMPORT_BYTES + 1, "tasks")).toBe(false);
    expect(isImportFileSizeAllowed(Number.NaN, "backup")).toBe(false);
  });

  it("builds a complete timestamped JSON envelope", () => {
    const data = plannerData([]);
    const settings = { language: "zh" } as Settings;
    const exportedAt = "2026-07-26T10:00:00.000Z";

    expect(JSON.parse(buildPlannerBackupJson(data, settings, exportedAt))).toEqual({
      exportedAt,
      version: 1,
      data,
      settings,
    });
  });

  it("normalizes legacy backups before applying them", () => {
    const legacyData = plannerData([task("task", "Legacy task")]);
    delete (legacyData as Partial<PlannerData>).aiMemories;
    const backup = parsePlannerBackupJson(JSON.stringify({
      data: legacyData,
      settings: {
        language: "zh",
        theme: "dark",
        model: "deepseek-chat",
        executeAccentColor: "#C69CF9",
      },
    }));

    expect(backup.data.aiMemories).toEqual([]);
    expect(backup.data.scheduleTemplates).toEqual([]);
    expect(backup.settings.language).toBe("zh");
    expect(backup.settings.theme).toBe("dark");
    expect(backup.settings.model).toBe("deepseek-ai/DeepSeek-V3.2");
    expect(backup.settings.executeAccentColor).toBe("");
  });

  it("rejects corrupt data and replaces invalid settings with safe defaults", () => {
    expect(() => parsePlannerBackupJson("{broken")).toThrow();
    expect(() => parsePlannerBackupJson(JSON.stringify({
      data: { projects: [] },
      settings: {},
    }))).toThrow("required collections");

    const backup = parsePlannerBackupJson(JSON.stringify({
      data: plannerData([]),
      settings: {
        activeMode: "destroy",
        language: 42,
        syncIntervalMinutes: -5,
        panelWidths: { left: -1, right: "wide" },
        widgetTimerPreferences: { mode: "invalid", focusMinutes: -10 },
      },
    }));
    expect(backup.settings.activeMode).toBe("execute");
    expect(backup.settings.language).toBe("en");
    expect(backup.settings.syncIntervalMinutes).toBe(60);
    expect(backup.settings.panelWidths).toEqual({ left: 360, right: 390 });
    expect(backup.settings.widgetTimerPreferences?.mode).toBe("stopwatch");
    expect(backup.settings.widgetTimerPreferences?.focusMinutes).toBe(25);
  });

  it("rejects backups with excessive nesting before normalization", () => {
    let nested: Record<string, unknown> = {};
    for (let depth = 0; depth < 65; depth += 1) nested = { child: nested };
    expect(() => parsePlannerBackupJson(JSON.stringify({
      data: { ...plannerData([]), nested },
      settings: {},
    }))).toThrow("nesting depth");
  });

  it("rejects backups with excessive structural nodes before normalization", () => {
    expect(() => parsePlannerBackupJson(JSON.stringify({
      data: { ...plannerData([]), oversized: Array(MAX_BACKUP_STRUCTURE_NODES).fill(null) },
      settings: {},
    }))).toThrow("structure is too large");
  });
});

describe("task CSV export", () => {
  it("round-trips commas, quotes, newlines, and project names", () => {
    const project: Project = {
      id: "project",
      title: 'Project, "A"',
      category: "project",
      notes: "",
      completed: false,
      createdAt: "1",
      updatedAt: "1",
    };
    const data = plannerData([task("task", "Line one,\nLine \"two\"", project.id)], [project]);

    const rows = parseTaskCsvRows(buildTasksCsv(data));

    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Line one,\nLine \"two\"");
    expect(rows[0].projectTitle).toBe('Project, "A"');
    expect(parseTasksCsv(buildTasksCsv(data), [project], "2026-07-26T00:00:00.000Z")[0].projectId).toBe(project.id);
  });

  it("neutralizes spreadsheet formulas while preserving app round-trips", () => {
    const data = plannerData([task("task", "=HYPERLINK(\"https://example.com\")")]);

    const csv = buildTasksCsv(data);

    expect(csv).toContain('"\'=HYPERLINK(""https://example.com"")"');
    expect(parseTaskCsvRows(csv)[0].title).toBe('=HYPERLINK("https://example.com")');
  });

  it("rejects excessive task rows while parsing", () => {
    const csv = [
      TASK_CSV_HEADERS.map((header) => `"${header}"`).join(","),
      ...Array.from({ length: MAX_TASK_CSV_ROWS + 1 }, (_, index) => `"${index}","Task ${index}"`),
    ].join("\n");
    expect(() => parseTaskCsvRows(csv)).toThrow(String(MAX_TASK_CSV_ROWS));
  });

  it("rejects malformed task CSV headers and unterminated quoted fields", () => {
    expect(() => parseTaskCsvRows("Wrong,Columns\n1,Task")).toThrow("header");
    expect(() => parseTaskCsvRows([
      TASK_CSV_HEADERS.join(","),
      'task-1,"Unterminated task',
    ].join("\n"))).toThrow("quoted field");
  });

  it("keeps only the first task when an import repeats an explicit ID", () => {
    const csv = [
      TASK_CSV_HEADERS.join(","),
      "task-1,First task",
      "task-1,Duplicate task",
    ].join("\n");

    const tasks = parseTasksCsv(csv, [], "2026-07-26T00:00:00.000Z");

    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe("First task");
  });

  it("normalizes imported due dates and estimated hours before saving", () => {
    const csv = [
      TASK_CSV_HEADERS.join(","),
      "invalid-date,Invalid date,,,2026-02-30,999",
      "minimum-duration,Minimum duration,,,2026-02-28,0.1",
      "missing-duration,Missing duration,,,not-a-date,-3",
    ].join("\n");

    const tasks = parseTasksCsv(csv, [], "2026-07-26T00:00:00.000Z");

    expect(tasks.map(({ dueDate, estimatedHours }) => ({ dueDate, estimatedHours }))).toEqual([
      { dueDate: "", estimatedHours: 24 },
      { dueDate: "2026-02-28", estimatedHours: 0.25 },
      { dueDate: "", estimatedHours: undefined },
    ]);
  });

  it("rejects task CSV fields that exceed their persisted-data limits", () => {
    const header = TASK_CSV_HEADERS.join(",");
    expect(() => parseTaskCsvRows([
      header,
      `${"i".repeat(MAX_TASK_CSV_ID_LENGTH + 1)},Task`,
    ].join("\n"))).toThrow("ID");
    expect(() => parseTaskCsvRows([
      header,
      `task-1,${"T".repeat(MAX_TASK_CSV_TEXT_LENGTH + 1)}`,
    ].join("\n"))).toThrow("Title");
    expect(() => parseTaskCsvRows([
      header,
      `task-1,Task,,${"S".repeat(MAX_TASK_CSV_METADATA_LENGTH + 1)}`,
    ].join("\n"))).toThrow("Status");

    expect(parseTaskCsvRows([
      header,
      `${"i".repeat(MAX_TASK_CSV_ID_LENGTH)},${"T".repeat(MAX_TASK_CSV_TEXT_LENGTH)}`,
    ].join("\n"))).toHaveLength(1);
  });
});

const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_END_SIGNATURE = 0x06054b50;

function zipDirectory(uncompressedSizes: number[], declaredEntries = uncompressedSizes.length) {
  const centralSize = uncompressedSizes.length * 46;
  const buffer = new ArrayBuffer(centralSize + 22);
  const view = new DataView(buffer);
  uncompressedSizes.forEach((size, index) => {
    const offset = index * 46;
    view.setUint32(offset, CENTRAL_DIRECTORY_SIGNATURE, true);
    view.setUint32(offset + 24, size, true);
  });
  view.setUint32(centralSize, ZIP_END_SIGNATURE, true);
  view.setUint16(centralSize + 8, declaredEntries, true);
  view.setUint16(centralSize + 10, declaredEntries, true);
  view.setUint32(centralSize + 12, centralSize, true);
  view.setUint32(centralSize + 16, 0, true);
  return buffer;
}

function addZipComment(buffer: ArrayBuffer, length: number) {
  const result = new ArrayBuffer(buffer.byteLength + length);
  new Uint8Array(result).set(new Uint8Array(buffer));
  new DataView(result).setUint16(buffer.byteLength - 2, length, true);
  return result;
}

describe("DOCX archive limits", () => {
  it("accepts bounded central-directory metadata", () => {
    expect(() => assertSafeDocxArchive(zipDirectory([1_024, 2_048]))).not.toThrow();
    expect(() => assertSafeDocxArchive(addZipComment(zipDirectory([1_024]), 8))).not.toThrow();
  });

  it("rejects excessive declared uncompressed content", () => {
    expect(() => assertSafeDocxArchive(zipDirectory([50 * 1_024 * 1_024 + 1]))).toThrow("50 MB");
  });

  it("rejects excessive entry counts before decompression", () => {
    expect(() => assertSafeDocxArchive(zipDirectory([], 2_049))).toThrow("2048");
  });

  it("rejects malformed archives", () => {
    expect(() => assertSafeDocxArchive(new ArrayBuffer(32))).toThrow("结构无效");
    expect(() => assertSafeDocxArchive(addZipComment(zipDirectory([1_024]), 65_536))).toThrow("结构无效");
  });
});

function pngHeader(width: number, height: number) {
  const buffer = new ArrayBuffer(24);
  const bytes = new Uint8Array(buffer);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  const view = new DataView(buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return buffer;
}

function jpegHeader(width: number, height: number) {
  const bytes = new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x02,
    0xff, 0xc0, 0x00, 0x11, 0x08,
    height >> 8, height & 0xff,
    width >> 8, width & 0xff,
    0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
  ]);
  return bytes.buffer;
}

function webpHeader(width: number, height: number) {
  const buffer = new ArrayBuffer(30);
  const bytes = new Uint8Array(buffer);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0);
  new DataView(buffer).setUint32(4, 22, true);
  bytes.set([0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58], 8);
  new DataView(buffer).setUint32(16, 10, true);
  const encodedWidth = width - 1;
  const encodedHeight = height - 1;
  bytes.set([
    encodedWidth & 0xff, (encodedWidth >> 8) & 0xff, (encodedWidth >> 16) & 0xff,
    encodedHeight & 0xff, (encodedHeight >> 8) & 0xff, (encodedHeight >> 16) & 0xff,
  ], 24);
  return buffer;
}

describe("raster image limits", () => {
  it("reads supported image dimensions without decoding pixels", () => {
    expect(readRasterDimensions(pngHeader(1_200, 800))).toEqual({ width: 1_200, height: 800 });
    expect(readRasterDimensions(jpegHeader(640, 480))).toEqual({ width: 640, height: 480 });
    expect(readRasterDimensions(webpHeader(1_920, 1_080))).toEqual({ width: 1_920, height: 1_080 });
  });

  it("rejects malformed and excessive image dimensions", () => {
    expect(() => readRasterDimensions(new ArrayBuffer(24))).toThrow("格式无效");
    expect(() => assertSafeRasterDimensions(pngHeader(8_000, 3_000))).toThrow("像素尺寸过大");
  });

  it("caps OCR canvas scaling by the pixel budget", () => {
    expect(boundedCanvasScale(1_000, 1_000, 2)).toBe(2);
    expect(boundedCanvasScale(4_000, 4_000, 2)).toBe(1);
    expect(4_000 * 4_000 * boundedCanvasScale(4_000, 4_000, 2) ** 2).toBeLessThanOrEqual(MAX_RASTER_PIXELS);
    expect(100_000 * boundedCanvasScale(100_000, 10, 2)).toBeLessThanOrEqual(8_192);
    expect(() => boundedCanvasScale(0, 100, 1)).toThrow("页面尺寸无效");
    expect(() => boundedCanvasScale(100, 100, Number.NaN)).toThrow("页面尺寸无效");
  });
});
