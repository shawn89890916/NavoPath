import { useEffect, useState } from "react";
import "./ProactiveAssistantInbox.css";
import type { Language, PlannerData } from "../types";
import { listProactiveNotifications, markProactiveNotificationRead, recordGapActivity, type ProactiveNotification } from "../proactiveAssistant";

export function ProactiveAssistantInbox({ data, lang, onSaveData }: { data: PlannerData; lang: Language; onSaveData: (data: PlannerData) => void }) {
  const [items, setItems] = useState<ProactiveNotification[]>([]);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void listProactiveNotifications().then((next) => { if (active) setItems(next); }).catch(() => { if (active) setItems([]); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const dismiss = async (id: string) => {
    await markProactiveNotificationRead(id).catch(() => undefined);
    setItems((current) => current.filter((item) => item.id !== id));
  };
  const logGap = async (item: ProactiveNotification) => {
    const metadata = item.metadata;
    if (!metadata?.date || !metadata.startTime || !metadata.endTime) return;
    const selected = selection[item.id];
    const title = selected === "__new__" ? window.prompt(lang === "zh" ? "新任务名称" : "New task title")?.trim() : "";
    if (!selected || (selected === "__new__" && !title)) return;
    onSaveData(recordGapActivity(data, { taskId: selected === "__new__" ? undefined : selected, newTaskTitle: title, date: metadata.date, startTime: metadata.startTime, endTime: metadata.endTime }));
    await dismiss(item.id);
  };

  if (loading || items.length === 0) return null;
  return <section className="df-proactive-inbox" aria-label={lang === "zh" ? "主动助理提醒" : "Proactive assistant notifications"}>
    <div className="df-proactive-inbox-head"><strong>{lang === "zh" ? "主动助理" : "Proactive assistant"}</strong><small>{lang === "zh" ? "需要你的输入" : "Needs your input"}</small></div>
    {items.map((item) => <article key={item.id} className="df-proactive-notice">
      <strong>{item.title}</strong><p>{item.body}</p>
      {item.kind === "gap_check" && item.metadata?.date ? <div className="df-proactive-gap-actions">
        <select value={selection[item.id] || ""} onChange={(event) => setSelection((current) => ({ ...current, [item.id]: event.target.value }))} aria-label={lang === "zh" ? "选择实际执行的任务" : "Choose completed task"}>
          <option value="">{lang === "zh" ? "选择任务…" : "Choose task…"}</option>
          <option value="__new__">{lang === "zh" ? "+ 新建任务" : "+ New task"}</option>
          {data.tasks.filter((task) => !task.completed).map((task) => <option value={task.id} key={task.id}>{task.title}</option>)}
        </select>
        <button type="button" onClick={() => void logGap(item)}>{lang === "zh" ? "补记到时间轴" : "Log on timeline"}</button>
      </div> : null}
      <button type="button" className="df-proactive-dismiss" onClick={() => void dismiss(item.id)}>{lang === "zh" ? "稍后处理" : "Dismiss"}</button>
    </article>)}
  </section>;
}
