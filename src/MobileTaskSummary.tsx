import { Fragment, useEffect, useRef, useState, type CSSProperties, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { Category, Language, NullablePriority, Priority, Project, Subtask, Task, TaskRecurrence, TimelineRecord } from "./types";
import { clockTimeSpanMinutes, rescheduleTimelineRecord, timelineRecordDurationMinutes } from "./utils/timelineRecords";
import { toggleSubtaskInTree } from "./utils/treeOrder";
import "./mobile-task-summary.css";

export type MobileShortSheetKind = "task" | "project" | "habit";
type QuickProject = { id: string; title: string; color?: string };
const sheetLabels = {
  zh: { task: "新任务", project: "新项目", habit: "新习惯", more: "更多", close: "关闭", choose: "选择添加类型" },
  en: { task: "New task", project: "New project", habit: "New habit", more: "More", close: "Close", choose: "Choose what to add" },
} as const;

export function beginVerticalResize(event: PointerEvent, stepHeight: number, onDelta: (steps: number) => void, onFinish: () => void, captureTarget?: Element | null) {
  const { pointerId, clientY } = event;
  document.body.classList.add("df-resizing");
  const pointerTarget = captureTarget instanceof HTMLElement ? captureTarget : event.target instanceof HTMLElement ? event.target : null;
  try { pointerTarget?.setPointerCapture(pointerId); } catch { /* Pointer may already be captured. */ }
  const apply = (next: PointerEvent) => {
    if (next.pointerId !== pointerId) return false;
    onDelta(Math.round((next.clientY - clientY) / stepHeight));
    return true;
  };
  const move = (next: PointerEvent) => { if (apply(next)) next.preventDefault(); };
  const finish = (next: PointerEvent) => {
    if (!apply(next)) return;
    document.body.classList.remove("df-resizing");
    try { if (pointerTarget?.hasPointerCapture(pointerId)) pointerTarget.releasePointerCapture(pointerId); } catch { /* Pointer already released. */ }
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", finish);
    window.removeEventListener("pointercancel", finish);
    onFinish();
  };
  window.addEventListener("pointermove", move, { passive: false });
  window.addEventListener("pointerup", finish);
  window.addEventListener("pointercancel", finish);
}

export function MobileShortSheet(props: {
  lang: Language; kind?: MobileShortSheetKind; kinds?: MobileShortSheetKind[]; showKind?: boolean;
  title: string; titlePlaceholder?: string; titleLabel?: string; autoFocus?: boolean;
  onTitleChange: (title: string) => void; onTitleBlur?: (title: string) => void; onTitleEnter?: () => void;
  onKindChange?: (kind: MobileShortSheetKind) => void; onClose: () => void; onMore?: () => void;
  onSwipeDown?: () => void; moreDisabled?: boolean; className?: string; swipeDownToClose?: boolean; swipeUpForMore?: boolean; children?: ReactNode;
}) {
  const locale = props.lang === "zh" ? sheetLabels.zh : sheetLabels.en;
  const kind = props.kind || "task";
  const kinds = props.kinds || ["task", "project", "habit"];
  const inputRef = useRef<HTMLInputElement>(null);
  const gestureRef = useRef<{ pointerId: number; startY: number; panel: HTMLElement } | null>(null);
  useEffect(() => {
    if (!props.autoFocus) return;
    const input = inputRef.current;
    const panel = input?.closest<HTMLElement>(".df-mobile-short-sheet");
    if (!input || !panel) return;
    let frame = 0;
    const align = () => {
      cancelAnimationFrame(frame);
      panel.style.removeProperty("--mobile-keyboard-lift");
      frame = requestAnimationFrame(() => {
      const viewport = window.visualViewport;
        const visibleBottom = (viewport?.offsetTop || 0) + (viewport?.height || document.documentElement.clientHeight);
        const lift = Math.max(0, input.getBoundingClientRect().bottom + 16 - visibleBottom);
        panel.style.setProperty("--mobile-keyboard-lift", `${lift}px`);
      });
    };
    align();
    window.visualViewport?.addEventListener("resize", align);
    window.visualViewport?.addEventListener("scroll", align);
    window.addEventListener("resize", align);
    input.addEventListener("focus", align);
    return () => {
      cancelAnimationFrame(frame);
      panel.style.removeProperty("--mobile-keyboard-lift");
      window.visualViewport?.removeEventListener("resize", align);
      window.visualViewport?.removeEventListener("scroll", align);
      window.removeEventListener("resize", align);
      input.removeEventListener("focus", align);
    };
  }, [props.autoFocus]);
  const finishGesture = (event: React.PointerEvent<HTMLButtonElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    gesture.panel.classList.remove("is-sheet-dragging");
    gesture.panel.style.removeProperty("--mobile-sheet-drag-y");
    const distance = event.clientY - gesture.startY;
    if (distance > 72 && props.swipeDownToClose) (props.onSwipeDown || props.onClose)();
    else if (distance < -54 && props.swipeUpForMore && props.onMore && !props.moreDisabled) props.onMore();
  };
  return <aside className={`df-drawer df-task-detail df-mobile-task-summary df-mobile-short-sheet${props.className ? ` ${props.className}` : ""}`} onMouseDown={(event) => event.stopPropagation()}>
    <button className="df-detail-close df-icon-action i-close" type="button" aria-label={locale.close} onClick={props.onClose} />
    <button type="button" className="df-mobile-sheet-grabber" aria-label={props.lang === "zh" ? "上下滑动短栏" : "Swipe sheet"} onPointerDown={(event) => { if (event.pointerType === "mouse" && event.button !== 0) return; const panel = event.currentTarget.parentElement; if (!panel) return; event.currentTarget.setPointerCapture(event.pointerId); panel.classList.add("is-sheet-dragging"); gestureRef.current = { pointerId: event.pointerId, startY: event.clientY, panel }; }} onPointerMove={(event) => { const gesture = gestureRef.current; if (!gesture || gesture.pointerId !== event.pointerId) return; const distance = event.clientY - gesture.startY; gesture.panel.style.setProperty("--mobile-sheet-drag-y", `${Math.max(-24, distance)}px`); }} onPointerUp={finishGesture} onPointerCancel={finishGesture} />
    {props.showKind && <label className="df-mobile-short-sheet-kind-wrap"><span className="df-visually-hidden">{locale.choose}</span><select className="df-mobile-short-sheet-kind" value={kind} aria-label={locale.choose} onChange={(event) => props.onKindChange?.(event.target.value as MobileShortSheetKind)}>{kinds.map((option) => <option key={option} value={option}>{locale[option]}</option>)}</select></label>}
    <div className="df-mobile-summary-head"><input ref={inputRef} autoFocus={props.autoFocus} value={props.title} aria-label={props.titleLabel || (props.lang === "zh" ? "名称" : "Title")} placeholder={props.titlePlaceholder} onChange={(event) => props.onTitleChange(event.target.value)} onBlur={(event) => props.onTitleBlur?.(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); props.onTitleEnter?.(); } }} />{props.onMore && <button type="button" className="df-mobile-more" disabled={props.moreDisabled} onClick={props.onMore}>{locale.more}</button>}</div>
    {props.children}
  </aside>;
}

