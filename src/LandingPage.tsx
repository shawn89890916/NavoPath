import { useEffect, useMemo, useRef, useState } from "react";
import { ProductIcon } from "./main";
import { TaskBlock } from "./components/TaskBlock";
import { DESKTOP_DOWNLOAD_URL } from "./downloads";
import { SLOT_HEIGHT, SLOT_MINUTES, addMinutes, minutesToTime, timeToMinutes } from "./timelineGeometry";

type AuthIntent = "signin" | "signup";
type Lang = "en" | "zh";
type HeroStep = "idle" | "flipped" | "expanded" | "placed";

const DEMO_PROJECT_COLOR = "#7EA172";
const DEMO_HOUR_HEIGHT = 68;
const DEMO_MIN_BLOCK_HEIGHT = 44;

function ceilToSlot(minutes: number) {
  return Math.min(24 * 60 - SLOT_MINUTES, Math.ceil(minutes / SLOT_MINUTES) * SLOT_MINUTES);
}

function clampMinutes(minutes: number) {
  return Math.max(0, Math.min(24 * 60 - SLOT_MINUTES, minutes));
}

function formatDemoDate(date: Date) {
  return {
    day: String(date.getDate()),
    weekday: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date),
  };
}

function timeBlockTopLocal(startTime: string, startHour: number) {
  let diff = timeToMinutes(startTime) - startHour * 60;
  if (diff < 0) diff += 24 * 60;
  return (diff / 60) * DEMO_HOUR_HEIGHT;
}

function timeBlockHeightLocal(startTime: string, endTime: string) {
  return Math.max(((timeToMinutes(endTime) - timeToMinutes(startTime)) / 60) * DEMO_HOUR_HEIGHT - 4, DEMO_MIN_BLOCK_HEIGHT);
}

const DONATION_URL = "https://afdian.com/a/233cxy/plan";

const copy = {
  en: {
    nav: ["Demo", "Everyday", "Principles"],
    login: "Log in",
    donate: "Support",
    kicker: "A daily planner for real life",
    title: "Plan the work. Then make room for the day.",
    heroLines: ["Plan the work.", "Make room", "for the day."],
    intro: "NavoPath turns scattered commitments into a short candidate list and a clean timeline you can actually follow.",
    tap: "click me",
    start: "Start planning",
    signIn: "Open workspace",
    download: "Download for Windows",
    candidate: "Today's candidates",
    timeline: "Timeline",
    demoHint: "Drag the task into the open slot",
    placedHint: "Good. The task now has a real place to happen.",
    everydayTitle: "Built around the day you already have.",
    everydayIntro: "Use ordinary examples, not abstract productivity theater: schoolwork, commute windows, dinner prep, calls, errands, and focus time.",
    examples: [
      ["08:20", "Commute", "Read two pages"],
      ["12:40", "Lunch gap", "Send one reply"],
      ["17:30", "After work", "Pick up groceries"],
      ["20:15", "Quiet block", "Fold laundry"],
    ],
    principlesTitle: "Guidance first. Dashboard second.",
    principles: [
      "Candidate tasks stay small enough to decide.",
      "The timeline shows tradeoffs before the day breaks.",
      "AI can suggest a schedule, but your hand makes the final placement.",
    ],
    ctaTitle: "Give the next useful task a time and a place.",
    ctaBody: "Open the workspace, sign in, or keep scrolling through the product story.",
    ctaDonate: "Support ongoing development",
    footer: "NavoPath / Plan the path. Execute today.",
  },
  zh: {
    nav: ["演示", "日常", "原则"],
    login: "登录",
    donate: "支持",
    kicker: "为真实生活设计的每日计划器",
    title: "先想清楚要做什么，再给今天留出位置。",
    heroLines: ["先想清楚", "再给今天", "留出位置"],
    intro: "NavoPath 把零散任务收进今日候选框，再放进清爽的时间轴里，让计划能落到真实的一天。",
    tap: "click me",
    start: "开始规划",
    signIn: "打开工作区",
    download: "下载 Windows 版",
    candidate: "今日候选",
    timeline: "时间轴",
    demoHint: "把任务拖进空档",
    placedHint: "很好，这件事现在有了真正发生的位置。",
    everydayTitle: "围绕你本来就会遇到的一天。",
    everydayIntro: "这里用更日常的例子：通勤、课业、晚饭、电话、申请材料和真正需要安静完成的时间块。",
    examples: [
      ["08:20", "通勤", "读两页书"],
      ["12:40", "午休", "回一封消息"],
      ["17:30", "下班后", "买晚饭食材"],
      ["20:15", "安静时间", "整理衣物"],
    ],
    principlesTitle: "先引导，再呈现功能。",
    principles: [
      "候选任务要小到今天真的能判断。",
      "时间轴先暴露取舍，再让一天开始。",
      "AI 可以提出排程，但最后一拖由你决定。",
    ],
    ctaTitle: "给下一件真正重要的事，留出发生的位置。",
    ctaBody: "登录开始使用，或继续下滑看完整产品叙事。",
    ctaDonate: "支持后续开发",
    footer: "NavoPath / 规划路径，执行今天。",
  },
};

function playNavoSound(kind: "open" | "place" | "hover" = "open") {
  if (typeof window === "undefined") return;
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  const context = new AudioContextClass();
  const now = context.currentTime;
  const master = context.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(kind === "hover" ? 0.025 : 0.08, now + 0.015);
  master.gain.exponentialRampToValueAtTime(0.0001, now + (kind === "place" ? 0.42 : 0.28));
  master.connect(context.destination);

  const notes = kind === "place" ? [220, 330, 495] : kind === "hover" ? [330] : [196, 294, 392];
  notes.forEach((frequency, index) => {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = index === 0 ? "sine" : "triangle";
    osc.frequency.setValueAtTime(frequency, now + index * 0.045);
    gain.gain.setValueAtTime(0.0001, now + index * 0.045);
    gain.gain.exponentialRampToValueAtTime(kind === "hover" ? 0.08 : 0.18, now + index * 0.045 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.045 + 0.2);
    osc.connect(gain).connect(master);
    osc.start(now + index * 0.045);
    osc.stop(now + index * 0.045 + 0.24);
  });

  window.setTimeout(() => void context.close(), 520);
}

