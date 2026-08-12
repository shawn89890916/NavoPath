import type { Dispatch, SetStateAction } from "react";
import type { Category, Language, NullablePriority, Priority, Project, Task, TaskRecurrence, TimelineRecord } from "./types";
import { clockTimeSpanMinutes, rescheduleTimelineRecord, timelineRecordDurationMinutes } from "./utils/timelineRecords";
import { countDoneSubtasks, countSubtasks } from "./utils/treeOrder";

type SummaryForm = { title: string; projectId: string; projectColor: string; dueDate: string; dueTime: string; endDate: string; endTime: string; category: Category; priority: Priority; importance: NullablePriority; urgency: NullablePriority; estimatedHours: number; details: string; recurrence?: TaskRecurrence };
import "./mobile-task-summary.css";

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
}) {
  const zh = props.lang === "zh";
  const toMinutes = (time = "09:00") => { const [h, m] = time.split(":").map(Number); return (h || 0) * 60 + (m || 0); };
  const toTime = (minutes: number) => { const value = (minutes + 1440) % 1440; return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`; };
  const project = props.projects.find((item) => String(item.id) === String(props.form.projectId));
  const startTime = props.record?.scheduledStart || props.occurrence?.scheduledStart || props.task.scheduledStart || props.task.recurrence?.startTime || "";
  const duration = props.record ? timelineRecordDurationMinutes(props.record) : props.task.recurrence?.durationMinutes || Math.max(Math.round((props.task.estimatedHours || .5) * 60), 15);
  const endTime = props.record?.scheduledEnd || props.task.scheduledEnd || (startTime ? toTime(toMinutes(startTime) + duration) : "");
  function commitTime(edge: "start" | "end", raw: string) {
    const snapped = toTime(Math.round(toMinutes(raw) / 15) * 15);
    let start = edge === "start" ? snapped : startTime;
    let end = edge === "end" ? snapped : endTime;
    if (!start) start = edge === "end" ? toTime(toMinutes(end) - 15) : snapped;
    if (!end || toMinutes(end) <= toMinutes(start)) end = toTime(toMinutes(start) + 15);
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
    <div className="df-mobile-summary-head"><strong>{props.task.title}</strong><button type="button" className="df-mobile-more" onClick={props.onMore}>More</button></div>
    <div className="df-mobile-summary-project"><span className="df-detail-project-dot" style={{ background: project?.color || "#888" }} /><span>{zh ? "归属" : "Project"}</span><b>{project?.title || (zh ? "未归属" : "Unassigned")}</b></div>
    <div className="df-mobile-summary-times">
      <label><span>{zh ? "开始" : "Start"}</span><input type="time" step="900" value={startTime} onChange={(event) => commitTime("start", event.target.value)} /></label>
      <span aria-hidden="true">→</span>
      <label><span>{zh ? "结束" : "End"}</span><input type="time" step="900" value={endTime} onChange={(event) => commitTime("end", event.target.value)} /></label>
    </div>
    <div className="df-mobile-summary-actions">
      <button type="button" className={props.task.completed ? "active" : ""} onClick={props.onDone}>✓ {zh ? "完成" : "Done"}</button>
      <button type="button" onClick={props.onReturn}>↩ {zh ? "未完成" : "Unfinished"}</button>
      <button type="button" onClick={props.onMore}>{zh ? "子任务" : "Subtasks"} {countDoneSubtasks(props.task.subtasks)}/{countSubtasks(props.task.subtasks)}</button>
    </div>
  </aside>;
}
