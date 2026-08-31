import type { Task } from "../types";

export type CandidateScheduleSummary = {
  date: string;
  startTime: string;
  label: string;
};

/** Returned or cancelled placements must never be offered as timeline links. */
export function candidateScheduleSummary(task: Task, focusDate: string): CandidateScheduleSummary | null {
  const records = task.timelineRecords?.filter((record) => record.executionStatus === "scheduled" || task.completed && record.executionStatus === "completed") || [];
  const record = records.find((item) => item.scheduledDate === focusDate)
    || (task.completed ? records.at(-1) : records.find((item) => item.scheduledDate >= focusDate) || records[0]);
  const placement = record || (!records.length && task.executionStatus !== "returned_unfinished" && task.executionStatus !== "cancelled" ? task : null);
  if (!placement?.scheduledDate || !placement.scheduledStart) return null;
  const date = placement.scheduledDate;
  const day = new Date(`${date}T00:00:00`);
  const datePart = `${day.getMonth() + 1}/${day.getDate()}`;
  const weekday = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][day.getDay()];
  return {
    date,
    startTime: placement.scheduledStart,
    label: `${datePart} ${weekday} ${placement.scheduledStart}`,
  };
}
