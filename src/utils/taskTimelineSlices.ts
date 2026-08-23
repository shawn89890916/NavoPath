import type { Task, TimelineRecord } from "../types";
import { sliceTimelineRecord } from "./timelineRecords";

export type TaskTimelineSliceExpansion = {
  tasks: Task[];
  ownerByDisplayId: Map<string, Task>;
  recordByDisplayId: Map<string, TimelineRecord>;
  sourceIdByDisplayId: Map<string, string>;
  resizeEdges: Map<string, { start: boolean; end: boolean }>;
};

export function expandTaskAllDayRecords(tasks: Task[], visibleDates: string[]): Task[] {
  const dates = new Set(visibleDates);
  return tasks.flatMap((task) => (task.timelineRecords || [])
    .filter((record) =>
      record.executionStatus !== "cancelled"
      && dates.has(record.scheduledDate)
      && !record.scheduledStart
      && !record.scheduledEnd
    )
    .map((record) => ({
      ...task,
      id: record.id,
      scheduledDate: record.scheduledDate,
      scheduledStart: undefined,
      scheduledEnd: undefined,
      executionStatus: record.executionStatus,
    })));
}

function clockTime(minutes: number) {
  const normalized = minutes % 1_440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

export function expandTaskTimelineSlices(
  tasks: Task[],
  visibleDates: string[],
): TaskTimelineSliceExpansion {
  const expansion: TaskTimelineSliceExpansion = {
    tasks: [],
    ownerByDisplayId: new Map(),
    recordByDisplayId: new Map(),
    sourceIdByDisplayId: new Map(),
    resizeEdges: new Map(),
  };

  for (const task of tasks) {
    for (const record of task.timelineRecords || []) {
      if (record.executionStatus === "cancelled") continue;
      for (const slice of sliceTimelineRecord(record, visibleDates)) {
        const isSplit = slice.continuesBefore || slice.continuesAfter;
        const id = isSplit ? `${record.id}__day__${slice.date}` : record.id;
        expansion.tasks.push({
          ...task,
          id,
          estimatedHours: (slice.endMinutes - slice.startMinutes) / 60,
          scheduledDate: slice.date,
          scheduledStart: clockTime(slice.startMinutes),
          scheduledEnd: clockTime(slice.endMinutes),
          executionStatus: record.executionStatus,
        });
        expansion.ownerByDisplayId.set(id, task);
        expansion.recordByDisplayId.set(id, record);
        expansion.sourceIdByDisplayId.set(id, record.id);
        expansion.resizeEdges.set(id, {
          start: !slice.continuesBefore,
          end: !slice.continuesAfter,
        });
      }
    }
  }

  expansion.tasks.sort((a, b) =>
    (a.scheduledDate || "").localeCompare(b.scheduledDate || "")
    || (a.scheduledStart || "").localeCompare(b.scheduledStart || "")
  );
  return expansion;
}
