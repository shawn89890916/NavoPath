import type { CSSProperties, Dispatch, SetStateAction } from "react";
import type { Category, Language, NullablePriority, Priority, Project, Subtask, Task, TaskRecurrence, TimelineRecord } from "./types";
import { clockTimeSpanMinutes, rescheduleTimelineRecord, timelineRecordDurationMinutes } from "./utils/timelineRecords";
import { toggleSubtaskInTree } from "./utils/treeOrder";
import "./mobile-task-summary.css";

type SummaryForm = { title: string; projectId: string; projectColor: string; dueDate: string; dueTime: string; endDate: string; endTime: string; category: Category; priority: Priority; importance: NullablePriority; urgency: NullablePriority; estimatedHours: number; details: string; recurrence?: TaskRecurrence };

export default function MobileTaskSummary(props: {
  lang: Language;
  task: Task;
  form: SummaryForm;
  setForm: Dispatch<SetStateAction<SummaryForm>>;
  projects: Project[];
  record?: TimelineRecord | null;
  occurrence?: { scheduledDate: string; scheduledStart: string } | null;
  today: string;
  onClose: () => void;
  onMore?: () => void;
  onUpdate: (taskId: string, patch: Partial<Task>) => void;
  onDone: () => void;
  onReturn: () => void;
  unfinished: boolean;
}) {
  const zh = props.lang === "zh";
  const toMinutes = (time = "09:00") => { const [h, m] = time.split(":").map(Number); return (h || 0) * 60 + (m || 0); };
  const toTime = (minutes: number) => { const value = (minutes + 1440) % 1440; return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`; };
  const timeOptions = Array.from({ length: 96 }, (_, index) => toTime(index * 15));
  const project = props.projects.find((item) => String(item.id) === String(props.form.projectId));
  const rawStart = props.form.dueTime || props.record?.scheduledStart || props.occurrence?.scheduledStart || props.task.scheduledStart || props.task.recurrence?.startTime || "";
  const duration = props.record ? timelineRecordDurationMinutes(props.record) : props.task.recurrence?.durationMinutes || Math.max(Math.round((props.task.estimatedHours || .5) * 60), 15);
  const rawEnd = props.form.endTime || props.record?.scheduledEnd || props.task.scheduledEnd || (rawStart ? toTime(toMinutes(rawStart) + duration) : "");
  const startTime = rawStart ? toTime(Math.round(toMinutes(rawStart) / 15) * 15) : "";
  const endTime = rawEnd ? toTime(Math.round(toMinutes(rawEnd) / 15) * 15) : "";
  const spansMidnight = Boolean(startTime && endTime && (
    (props.record?.scheduledEndDate && props.record.scheduledEndDate > props.record.scheduledDate) ||
    toMinutes(endTime) <= toMinutes(startTime)
  ));
  const subtasks: Array<{ item: Subtask; depth: number }> = [];
  const collect = (items: Subtask[], depth = 0) => items.forEach((item) => { subtasks.push({ item, depth }); collect(item.subtasks || [], depth + 1); });
  collect(props.task.subtasks || []);
  function commitTime(edge: "start" | "end", raw: string) {
    const snapped = toTime(Math.round(toMinutes(raw) / 15) * 15);
    let start = edge === "start" ? snapped : startTime;
    let end = edge === "end" ? snapped : endTime;
    if (!start) start = edge === "end" ? toTime(toMinutes(end) - 15) : snapped;
    if (!end || end === start || (edge === "start" && !spansMidnight && toMinutes(end) <= toMinutes(start))) end = toTime(toMinutes(start) + 15);
    const minutes = Math.max(clockTimeSpanMinutes(start, end), 15);
    const patch: Partial<Task> = { estimatedHours: minutes / 60 };
    if (props.record) patch.timelineRecords = (props.task.timelineRecords || []).map((record) => record.id === props.record!.id ? rescheduleTimelineRecord(record, record.scheduledDate, start, minutes) : record);
    else if (props.task.recurrence && props.occurrence) patch.recurrence = { ...props.task.recurrence, startTime: start, durationMinutes: minutes };
    else Object.assign(patch, { scheduledDate: props.task.scheduledDate || props.occurrence?.scheduledDate || props.form.dueDate || props.today, scheduledStart: start, scheduledEnd: end });
    props.setForm((current) => ({ ...current, dueTime: start, endTime: end, estimatedHours: minutes / 60 }));
    props.onUpdate(props.task.id, patch);
  }
  return <aside className="df-drawer df-task-detail df-mobile-task-summary" onMouseDown={(event) => event.stopPropagation()}>
    <button className="df-detail-close df-icon-action i-close" type="button" aria-label={zh ? "关闭" : "Close"} onClick={props.onClose} />
    <div className="df-mobile-sheet-grabber" aria-hidden="true" />
    <div className="df-mobile-summary-head"><input value={props.form.title} aria-label={zh ? "任务名称" : "Task title"} onChange={(event) => props.setForm((current) => ({ ...current, title: event.target.value }))} onBlur={(event) => props.onUpdate(props.task.id, { title: event.currentTarget.value.trim() || props.task.title })} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } }} /><button type="button" className="df-mobile-more" onClick={props.onMore}>More</button></div>
    <label className="df-mobile-summary-project"><span className="df-detail-project-dot" style={{ background: project?.color || "#888" }} /><span>{zh ? "归属" : "Project"}</span><select value={props.form.projectId} onChange={(event) => { const projectId = event.target.value; props.setForm((current) => ({ ...current, projectId })); props.onUpdate(props.task.id, { projectId: projectId || undefined }); }}><option value="">{zh ? "未归属" : "Unassigned"}</option>{props.projects.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
    <div className="df-mobile-summary-times">
      <label><span>{zh ? "开始" : "Start"}</span><select aria-label={zh ? "开始时间" : "Start time"} value={startTime} onChange={(event) => commitTime("start", event.target.value)}><option value="">--:--</option>{timeOptions.map((time) => <option key={time}>{time}</option>)}</select></label>
      <span aria-hidden="true">→</span>
      <label><span>{zh ? "结束" : "End"}</span><select aria-label={zh ? "结束时间" : "End time"} value={endTime} onChange={(event) => commitTime("end", event.target.value)}><option value="">--:--</option>{timeOptions.map((time) => <option key={time}>{time}</option>)}</select></label>
    </div>
    <div className="df-mobile-summary-actions">
      <button type="button" className={props.task.completed ? "active" : ""} onClick={props.onDone}>✓ {zh ? "完成" : "Done"}</button>
      <button type="button" className={props.unfinished ? "active" : ""} aria-pressed={props.unfinished} onClick={props.onReturn}>↩ {zh ? "未完成" : "Unfinished"}</button>
      <button type="button" onClick={props.onMore}>{zh ? "更多信息" : "Details"}</button>
    </div>
    {subtasks.length > 0 && <section className="df-mobile-summary-subtasks" aria-label={zh ? "子任务" : "Subtasks"}><header><b>{zh ? "子任务" : "Subtasks"}</b><span>{subtasks.filter(({ item }) => item.completed || item.done).length}/{subtasks.length}</span></header><div className="df-mobile-summary-subtask-list">{subtasks.map(({ item, depth }) => <label key={item.id} style={{ "--subtask-depth": depth } as CSSProperties}><input type="checkbox" checked={Boolean(item.completed || item.done)} onChange={() => props.onUpdate(props.task.id, { subtasks: toggleSubtaskInTree(props.task.subtasks || [], item.id) })} /><span>{item.title}</span></label>)}</div></section>}
  </aside>;
}