function HeroInteraction({ lang, onStart }: { lang: Lang; onStart: () => void }) {
  const [step, setStep] = useState<HeroStep>("idle");
  const [dragGhost, setDragGhost] = useState<{ x: number; y: number; index: number; task: string } | null>(null);
  const [placedTask, setPlacedTask] = useState<string | null>(null);
  const [placedIndex, setPlacedIndex] = useState<number | null>(null);
  const [placedStart, setPlacedStart] = useState<string | null>(null);
  const [hoverStart, setHoverStart] = useState<string>("");
  const [fitStyle, setFitStyle] = useState<React.CSSProperties>({});
  const floatingTaskRef = useRef<HTMLButtonElement | null>(null);
  const firstCandidateRef = useRef<HTMLButtonElement | null>(null);
  const timelineRef = useRef<HTMLElement | null>(null);
  const timelineGridRef = useRef<HTMLDivElement | null>(null);
  const dragGhostRef = useRef<{ x: number; y: number; index: number; task: string } | null>(null);
  const timersRef = useRef<number[]>([]);
  const c = copy[lang];
  const demoNow = useMemo(() => new Date(), []);
  const demoDate = useMemo(() => formatDemoDate(demoNow), [demoNow]);
  const nowMinutes = demoNow.getHours() * 60 + demoNow.getMinutes();
  const startHour = Math.max(0, Math.min(18, Math.floor((nowMinutes - 90) / 60)));
  const targetMinutes = ceilToSlot(Math.max(nowMinutes + 25, startHour * 60 + 135));
  const targetStart = minutesToTime(clampMinutes(targetMinutes));
  const targetEnd = addMinutes(targetStart, 45);
  const hourLabels = Array.from({ length: 7 }, (_, index) => startHour + index).filter((hour) => hour <= 24);
  const nowTop = ((nowMinutes - startHour * 60) / 60) * DEMO_HOUR_HEIGHT;
  const scheduledBlocks = [
    { title: "Commute reading", start: minutesToTime(clampMinutes(startHour * 60 + 30)), end: minutesToTime(clampMinutes(startHour * 60 + 75)), color: "#D7816A", done: true },
    { title: "Daily sync", start: minutesToTime(clampMinutes(startHour * 60 + 82)), end: minutesToTime(clampMinutes(startHour * 60 + 127)), color: "#584D3D", done: true },
    { title: "Project review", start: addMinutes(targetStart, 70), end: addMinutes(targetStart, 115), color: "#0F0326", done: false },
  ].filter((block) => timeToMinutes(block.end) > startHour * 60);

  useEffect(() => () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const activate = () => {
    if (step !== "idle") return;
    floatingTaskRef.current?.style.removeProperty("transform");
    floatingTaskRef.current?.style.removeProperty("filter");
    const cardRect = floatingTaskRef.current?.getBoundingClientRect();
    const targetRect = firstCandidateRef.current?.getBoundingClientRect();
    if (cardRect && targetRect) {
      const cardCenterX = cardRect.left + cardRect.width / 2;
      const cardCenterY = cardRect.top + cardRect.height / 2;
      const targetCenterX = targetRect.left + targetRect.width / 2;
      const targetCenterY = targetRect.top + targetRect.height / 2;
      setFitStyle({
        "--fit-x": `${targetCenterX - cardCenterX}px`,
        "--fit-y": `${targetCenterY - cardCenterY}px`,
        "--fit-w": `${targetRect.width}px`,
        "--fit-h": `${targetRect.height}px`,
      } as React.CSSProperties);
    }
    playNavoSound("open");
    setStep("flipped");
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [window.setTimeout(() => setStep("expanded"), 1040)];
  };

  const placeOnTimeline = (task = dragGhostRef.current?.task ?? dragGhost?.task ?? tasks[0], index = dragGhostRef.current?.index ?? dragGhost?.index ?? 0, startTime = hoverStart || targetStart) => {
    if (step === "placed") return;
    playNavoSound("place");
    setPlacedTask(task);
    setPlacedIndex(index);
    setPlacedStart(startTime);
    setHoverStart("");
    dragGhostRef.current = null;
    setDragGhost(null);
    setStep("placed");
  };

  const skipIntro = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    placeOnTimeline(tasks[0], 0, targetStart);
  };

  const isInsideCardMagnet = (clientX: number, clientY: number) => {
    const rect = floatingTaskRef.current?.getBoundingClientRect();
    if (!rect) return false;
    const padX = Math.min(190, rect.width * 0.48);
    const padY = Math.min(150, rect.height * 0.58);
    return clientX >= rect.left - padX && clientX <= rect.right + padX && clientY >= rect.top - padY && clientY <= rect.bottom + padY;
  };

  const applyCardTilt = (clientX: number, clientY: number) => {
    const button = floatingTaskRef.current;
    const rect = button?.getBoundingClientRect();
    if (!button || !rect) return;
    const relativeX = Math.max(-0.5, Math.min(0.5, (clientX - (rect.left + rect.width / 2)) / (rect.width * 0.78)));
    const relativeY = Math.max(-0.5, Math.min(0.5, (clientY - (rect.top + rect.height / 2)) / (rect.height * 0.78)));
    button.style.setProperty("--tilt-x", `${relativeX * 24}deg`);
    button.style.setProperty("--tilt-y", `${relativeY * -18}deg`);
    button.style.setProperty("transform", `rotateX(${relativeY * -18}deg) rotateY(${relativeX * 24}deg) translateZ(0)`, "important");
    button.style.setProperty("filter", "drop-shadow(0 30px 38px rgba(39, 35, 30, .2))", "important");
  };

  const resetTilt = () => {
    const button = floatingTaskRef.current;
    if (!button) return;
    button.style.setProperty("--tilt-x", "0deg");
    button.style.setProperty("--tilt-y", "0deg");
    button.style.removeProperty("transform");
    button.style.removeProperty("filter");
  };

  const onMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (step === "expanded" && dragGhostRef.current) {
      moveCandidateDrag(event);
      return;
    }
    if (step !== "idle") return;
    applyCardTilt(event.clientX, event.clientY);
  };

  const onOrbitMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (step !== "idle") return;
    if (isInsideCardMagnet(event.clientX, event.clientY)) applyCardTilt(event.clientX, event.clientY);
    else resetTilt();
  };

  const onOrbitClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (step !== "idle") return;
    const target = event.target as HTMLElement;
    if (target.closest(".landing-floating-task")) return;
    if (isInsideCardMagnet(event.clientX, event.clientY)) activate();
  };

  const tasks = ["Read 20 pages"];

  const getTimelineStartFromPointer = (clientY: number) => {
    const gridRect = timelineGridRef.current?.getBoundingClientRect();
    if (!gridRect) return targetStart;
    const relativeY = Math.max(0, Math.min(gridRect.height - SLOT_HEIGHT, clientY - gridRect.top));
    const snapped = Math.round((relativeY / (DEMO_HOUR_HEIGHT / 60)) / SLOT_MINUTES) * SLOT_MINUTES;
    const nextMinutes = clampMinutes(startHour * 60 + snapped);
    return minutesToTime(nextMinutes);
  };

  const beginCandidateDrag = (event: React.PointerEvent<HTMLButtonElement>, index: number, task: string) => {
    if (step === "placed") return;
    event.preventDefault();
    if (event.currentTarget === floatingTaskRef.current) {
      event.currentTarget.style.animation = "none";
      event.currentTarget.style.opacity = "0";
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointer events and a few browser edge states cannot be captured.
    }
    const nextDrag = { x: event.clientX, y: event.clientY, index, task };
    dragGhostRef.current = nextDrag;
    setDragGhost(nextDrag);
  };

  const moveCandidateDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const currentDrag = dragGhostRef.current;
    if (!currentDrag || step === "placed") return;
    const nextDrag = { ...currentDrag, x: event.clientX, y: event.clientY };
    dragGhostRef.current = nextDrag;
    setDragGhost(nextDrag);
    const timelineRect = timelineRef.current?.getBoundingClientRect();
    if (timelineRect && event.clientX >= timelineRect.left && event.clientX <= timelineRect.right && event.clientY >= timelineRect.top && event.clientY <= timelineRect.bottom) {
      setHoverStart(getTimelineStartFromPointer(event.clientY));
    } else {
      setHoverStart("");
    }
  };

  const endCandidateDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const currentDrag = dragGhostRef.current;
    if (!currentDrag || step === "placed") return;
    const timelineRect = timelineRef.current?.getBoundingClientRect();
    const isInsideTimeline = timelineRect
      ? event.clientX >= timelineRect.left && event.clientX <= timelineRect.right && event.clientY >= timelineRect.top && event.clientY <= timelineRect.bottom
      : Boolean(document.elementFromPoint(event.clientX, event.clientY)?.closest(".mini-timeline"));
    if (isInsideTimeline) placeOnTimeline(currentDrag.task, currentDrag.index, getTimelineStartFromPointer(event.clientY));
    else {
      floatingTaskRef.current?.style.removeProperty("animation");
      floatingTaskRef.current?.style.removeProperty("opacity");
      dragGhostRef.current = null;
      setDragGhost(null);
    }
  };

  return (
    <div
      className={`landing-orbit step-${step}${dragGhost ? " is-dragging" : ""}`}
      onPointerMove={onOrbitMove}
      onPointerLeave={resetTilt}
      onClick={onOrbitClick}
    >
      <button
        ref={floatingTaskRef}
        className="landing-floating-task"
        type="button"
        onPointerMove={onMove}
        onPointerDown={(event) => { if (step === "expanded") beginCandidateDrag(event, 0, tasks[0]); }}
        onPointerUp={(event) => { if (step === "expanded") endCandidateDrag(event); }}
        onPointerCancel={() => { floatingTaskRef.current?.style.removeProperty("animation"); floatingTaskRef.current?.style.removeProperty("opacity"); dragGhostRef.current = null; setDragGhost(null); }}
        onPointerLeave={() => undefined}
        onClick={activate}
        style={fitStyle}
        aria-label={c.tap}
      >
        <span className="task-front"><b>NavoPath</b><i>{c.tap}</i></span>
        <span className="task-back">
          <i className="task-check" />
          <strong>{tasks[0]}</strong>
          <em>45m</em>
          <small className="task-mini-icon">▣</small>
          <small className="task-mini-icon">⌄</small>
        </span>
      </button>

      <div className="landing-mini-product df-app navo-demo-app" aria-hidden={step === "idle" || step === "flipped"}>
        <aside className="landing-hero-panel">
          <span className="landing-kicker"><i />{c.kicker}</span>
          <h1>{c.heroLines.map((line, index) => <span className={`hero-line line-${index}`} key={line}>{line}</span>)}</h1>
          <p>{c.intro}</p>
          <div className="landing-hero-actions">
            <button className="landing-button primary hero-cta" onClick={onStart}>{c.start}<span>→</span></button>
            <a className="landing-button quiet hero-cta" href="#demo">{lang === "zh" ? "查看演示" : "See demo"}</a>
          </div>
        </aside>
        <section className="mini-candidates df-candidate-panel">
          <header className="df-panel-title"><h2>Today's Candidates</h2><span className="mini-count">1</span></header>
          {tasks.map((task, index) => (
            <TaskBlock
              as="button"
              type="button"
              variant="candidate"
              ref={index === 0 ? firstCandidateRef : undefined}
              className={`mini-task df-task-card t-${index}${placedIndex === index ? " is-placed" : ""}`}
              draggable={false}
              projectColor={DEMO_PROJECT_COLOR}
              onPointerDown={(event) => beginCandidateDrag(event as React.PointerEvent<HTMLButtonElement>, index, task)}
              onPointerMove={moveCandidateDrag}
              onPointerUp={endCandidateDrag}
              onPointerCancel={() => { floatingTaskRef.current?.style.removeProperty("animation"); floatingTaskRef.current?.style.removeProperty("opacity"); dragGhostRef.current = null; setDragGhost(null); }}
              key={task}
            >
              <i className="df-block-check" />
              <span className="df-candidate-title">{task}</span>
              <small className="df-duration-pill">45m</small>
            </TaskBlock>
          ))}
          {step === "expanded" && !dragGhost && (
            <div className="mini-candidate-arrow" aria-hidden="true">
              <span />
              <i />
            </div>
          )}
        </section>
        <section
          ref={timelineRef}
          className="mini-timeline df-timeline-panel"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => { event.preventDefault(); placeOnTimeline(); }}
        >
          <div className="df-timeline-daily">
            <div className="mini-date-row df-timeline-top">
              <h2 className="df-date-title"><strong>{demoDate.day}.</strong><span>{demoDate.weekday}</span></h2>
            </div>
            <div className="df-timeline-allday"><span className="df-timeline-3day-allday-label">All Day</span></div>
            <div className="mini-timeline-scroll df-timeline-scroll">
              <div
                ref={timelineGridRef}
                className="mini-time-grid df-time-grid"
                style={{ height: `${hourLabels.length * DEMO_HOUR_HEIGHT}px` }}
              >
                {hourLabels.map((hour) => (
                  <div className="mini-hour df-slot" style={{ top: `${(hour - startHour) * DEMO_HOUR_HEIGHT}px` }} key={hour}>
                    <span className="df-slot-ruler">{hour === 24 ? "00:00" : `${String(hour).padStart(2, "0")}:00`}</span><i />
                  </div>
                ))}
                {nowTop >= 0 && nowTop <= hourLabels.length * DEMO_HOUR_HEIGHT && <div className="df-now-line" style={{ top: `${nowTop}px` }} />}
                {(step === "expanded" || step === "placed") && scheduledBlocks.map((block) => (
                  <TaskBlock
                    as="div"
                    variant="scheduled"
                    checked={block.done}
                    projectColor={block.color}
                    key={`${block.title}-${block.start}`}
                    className={`df-time-block mini-scheduled-block${block.done ? " is-done" : ""}`}
                    style={{
                      top: `${timeBlockTopLocal(block.start, startHour)}px`,
                      height: `${timeBlockHeightLocal(block.start, block.end)}px`,
                    } as React.CSSProperties}
                  >
                    <button className="df-block-check" aria-hidden="true">{block.done ? "✓" : ""}</button>
                    <div className="df-block-title-row"><strong>{block.title}</strong></div>
                  </TaskBlock>
                ))}
                {step === "expanded" && (
                  <div
                    className="mini-empty-slot"
                    style={{ top: `${timeBlockTopLocal(targetStart, startHour)}px`, height: `${timeBlockHeightLocal(targetStart, targetEnd)}px` }}
                    aria-hidden="true"
                  />
                )}
                {step === "expanded" && (
                  <div
                    className="mini-guide-path"
                    style={{
                      top: `${timeBlockTopLocal(targetStart, startHour) + Math.min(timeBlockHeightLocal(targetStart, targetEnd), 42) / 2}px`,
                      "--cat": DEMO_PROJECT_COLOR,
                    } as React.CSSProperties}
                    aria-hidden="true"
                  />
                )}
                {step === "expanded" && (
                  <div
                    className="mini-guide-card"
                    style={{
                      top: `${timeBlockTopLocal(targetStart, startHour)}px`,
                      height: `${Math.min(timeBlockHeightLocal(targetStart, targetEnd), 42)}px`,
                      "--cat": DEMO_PROJECT_COLOR,
                    } as React.CSSProperties}
                    aria-hidden="true"
                  >
                    <i />
                    <strong>{tasks[0]}</strong>
                    <em>45m</em>
                  </div>
                )}
                {step === "expanded" && dragGhost && hoverStart && (
                  <div
                    className="df-drop-preview moving-block mini-drop-preview"
                    style={{
                      top: `${timeBlockTopLocal(hoverStart, startHour)}px`,
                      height: `${timeBlockHeightLocal(hoverStart, addMinutes(hoverStart, 45))}px`,
                      "--cat": DEMO_PROJECT_COLOR,
                    } as React.CSSProperties}
                  >
                    <strong>{dragGhost.task}</strong>
                  </div>
                )}
                {step === "placed" && (
                  <TaskBlock
                    as="div"
                    variant="scheduled"
                    projectColor={DEMO_PROJECT_COLOR}
                    className="df-time-block mini-placement"
                    style={{
                      top: `${timeBlockTopLocal(placedStart || targetStart, startHour)}px`,
                      height: `${timeBlockHeightLocal(placedStart || targetStart, addMinutes(placedStart || targetStart, 45))}px`,
                    } as React.CSSProperties}
                  >
                    <button className="df-block-check" aria-hidden="true" />
                    <div className="df-block-title-row"><strong>{placedTask ?? tasks[0]}</strong></div>
                    <span className="df-resize-dot top" />
                    <span className="df-resize-dot bottom" />
                  </TaskBlock>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
      {dragGhost && (
        <div className="mini-drag-ghost" style={{ left: dragGhost.x, top: dragGhost.y }}>
          <i />
          <span>{dragGhost.task}</span>
          <small>45m</small>
        </div>
      )}
      {step !== "placed" && (
        <button className="landing-skip-intro" type="button" onClick={skipIntro} aria-label="Skip intro">
          &gt;&gt;skip
        </button>
      )}
    </div>
  );
}

