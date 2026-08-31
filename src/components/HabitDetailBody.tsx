import { useEffect, useState } from "react";
import type { Habit, HabitDailyState, HabitTrackingType } from "../types";
import { isHabitDueOnDate } from "../utils/habits";
import { addDays } from "../utils/recurrence";
import "./habit-detail.css";

const STEP_MINUTES = 15;

type HabitDetailBodyProps = {
  habit: Habit;
  dailyStates: HabitDailyState[];
  today: string;
  zh: boolean;
  weekdays: string[];
  onSave: (patch: Partial<Habit>) => void;
  onArchive: (archived: boolean) => void;
  onBack: () => void;
};

export default function HabitDetailBody({ habit, dailyStates, today, zh, weekdays, onSave, onArchive, onBack }: HabitDetailBodyProps) {
  const [title, setTitle] = useState(habit.title);
  const [notes, setNotes] = useState(habit.notes || "");
  const [duration, setDuration] = useState(String(habit.defaultDurationMinutes || 20));
  const [activeWeekdays, setActiveWeekdays] = useState<number[]>(habit.activeWeekdays ?? [1, 2, 3, 4, 5]);
  const [targetCount, setTargetCount] = useState(String(habit.targetCount || ""));
  const [trackingType, setTrackingType] = useState<HabitTrackingType>(habit.trackingType || "click-counter");
  const [enabled, setEnabled] = useState(!habit.archived);
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    setTitle(habit.title);
    setNotes(habit.notes || "");
    setDuration(String(habit.defaultDurationMinutes || 20));
    setActiveWeekdays(habit.activeWeekdays ?? [1, 2, 3, 4, 5]);
    setTargetCount(String(habit.targetCount || ""));
    setTrackingType(habit.trackingType || "click-counter");
    setEnabled(!habit.archived);
    setWeekOffset(0);
  }, [habit.id, habit.updatedAt]);

  const toggleWeekday = (day: number) => setActiveWeekdays((days) => days.includes(day) ? days.filter((item) => item !== day) : [...days, day].sort());
  const saveChanges = () => {
    const parsedDuration = Number(duration);
    const parsedTarget = Number(targetCount);
    onSave({
      title: title.trim() || habit.title,
      notes,
      trackingType,
      defaultDurationMinutes: parsedDuration >= STEP_MINUTES && parsedDuration <= 480 && parsedDuration % STEP_MINUTES === 0 ? parsedDuration : habit.defaultDurationMinutes,
      activeWeekdays,
      targetCount: targetCount.trim() && parsedTarget >= 0 ? parsedTarget : undefined,
      archived: !enabled,
    });
  };
  const weekOrder = [1, 2, 3, 4, 5, 6, 0];
  const baseDay = addDays(today, weekOffset * 7);
  const weekStart = addDays(baseDay, -((new Date(`${baseDay}T00:00:00`).getDay() + 6) % 7));
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const dueDays = weekDays.filter((date) => isHabitDueOnDate(habit, date));
  const completedDates = new Set(dailyStates.filter((state) => state.habitId === habit.id && state.completed).map((state) => state.date));
  const range = `${weekDays[0].slice(5).replace("-", "/")} - ${weekDays[6].slice(5).replace("-", "/")}`;

  return <>
    <section className="df-habit-detail-progress" aria-label={zh ? "习惯完成情况" : "Habit completion"}>
      <header><div><strong>{range}</strong><span>{zh ? `本周完成 ${dueDays.filter((date) => completedDates.has(date)).length}/${dueDays.length}` : `${dueDays.filter((date) => completedDates.has(date)).length}/${dueDays.length} complete this week`}</span></div><div className="df-habit-detail-progress-actions"><button type="button" aria-label={zh ? "上一周" : "Previous week"} onClick={() => setWeekOffset((value) => value - 1)}>‹</button><button type="button" onClick={() => setWeekOffset(0)}>{zh ? "今天" : "Today"}</button><button type="button" aria-label={zh ? "下一周" : "Next week"} onClick={() => setWeekOffset((value) => value + 1)}>›</button></div></header>
      <div className="df-habit-detail-progress-days">{weekDays.map((date) => {
        const day = new Date(`${date}T00:00:00`).getDay();
        const due = isHabitDueOnDate(habit, date);
        const completed = completedDates.has(date);
        const label = `${zh ? `周${weekdays[day]}` : weekdays[day]} ${date.slice(8)}`;
        return <div key={date} className={`df-habit-detail-progress-day${due ? " is-due" : ""}${completed ? " is-complete" : ""}${date === today ? " is-today" : ""}`} title={label} aria-label={`${label}: ${completed ? (zh ? "已完成" : "Completed") : due ? (zh ? "未完成" : "Not completed") : (zh ? "无需检查" : "Not scheduled")}`}><b>{zh ? `周${weekdays[day]}` : weekdays[day]}</b><small>{date.slice(8)}</small><i aria-hidden="true">{completed && <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6l2.5 2.5L10 3" /></svg>}</i></div>;
      })}</div>
    </section>
    <section className="df-habit-settings-form">
      <label className="df-habit-setting-field df-habit-setting-field-title"><span>{zh ? "标题" : "Title"}</span><input type="text" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      <div className="df-habit-setting-field df-habit-setting-toggle"><span>{zh ? "启用" : "Enabled"}</span><button type="button" className={`df-habit-enabled-switch${enabled ? " is-on" : ""}`} role="switch" aria-checked={enabled} aria-label={zh ? "启用习惯" : "Enable habit"} onClick={() => setEnabled((value) => !value)}><i aria-hidden="true" /></button></div>
      <div className="df-habit-setting-field df-habit-type-field"><span>{zh ? "类型" : "Type"}</span><div className="df-habit-type-options" role="group" aria-label={zh ? "习惯类型" : "Habit type"}><button type="button" className={trackingType === "click-counter" ? "is-selected" : ""} aria-pressed={trackingType === "click-counter"} onClick={() => setTrackingType("click-counter")}>{zh ? "点击计数" : "Click Counter"}</button><button type="button" className={trackingType === "duration" ? "is-selected" : ""} aria-pressed={trackingType === "duration"} onClick={() => setTrackingType("duration")}>{zh ? "累积时长" : "Duration"}</button></div></div>
      {trackingType === "click-counter" ? <label className="df-habit-setting-field"><span>{zh ? "目标次数" : "Target Count"}</span><input type="number" min={0} value={targetCount} onChange={(event) => setTargetCount(event.target.value)} /></label> : <label className="df-habit-setting-field"><span>{zh ? "时长" : "Duration"}</span><input type="number" min={STEP_MINUTES} max={480} step={STEP_MINUTES} value={duration} onChange={(event) => setDuration(event.target.value)} /><small>{zh ? "以 15 分钟为单位" : "Set in 15-minute increments"}</small></label>}
      <div className="df-habit-setting-field df-habit-weekday-field"><span>{zh ? "检查连续的星期几 *" : "Weekdays to check *"}</span><div className="df-habit-weekday-checks">{weekOrder.map((day) => <button key={day} type="button" className={`df-habit-weekday-check${activeWeekdays.includes(day) ? " is-selected" : ""}`} onClick={() => toggleWeekday(day)} aria-pressed={activeWeekdays.includes(day)}><i aria-hidden="true">{activeWeekdays.includes(day) && <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6l2.5 2.5L10 3" /></svg>}</i><strong>{zh ? `星期${weekdays[day]}` : weekdays[day]}</strong></button>)}</div></div>
      <label className="df-habit-setting-field"><span>{zh ? "备注" : "Notes"}</span><textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
    </section>
    <section className="df-settings-group df-habit-detail-actions"><button type="button" className="df-habit-back-btn" onClick={onBack}>{zh ? "返回总览" : "Back to overview"}</button><button type="button" className="df-habit-save-btn" onClick={saveChanges}>{zh ? "保存" : "Save"}</button><button type="button" className="df-habit-archive-btn" onClick={() => onArchive(!habit.archived)}>{habit.archived ? (zh ? "恢复习惯" : "Restore Habit") : (zh ? "归档习惯" : "Archive Habit")}</button></section>
  </>;
}