export function MobileQuickAddSheet(props: {
  lang: Language; kind: MobileShortSheetKind; kinds: MobileShortSheetKind[]; title: string; projects: QuickProject[];
  projectId: string; projectColor: string; habitMinutes: number; onTitleChange: (title: string) => void;
  onKindChange: (kind: MobileShortSheetKind) => void; onProjectChange: (projectId: string) => void;
  onProjectColorChange: (color: string) => void; onHabitMinutesChange: (minutes: number) => void;
  onClose: () => void; onSubmit: () => void; onMore: () => void;
}) {
  const zh = props.lang === "zh";
  const project = props.projects.find((item) => String(item.id) === String(props.projectId));
  const placeholder = props.kind === "task" ? (zh ? "任务名称" : "Task title") : props.kind === "project" ? (zh ? "项目名称" : "Project title") : (zh ? "习惯名称" : "Habit title");
  return <MobileShortSheet lang={props.lang} kind={props.kind} kinds={props.kinds} showKind title={props.title} titlePlaceholder={placeholder} titleLabel={zh ? "名称" : "Title"} autoFocus onTitleChange={props.onTitleChange} onTitleEnter={props.onSubmit} onKindChange={props.onKindChange} onClose={props.onClose} onMore={props.onMore} moreDisabled={!props.title.trim()} swipeDownToClose swipeUpForMore className="df-mobile-quick-add-sheet">
    {props.kind === "task" && <label className="df-mobile-summary-project"><span className="df-detail-project-dot" style={{ background: project?.color || "#888" }} /><span>{zh ? "归属" : "Project"}</span><select value={props.projectId} onChange={(event) => props.onProjectChange(event.target.value)}><option value="">{zh ? "未归属" : "Unassigned"}</option>{props.projects.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}
    {props.kind === "project" && <label className="df-mobile-short-sheet-field"><span>{zh ? "颜色" : "Color"}</span><input type="color" value={props.projectColor} onChange={(event) => props.onProjectColorChange(event.target.value)} /></label>}
    {props.kind === "habit" && <label className="df-mobile-short-sheet-field"><span>{zh ? "默认时长" : "Default duration"}</span><input type="number" min={5} max={480} step={5} value={props.habitMinutes} onChange={(event) => props.onHabitMinutesChange(Math.max(5, Math.min(480, Number(event.target.value) || 20)))} /><strong>min</strong></label>}
    <div className="df-mobile-summary-actions"><button type="button" className="df-mobile-add-subtask" disabled={!props.title.trim()} onClick={props.onSubmit}>{zh ? "添加" : "Add"}</button></div>
  </MobileShortSheet>;
}

export function MobileTimelineDraftSheet(props: {
  lang: Language; title: string; projects: QuickProject[]; projectId: string; startMinutes: number; endMinutes: number;
  date: string; subtasks: Subtask[];
  addingSubtask: boolean; subtaskTitle: string; onTitleChange: (title: string) => void; onProjectChange: (id: string) => void;
  onRangeChange: (edge: "start" | "end", minutes: number) => void; onStartSubtask: () => void;
  onSubtaskTitleChange: (title: string) => void; onAddSubtask: () => void; onCancelSubtask: () => void;
  onClose: () => void; onSwipeDown: () => void; onSubmit: () => void; onMore: () => void;
}) {
  const zh = props.lang === "zh";
  const project = props.projects.find((item) => String(item.id) === props.projectId);
  const toTime = (minutes: number) => `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  const timeOptions = Array.from({ length: 96 }, (_, index) => toTime(index * 15));
  const dateLabel = new Intl.DateTimeFormat(zh ? "zh-CN" : "en-US", { month: "short", day: "numeric", weekday: "short" }).format(new Date(`${props.date}T00:00:00`));
  const duration = props.endMinutes - props.startMinutes;
  const durationLabel = zh ? `${Math.floor(duration / 60) ? `${Math.floor(duration / 60)}小时` : ""}${duration % 60 ? `${duration % 60}分钟` : ""}` : `${Math.floor(duration / 60) ? `${Math.floor(duration / 60)}h ` : ""}${duration % 60 ? `${duration % 60}m` : ""}`;
  return <MobileShortSheet lang={props.lang} kind="task" title={props.title} titlePlaceholder={zh ? "任务名称" : "Task title"} titleLabel={zh ? "任务名称" : "Task title"} onTitleChange={props.onTitleChange} onTitleEnter={props.onSubmit} onClose={props.onClose} onSwipeDown={props.onSwipeDown} onMore={props.onMore} moreDisabled={!props.title.trim()} swipeDownToClose swipeUpForMore className="df-timeline-draft-sheet">
    <label className="df-mobile-summary-project df-timeline-draft-project"><span className="df-detail-project-dot" style={{ background: project?.color || "#888" }} /><span>{zh ? "归属" : "Project"}</span><select value={props.projectId} onChange={(event) => props.onProjectChange(event.target.value)}><option value="">{zh ? "未归属" : "Unassigned"}</option>{props.projects.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
    <div className="df-mobile-summary-times df-timeline-draft-times">{(["start", "end"] as const).map((edge, index) => <Fragment key={edge}>{index > 0 && <span aria-hidden="true">→</span>}<label><span>{edge === "start" ? (zh ? "开始" : "Start") : (zh ? "结束" : "End")}</span><select aria-label={edge === "start" ? (zh ? "开始时间" : "Start time") : (zh ? "结束时间" : "End time")} value={toTime(props[`${edge}Minutes`])} onChange={(event) => { const [hours, minutes] = event.target.value.split(":").map(Number); props.onRangeChange(edge, hours * 60 + minutes); }}>{timeOptions.map((time) => <option key={time}>{time}</option>)}</select></label></Fragment>)}</div>
    <time className="df-timeline-draft-date" dateTime={props.date}>{dateLabel} · {durationLabel}</time>
    <div className="df-mobile-summary-actions"><button type="button" className="df-mobile-add-subtask" onClick={props.onStartSubtask}>＋ {zh ? "添加子任务" : "Add subtask"}</button><button type="button" className="df-mobile-submit" disabled={!props.title.trim()} onClick={props.onSubmit}>{zh ? "添加" : "Add"}</button></div>
    {props.addingSubtask && <div className="df-mobile-summary-subtask-add"><input autoFocus value={props.subtaskTitle} onChange={(event) => props.onSubtaskTitleChange(event.target.value)} placeholder={zh ? "输入子任务名称" : "Subtask title"} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); props.onAddSubtask(); } if (event.key === "Escape") props.onCancelSubtask(); }} /><button type="button" disabled={!props.subtaskTitle.trim()} onClick={props.onAddSubtask}>{zh ? "添加" : "Add"}</button></div>}
    {props.subtasks.length > 0 && <section className="df-mobile-summary-subtasks"><header><b>{zh ? "子任务" : "Subtasks"}</b><span>{props.subtasks.length}</span></header><div className="df-mobile-summary-subtask-list">{props.subtasks.map((subtask) => <label key={subtask.id}><input type="checkbox" checked={false} readOnly /><span>{subtask.title}</span></label>)}</div></section>}
  </MobileShortSheet>;
}

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
}) {
  const zh = props.lang === "zh";
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");
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
  function addSubtask() {
    const title = subtaskTitle.trim();
    if (!title) return;
    const now = new Date().toISOString();
    props.onUpdate(props.task.id, {
      subtasks: [...(props.task.subtasks || []), {
        id: `subtask_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`,
        title,
        completed: false,
        createdAt: now,
        order: Date.now(),
        subtasks: [],
      }],
    });
    setSubtaskTitle("");
    setAddingSubtask(false);
  }
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
  return <MobileShortSheet lang={props.lang} title={props.form.title} titleLabel={zh ? "任务名称" : "Task title"} onTitleChange={(title) => props.setForm((current) => ({ ...current, title }))} onTitleBlur={(title) => props.onUpdate(props.task.id, { title: title.trim() || props.task.title })} onTitleEnter={() => (document.activeElement as HTMLElement | null)?.blur()} onClose={props.onClose} onMore={props.onMore} swipeDownToClose swipeUpForMore>
    <label className="df-mobile-summary-project"><span className="df-detail-project-dot" style={{ background: project?.color || "#888" }} /><span>{zh ? "归属" : "Project"}</span><select value={props.form.projectId} onChange={(event) => { const projectId = event.target.value; props.setForm((current) => ({ ...current, projectId })); props.onUpdate(props.task.id, { projectId: projectId || undefined }); }}><option value="">{zh ? "未归属" : "Unassigned"}</option>{props.projects.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
    <div className="df-mobile-summary-times">
      <label><span>{zh ? "开始" : "Start"}</span><select aria-label={zh ? "开始时间" : "Start time"} value={startTime} onChange={(event) => commitTime("start", event.target.value)}><option value="">--:--</option>{timeOptions.map((time) => <option key={time}>{time}</option>)}</select></label>
      <span aria-hidden="true">→</span>
      <label><span>{zh ? "结束" : "End"}</span><select aria-label={zh ? "结束时间" : "End time"} value={endTime} onChange={(event) => commitTime("end", event.target.value)}><option value="">--:--</option>{timeOptions.map((time) => <option key={time}>{time}</option>)}</select></label>
    </div>
    <div className="df-mobile-summary-actions df-mobile-summary-status-actions">
      <button type="button" className="df-mobile-add-subtask" onClick={() => setAddingSubtask(true)}>＋ {zh ? "添加子任务" : "Add subtask"}</button>
      <button type="button" aria-pressed={props.task.completed} className={props.task.completed ? "active" : ""} onClick={() => props.onUpdate(props.task.id, { completed: true })}>✓ {zh ? "完成" : "Complete"}</button>
      <button type="button" aria-pressed={!props.task.completed} className={!props.task.completed ? "active" : ""} onClick={() => props.onUpdate(props.task.id, { completed: false })}>↩ {zh ? "未完成" : "Incomplete"}</button>
    </div>
    {addingSubtask && <form className="df-mobile-summary-subtask-add" onSubmit={(event) => { event.preventDefault(); addSubtask(); }}>
      <input autoFocus value={subtaskTitle} onChange={(event) => setSubtaskTitle(event.target.value)} placeholder={zh ? "输入子任务名称" : "Subtask title"} onKeyDown={(event) => { if (event.key === "Escape") { setAddingSubtask(false); setSubtaskTitle(""); } }} />
      <button type="submit" disabled={!subtaskTitle.trim()}>{zh ? "添加" : "Add"}</button>
    </form>}
    {subtasks.length > 0 && <section className="df-mobile-summary-subtasks" aria-label={zh ? "子任务" : "Subtasks"}><header><b>{zh ? "子任务" : "Subtasks"}</b><span>{subtasks.filter(({ item }) => item.completed || item.done).length}/{subtasks.length}</span></header><div className="df-mobile-summary-subtask-list">{subtasks.map(({ item, depth }) => <label key={item.id} style={{ "--subtask-depth": depth } as CSSProperties}><input type="checkbox" checked={Boolean(item.completed || item.done)} onChange={() => props.onUpdate(props.task.id, { subtasks: toggleSubtaskInTree(props.task.subtasks || [], item.id) })} /><span>{item.title}</span></label>)}</div></section>}
  </MobileShortSheet>;
}