function PlanningShowcase({ lang }: { lang: Lang }) {
  const planningProjects = [
    {
      title: "Workday delivery",
      count: 3,
      color: "#D7816A",
      tasks: [
        { title: "Ship the weekly report", meta: "2/3" },
        { title: "Reply to manager feedback", meta: "today" },
      ],
    },
    {
      title: "After-work learning",
      count: 4,
      color: "#7EA172",
      tasks: [
        { title: "Read one chapter on systems design", meta: "45m" },
        { title: "Write notes from the commute podcast", meta: "20m" },
        { title: "Practice one SQL problem", meta: "15m" },
      ],
    },
    {
      title: "Weekend reset",
      count: 2,
      color: "#584D3D",
      tasks: [
        { title: "Review learning backlog", meta: "Sat" },
        { title: "Plan next week's study blocks", meta: "Sun" },
      ],
    },
  ];

  return (
    <div className="landing-live-demo planning-showcase" id="demo">
      <div className="demo-copy">
        <span>PLANNING VIEW</span>
        <h2>{lang === "zh" ? "把上班后的学习，也放进长期路径。" : "Keep work and learning in one path."}</h2>
      </div>
      <div className="demo-planning-frame df-app mode-planning navo-demo-app">
        <section className="df-planning">
          <div className="df-planning-body">
            <div className="df-mindmap no-root">
              <div className="df-tree-wrap">
                <div className="df-tree">
                  <svg className="df-tree-svg demo-tree-svg" aria-hidden="true" viewBox="0 0 760 500" preserveAspectRatio="none">
                    <path className="df-tree-line trunk" d="M 38 56 L 38 428" />
                    <path className="df-tree-line branch" d="M 38 56 L 86 56" />
                    <path className="df-tree-line branch" d="M 38 214 L 86 214" />
                    <path className="df-tree-line branch" d="M 38 390 L 86 390" />
                  </svg>
                  {planningProjects.map((project) => (
                    <div className="df-category-branch demo-plan-branch" key={project.title}>
                      <div
                        className="df-plan-project-node"
                        style={{ "--project-color": project.color } as React.CSSProperties}
                      >
                        <span className="df-project-color-bar" />
                        <strong className="df-project-name">{project.title}</strong>
                        <span className="df-project-badge">{project.count}</span>
                      </div>
                      <div className="df-project-tasks">
                        {project.tasks.map((task) => (
                          <div className="df-plan-task-node" key={task.title}>
                            <div className="df-task-node-inner">
                              <strong className="df-task-title">{task.title}</strong>
                              <span className="df-subtask-progress">{task.meta}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ProductDemo({ lang }: { lang: Lang }) {
  const [placed, setPlaced] = useState(false);
  const c = copy[lang];
  const tasks = ["Read 20 pages", "Daily sync", "Project review"];
  const demoDate = useMemo(() => formatDemoDate(new Date()), []);
  const startHour = 18;
  const hourLabels = Array.from({ length: 6 }, (_, index) => startHour + index);
  const placedStart = "20:00";
  const scheduledBlocks = [
    { title: "Commute reading", start: "18:30", end: "19:15", color: "#D7816A", done: true },
    { title: "Daily sync", start: "19:22", end: "20:07", color: "#584D3D", done: true },
    { title: "Project review", start: "21:10", end: "21:55", color: "#0F0326", done: false },
  ];

  const placeTask = () => {
    if (placed) return;
    setPlaced(true);
    playNavoSound("place");
  };

  return (
    <div className={`landing-live-demo ${placed ? "is-placed" : ""}`} id="demo">
      <div className="demo-copy">
        <span>LIVE DEMO</span>
        <h2>{lang === "zh" ? "从候选，到时间。" : "From candidate to time."}</h2>
      </div>
      <div className="demo-board">
        <section className="demo-candidates">
          <header><strong>{c.candidate}</strong><small>{lang === "zh" ? "今天只拿三件事" : "Only three things today"}</small></header>
          {tasks.map((task, index) => (
            <button
              className={`demo-candidate candidate-${index}`}
              draggable={index === 0 && !placed}
              onDragStart={(event) => event.dataTransfer.setData("text/plain", task)}
              onClick={index === 0 ? placeTask : undefined}
              key={task}
              type="button"
            >
              <i className="df-block-check" aria-hidden="true">{index < 2 ? "✓" : ""}</i>
              <strong>{task}</strong>
              <small>{index === 0 ? "45m" : index === 1 ? "30m" : "45m"}</small>
            </button>
          ))}
        </section>
        <section
          className="mini-timeline demo-mini-timeline df-timeline-panel navo-demo-app"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => { event.preventDefault(); placeTask(); }}
        >
          <div className="df-timeline-daily">
            <div className="mini-date-row df-timeline-top">
              <h2 className="df-date-title"><strong>{demoDate.day}.</strong><span>{demoDate.weekday}</span></h2>
            </div>
            <div className="df-timeline-allday"><span className="df-timeline-3day-allday-label">All Day</span></div>
            <div className="mini-timeline-scroll df-timeline-scroll">
              <div className="mini-time-grid df-time-grid" style={{ height: `${hourLabels.length * DEMO_HOUR_HEIGHT}px` }}>
                {hourLabels.map((hour) => (
                  <div className="mini-hour df-slot" style={{ top: `${(hour - startHour) * DEMO_HOUR_HEIGHT}px` }} key={hour}>
                    <span className="df-slot-ruler">{`${String(hour).padStart(2, "0")}:00`}</span><i />
                  </div>
                ))}
                <div className="df-now-line" style={{ top: `${timeBlockTopLocal("19:34", startHour)}px` }} />
                {scheduledBlocks.map((block) => (
                  <TaskBlock
                    as="div"
                    variant="scheduled"
                    checked={block.done}
                    projectColor={block.color}
                    key={block.title}
                    className={`df-time-block mini-scheduled-block${block.done ? " is-done" : ""}`}
                    style={{
                      top: `${timeBlockTopLocal(block.start, startHour)}px`,
                      height: `${timeBlockHeightLocal(block.start, block.end)}px`,
                    } as React.CSSProperties}
                  >
                    <button className="df-block-check" aria-hidden="true">{block.done ? "✓" : ""}</button>
                    <div className="df-block-title-row"><strong>{block.title}</strong></div>
                  </TaskBlock>
                ))}
                {!placed && (
                  <div
                    className="mini-empty-slot"
                    style={{
                      top: `${timeBlockTopLocal(placedStart, startHour)}px`,
                      height: `${timeBlockHeightLocal(placedStart, addMinutes(placedStart, 45))}px`,
                    }}
                    aria-hidden="true"
                  />
                )}
                {placed && (
                  <TaskBlock
                    as="div"
                    variant="scheduled"
                    projectColor={DEMO_PROJECT_COLOR}
                    className="df-time-block mini-placement"
                    style={{
                      top: `${timeBlockTopLocal(placedStart, startHour)}px`,
                      height: `${timeBlockHeightLocal(placedStart, addMinutes(placedStart, 45))}px`,
                    } as React.CSSProperties}
                  >
                    <button className="df-block-check" aria-hidden="true" />
                    <div className="df-block-title-row"><strong>{tasks[0]}</strong></div>
                  </TaskBlock>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

type ThreeModule = typeof import("three");

function makeNavoLogoTexture(THREE: ThreeModule) {
  const canvas = document.createElement("canvas");
  canvas.width = 2400;
  canvas.height = 680;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#27231e";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "700 610px Georgia, Times New Roman, serif";
  context.fillText("NAVO", canvas.width / 2, canvas.height / 2 + 24);
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function GridDistortionLogo({ grid = 32, mouse = 0.22, strength = 0.15, relaxation = 0.9 }: {
  grid?: number;
  mouse?: number;
  strength?: number;
  relaxation?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cleanup = () => {};
    let cancelled = false;

    void import("three").then((THREE) => {
      if (cancelled) return;

      const scene = new THREE.Scene();
      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      } catch {
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);
      container.innerHTML = "";
      container.appendChild(renderer.domElement);

      const camera = new THREE.OrthographicCamera(0, 0, 0, 0, -1000, 1000);
      camera.position.z = 2;

      const logoTexture = makeNavoLogoTexture(THREE);
      if (!logoTexture) return;

      const data = new Float32Array(4 * grid * grid);
      for (let i = 0; i < grid * grid; i += 1) {
        data[i * 4] = Math.random() * 255 - 125;
        data[i * 4 + 1] = Math.random() * 255 - 125;
      }
      const dataTexture = new THREE.DataTexture(data, grid, grid, THREE.RGBAFormat, THREE.FloatType);
      dataTexture.needsUpdate = true;

      const uniforms = {
        time: { value: 0 },
        resolution: { value: new THREE.Vector4() },
        uTexture: { value: logoTexture },
        uDataTexture: { value: dataTexture },
      };

      const material = new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        uniforms,
        transparent: true,
        vertexShader: `
          uniform float time;
          varying vec2 vUv;
          varying vec3 vPosition;

          void main() {
            vUv = uv;
            vPosition = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D uDataTexture;
          uniform sampler2D uTexture;
          uniform vec4 resolution;
          varying vec2 vUv;

          void main() {
            vec2 uv = vUv;
            vec4 offset = texture2D(uDataTexture, vUv);
            gl_FragColor = texture2D(uTexture, uv - 0.02 * offset.rg);
          }
        `,
      });

      const geometry = new THREE.PlaneGeometry(1, 1, grid - 1, grid - 1);
      const plane = new THREE.Mesh(geometry, material);
      scene.add(plane);

      const mouseState = { x: 0, y: 0, prevX: 0, prevY: 0, vX: 0, vY: 0 };
      const handlePointerMove = (event: PointerEvent) => {
        const rect = container.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = 1 - (event.clientY - rect.top) / rect.height;
        mouseState.vX = x - mouseState.prevX;
        mouseState.vY = y - mouseState.prevY;
        mouseState.x = x;
        mouseState.y = y;
        mouseState.prevX = x;
        mouseState.prevY = y;
      };
      const handlePointerLeave = () => {
        mouseState.x = 0;
        mouseState.y = 0;
        mouseState.prevX = 0;
        mouseState.prevY = 0;
        mouseState.vX = 0;
        mouseState.vY = 0;
      };

      const handleResize = () => {
        const rect = container.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const aspect = rect.width / rect.height;
        renderer.setSize(rect.width, rect.height);
        plane.scale.set(aspect, 1, 1);
        camera.left = -aspect / 2;
        camera.right = aspect / 2;
        camera.top = 0.5;
        camera.bottom = -0.5;
        camera.updateProjectionMatrix();
        uniforms.resolution.value.set(rect.width, rect.height, 1, 1);
      };

      const resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(container);
      container.addEventListener("pointermove", handlePointerMove);
      container.addEventListener("pointerleave", handlePointerLeave);
      handleResize();

      let animationId = 0;
      const animate = () => {
        animationId = window.requestAnimationFrame(animate);
        uniforms.time.value += 0.05;

        for (let i = 0; i < grid * grid; i += 1) {
          data[i * 4] *= relaxation;
          data[i * 4 + 1] *= relaxation;
        }

        const gridMouseX = grid * mouseState.x;
        const gridMouseY = grid * mouseState.y;
        const maxDist = grid * mouse;

        for (let i = 0; i < grid; i += 1) {
          for (let j = 0; j < grid; j += 1) {
            const distSq = ((gridMouseX - i) ** 2) + ((gridMouseY - j) ** 2);
            if (distSq < maxDist * maxDist) {
              const index = 4 * (i + grid * j);
              const power = Math.min(maxDist / Math.sqrt(Math.max(distSq, 0.0001)), 10);
              data[index] += strength * 100 * mouseState.vX * power;
              data[index + 1] -= strength * 100 * mouseState.vY * power;
            }
          }
        }

        dataTexture.needsUpdate = true;
        renderer.render(scene, camera);
      };

      animate();

      cleanup = () => {
        window.cancelAnimationFrame(animationId);
        resizeObserver.disconnect();
        container.removeEventListener("pointermove", handlePointerMove);
        container.removeEventListener("pointerleave", handlePointerLeave);
        geometry.dispose();
        material.dispose();
        dataTexture.dispose();
        logoTexture.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      };
    });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [grid, mouse, strength, relaxation]);

  return <div ref={containerRef} className="landing-grid-logo" aria-label="NAVO" role="img" />;
}

function AuthDialog({ lang, onClose, onLogin, onResend, onContinueAfterConfirm, onForgotPassword, busy, error, notice }: {
  lang: Lang;
  onClose: () => void;
  onLogin: (email: string, password: string, displayName: string, intent: AuthIntent, theme: "light" | "dark") => void;
  onResend: (email: string) => void;
  onContinueAfterConfirm: (email: string) => void;
  onForgotPassword: (email: string) => Promise<void>;
  busy: boolean;
  error: string;
  notice: { type: "confirm-email"; email: string } | null;
}) {
  const [authIntent, setAuthIntent] = useState<AuthIntent>("signin");
  const [authView, setAuthView] = useState<"login" | "forgot" | "forgotSent">("login");
  const [forgotBusy, setForgotBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [preferredTheme, setPreferredTheme] = useState<"light" | "dark">("light");
  const text = lang === "zh" ? {
    account: "NavoPath 账户", welcome: "欢迎回来。", begin: "开始你的路径。",
    signIn: "登录", signUp: "注册", name: "显示名称", email: "邮箱",
    password: "密码（至少 6 位）", confirm: "确认密码", show: "显示密码",
    inbox: "请检查邮箱", inboxBody: "确认发送到该邮箱的邮件，然后返回登录。",
    resend: "重新发送", continue: "继续登录", mismatch: "两次输入的密码不一致。",
    working: "处理中...", open: "打开工作区", create: "创建账户",
    theme: "进入工作区时使用", light: "浅色纸张", dark: "深色纸张",
    forgot: "忘记密码？", forgotTitle: "找回密码", forgotBody: "输入注册邮箱，我们会发送密码重置链接。",
    sendReset: "发送重置链接", sentTitle: "邮件已发送", sentBody: "请检查收件箱并点击链接设置新密码。",
    backToLogin: "返回登录", resendReset: "重新发送",
  } : {
    account: "NavoPath account", welcome: "Welcome back.", begin: "Start your path.",
    signIn: "Sign in", signUp: "Sign up", name: "Display name", email: "Email",
    password: "Password (6+ characters)", confirm: "Confirm password", show: "Show password",
    inbox: "Check your inbox", inboxBody: "Confirm the email sent to this address, then return to sign in.",
    resend: "Resend email", continue: "Continue to sign in", mismatch: "Passwords do not match.",
    working: "Working...", open: "Open workspace", create: "Create account",
    theme: "Open workspace in", light: "Light paper", dark: "Dark paper",
    forgot: "Forgot password?", forgotTitle: "Reset password", forgotBody: "Enter your registered email and we will send a reset link.",
    sendReset: "Send reset link", sentTitle: "Email sent", sentBody: "Check your inbox and click the link to set a new password.",
    backToLogin: "Back to login", resendReset: "Resend",
  };
  const passwordMismatch = authIntent === "signup" && password.length > 0 && confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <div className="landing-auth-overlay" onMouseDown={onClose}>
      <section className="landing-auth-card" onMouseDown={(event) => event.stopPropagation()}>
        <button className="landing-auth-close" aria-label={lang === "zh" ? "关闭" : "Close"} onClick={onClose}>×</button>
        <ProductIcon />
        <span className="landing-auth-label">{text.account}</span>
        {authView !== "login" ? (
          <>
            <h2>{authView === "forgot" ? text.forgotTitle : text.sentTitle}</h2>
            {authView === "forgot" ? (
              <form onSubmit={async (event) => { event.preventDefault(); setForgotBusy(true); try { await onForgotPassword(email.trim()); setAuthView("forgotSent"); } finally { setForgotBusy(false); } }}>
                <p>{text.forgotBody}</p>
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={text.email} required autoFocus />
                {error && <p className="landing-auth-error">{error}</p>}
                <button className="landing-button primary full" disabled={forgotBusy || !email.trim()}>{forgotBusy ? text.working : text.sendReset}</button>
                <button type="button" className="landing-button quiet full" onClick={() => setAuthView("login")}>{text.backToLogin}</button>
              </form>
            ) : (
              <div>
                <p>{text.sentBody}</p>
                <strong className="landing-auth-email">{email}</strong>
                <button className="landing-button primary full" onClick={async () => { setForgotBusy(true); try { await onForgotPassword(email.trim()); } finally { setForgotBusy(false); } }}>{text.resendReset}</button>
                <button className="landing-button quiet full" onClick={() => setAuthView("login")}>{text.backToLogin}</button>
              </div>
            )}
          </>
        ) : (
          <>
            <h2>{authIntent === "signin" ? text.welcome : text.begin}</h2>
            <div className="landing-auth-tabs">
              <button className={authIntent === "signin" ? "active" : ""} onClick={() => setAuthIntent("signin")}>{text.signIn}</button>
              <button className={authIntent === "signup" ? "active" : ""} onClick={() => setAuthIntent("signup")}>{text.signUp}</button>
            </div>
            <form onSubmit={(event) => { event.preventDefault(); if (!passwordMismatch) onLogin(email.trim(), password, displayName.trim(), authIntent, preferredTheme); }}>
              {authIntent === "signup" && <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={text.name} maxLength={64} />}
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={text.email} required />
              <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={text.password} minLength={6} required />
              {authIntent === "signup" && <input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder={text.confirm} minLength={6} required />}
              <fieldset className="landing-auth-theme">
                <legend>{text.theme}</legend>
                <button type="button" className={preferredTheme === "light" ? "active" : ""} onClick={() => setPreferredTheme("light")}><i className="light" /><span>{text.light}</span></button>
                <button type="button" className={preferredTheme === "dark" ? "active" : ""} onClick={() => setPreferredTheme("dark")}><i className="dark" /><span>{text.dark}</span></button>
              </fieldset>
              <label className="landing-auth-check"><input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} />{text.show}</label>
              {authIntent === "signin" && <button type="button" className="landing-forgot-link" onClick={() => setAuthView("forgot")}>{text.forgot}</button>}
              {notice && <div className="landing-auth-notice"><strong>{text.inbox}</strong><p>{text.inboxBody}<br />{notice.email}</p><button type="button" onClick={() => onResend(notice.email)}>{text.resend}</button><button type="button" onClick={() => onContinueAfterConfirm(notice.email)}>{text.continue}</button></div>}
              {passwordMismatch && <p className="landing-auth-error">{text.mismatch}</p>}
              {error && <p className="landing-auth-error">{error}</p>}
              <button className="landing-button primary full" disabled={busy || passwordMismatch}>{busy ? text.working : authIntent === "signin" ? text.open : text.create}</button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

export default function LandingPage({ onLogin, onResend, onContinueAfterConfirm, onForgotPassword, busy, error, notice }: {
  onLogin: (email: string, password: string, displayName: string, intent: AuthIntent, theme: "light" | "dark") => void;
  onResend: (email: string) => void;
  onContinueAfterConfirm: (email: string) => void;
  onForgotPassword: (email: string) => Promise<void>;
  busy: boolean;
  error: string;
  notice: { type: "confirm-email"; email: string } | null;
}) {
  const [lang, setLang] = useState<Lang>("en");
  const [showAuth, setShowAuth] = useState(false);
  const c = copy[lang];

  return (
    <div className="landing" lang={lang}>
      <nav className="landing-nav">
        <a className="landing-brand" href="#top"><ProductIcon compact /><span>NavoPath</span></a>
        <div className="landing-nav-links">
          {c.nav.map((item, index) => <a key={item} href={`#${["demo", "everyday", "principles"][index]}`}>{item}</a>)}
        </div>
        <div className="landing-nav-actions">
          <a className="landing-donation-link" href={DONATION_URL} target="_blank" rel="noreferrer">{c.donate}</a>
          <button className="landing-lang" aria-label={lang === "en" ? "切换为中文" : "Switch to English"} onClick={() => setLang(lang === "en" ? "zh" : "en")}>{lang === "en" ? "中" : "EN"}</button>
          <button className="landing-button quiet small" onClick={() => setShowAuth(true)}>{c.login}</button>
        </div>
      </nav>

      <main>
        <section className="landing-hero" id="top">
          <HeroInteraction lang={lang} onStart={() => setShowAuth(true)} />
        </section>

        <PlanningShowcase lang={lang} />

        <section className="landing-section landing-everyday" id="everyday">
          <header className="landing-section-head">
            <span>02 / EVERYDAY</span>
            <h2>{c.everydayTitle}</h2>
            <p>{c.everydayIntro}</p>
          </header>
          <div className="landing-example-grid">
            {c.examples.map(([time, title, body]) => (
              <article key={time}>
                <time>{time}</time>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section landing-principles" id="principles">
          <header className="landing-section-head">
            <span>03 / PRINCIPLES</span>
            <h2>{c.principlesTitle}</h2>
          </header>
          <ol>{c.principles.map((item, index) => <li key={item}><span>0{index + 1}</span><strong>{item}</strong></li>)}</ol>
        </section>

        <section className="landing-cta">
          <GridDistortionLogo />
          <h2>{c.ctaTitle}</h2>
          <p>{c.ctaBody}</p>
          <div className="landing-actions">
            <button className="landing-button primary" onClick={() => setShowAuth(true)}>{c.start}<span>→</span></button>
            <a className="landing-button quiet landing-download" href={DESKTOP_DOWNLOAD_URL} target="_blank" rel="noreferrer">{c.download}<span>→</span></a>
            <a className="landing-button quiet landing-donate" href={DONATION_URL} target="_blank" rel="noreferrer">{c.ctaDonate}</a>
          </div>
        </section>
      </main>

      <footer className="landing-footer"><span>{c.footer}</span><a href={DONATION_URL} target="_blank" rel="noreferrer">{c.ctaDonate}</a><span>© 2026 Xiaoyang Chen</span></footer>

      {showAuth && <AuthDialog lang={lang} onClose={() => setShowAuth(false)} onLogin={onLogin} onResend={onResend} onContinueAfterConfirm={onContinueAfterConfirm} onForgotPassword={onForgotPassword} busy={busy} error={error} notice={notice} />}
    </div>
  );
}
