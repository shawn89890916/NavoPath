import type { Task, TimelineRecord } from "../types";

const parse = (date: string, time: string) => new Date(`${date}T${time}:00`).getTime();
const datePart = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
const timePart = (value: Date) => `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;

export type TimelineRecordBounds = { recordId: string; startAt: number; endAt: number };

export function timelineRecordBounds(task?: Task | null, recordId?: string, now = Date.now()): TimelineRecordBounds | undefined {
  if (!task) return undefined;
  const records = (task.timelineRecords || []).filter((record) => record.executionStatus === "scheduled" && record.scheduledDate && record.scheduledStart && record.scheduledEnd);
  const toBounds = (record: TimelineRecord) => {
    const startAt = parse(record.scheduledDate, record.scheduledStart);
    let endAt = parse(record.scheduledEndDate || record.scheduledDate, record.scheduledEnd);
    if (endAt <= startAt && !record.scheduledEndDate) endAt += 86_400_000;
    return { record, startAt, endAt };
  };
  const candidates = records.map(toBounds).filter((item) => Number.isFinite(item.startAt) && Number.isFinite(item.endAt));
  const selected = (recordId ? candidates.find((item) => item.record.id === recordId) : undefined)
    || candidates.find((item) => item.startAt <= now && item.endAt >= now)
    || candidates.filter((item) => item.startAt > now).sort((a, b) => a.startAt - b.startAt)[0]
    || candidates.sort((a, b) => b.endAt - a.endAt)[0];
  const record = selected?.record;
  if (!record) return undefined;
  const { startAt, endAt } = selected;
  return Number.isFinite(startAt) && Number.isFinite(endAt) ? { recordId: record.id, startAt, endAt } : undefined;
}

export function extendActiveTimelineRecord(task: Task, recordId: string, actualEndAt: number): Task {
  const bounds = timelineRecordBounds(task, recordId);
  if (!bounds || actualEndAt <= bounds.endAt) return task;
  const end = new Date(actualEndAt);
  let changed = false;
  const timelineRecords = (task.timelineRecords || []).map((record): TimelineRecord => {
    if (record.id !== recordId) return record;
    changed = true;
    return { ...record, scheduledEndDate: datePart(end), scheduledEnd: timePart(end) };
  });
  if (!changed) return task;
  const durationMinutes = Math.max(1, Math.round((actualEndAt - bounds.startAt) / 60_000));
  return { ...task, timelineRecords, estimatedHours: durationMinutes / 60, updatedAt: new Date(actualEndAt).toISOString() };
}
