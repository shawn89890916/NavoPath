import { useState, type ReactNode } from "react";
import type { Language } from "./types";
import "./mobile-task-summary.css";

export type MobileShortSheetKind = "task" | "project" | "habit";

const labels = {
  zh: { task: "新任务", project: "新项目", habit: "新习惯", more: "更多", close: "关闭", choose: "选择添加类型" },
  en: { task: "New task", project: "New project", habit: "New habit", more: "More", close: "Close", choose: "Choose what to add" },
} as const;

export default function MobileShortSheet(props: {
  lang: Language;
  kind?: MobileShortSheetKind;
  kinds?: MobileShortSheetKind[];
  showKind?: boolean;
  title: string;
  titlePlaceholder?: string;
  titleLabel?: string;
  autoFocus?: boolean;
  onTitleChange: (title: string) => void;
  onTitleBlur?: (title: string) => void;
  onTitleEnter?: () => void;
  onKindChange?: (kind: MobileShortSheetKind) => void;
  onClose: () => void;
  onMore?: () => void;
  moreDisabled?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const [kindMenuOpen, setKindMenuOpen] = useState(false);
  const locale = props.lang === "zh" ? labels.zh : labels.en;
  const kind = props.kind || "task";
  const kinds = props.kinds || ["task", "project", "habit"];
  return (
    <aside className={`df-drawer df-task-detail df-mobile-task-summary df-mobile-short-sheet${props.className ? ` ${props.className}` : ""}`} onMouseDown={(event) => event.stopPropagation()}>
      <button className="df-detail-close df-icon-action i-close" type="button" aria-label={locale.close} onClick={props.onClose} />
      <div className="df-mobile-sheet-grabber" aria-hidden="true" />
      {props.showKind && <div className="df-mobile-short-sheet-kind-wrap">
        <button type="button" className="df-mobile-short-sheet-kind" aria-expanded={kindMenuOpen} onClick={() => props.onKindChange && setKindMenuOpen((open) => !open)}>
          <span>{locale[kind]}</span>{props.onKindChange ? <span aria-hidden="true">⌄</span> : null}
        </button>
        {kindMenuOpen && props.onKindChange && <div className="df-mobile-short-sheet-kind-menu" aria-label={locale.choose}>
          {kinds.map((option) => <button type="button" key={option} className={option === kind ? "active" : ""} onClick={() => { props.onKindChange?.(option); setKindMenuOpen(false); }}>{locale[option]}</button>)}
        </div>}
      </div>}
      <div className="df-mobile-summary-head">
        <input autoFocus={props.autoFocus} value={props.title} aria-label={props.titleLabel || (props.lang === "zh" ? "名称" : "Title")} placeholder={props.titlePlaceholder} onChange={(event) => props.onTitleChange(event.target.value)} onBlur={(event) => props.onTitleBlur?.(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); props.onTitleEnter?.(); } }} />
        {props.onMore && <button type="button" className="df-mobile-more" disabled={props.moreDisabled} onClick={props.onMore}>{locale.more}</button>}
      </div>
      {props.children}
    </aside>
  );
}
