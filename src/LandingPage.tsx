import { useState } from "react";
import { ProductIcon } from "./main";

type AuthIntent = "signin" | "signup";
type Lang = "en" | "zh";

const copy = {
  en: {
    nav: ["Workflow", "Features", "Principles"],
    login: "Log in",
    eyebrow: "Planning for people who build",
    title: "Turn ambitious goals into",
    titleAccent: "today's next move.",
    intro: "NavoPath connects long-range project thinking with a realistic daily timeline, so your plans survive contact with the day.",
    start: "Start planning",
    signIn: "Open workspace",
    proof: ["Tree-based planning", "Timeline execution", "AI-assisted scheduling"],
    workflowTitle: "One continuous path from intention to action.",
    workflowIntro: "Planning and execution stay connected. Select the work that matters, then give it a real place in your day.",
    steps: [
      ["01", "Map the project", "Break complex goals into projects, tasks, and concrete next actions."],
      ["02", "Choose today's progress", "Pull only the right tasks into a focused daily candidate list."],
      ["03", "Make time real", "Place work on the timeline, resolve conflicts, and adapt without losing the plan."],
    ],
    featureTitle: "Calm enough to think. Precise enough to execute.",
    features: [
      ["Structure", "A visual planning tree keeps the relationship between projects and next actions clear."],
      ["Time", "Day, three-day, week, and month views show what your workload actually looks like."],
      ["Adaptation", "Drag, resize, re-plan, and return tasks to Planning without breaking context."],
      ["Assistance", "Navo AI can turn selected tasks into a draft schedule you remain in control of."],
    ],
    principlesTitle: "Designed around the work, not the dashboard.",
    principles: ["Planning and execution are different modes of thought.", "Your timeline should reflect reality, not aspiration.", "AI proposes. You decide."],
    ctaTitle: "Give the next important thing a place to happen.",
    ctaBody: "Start with the project. End with a day you can actually complete.",
    footer: "NavoPath · Plan the path. Execute today.",
  },
  zh: {
    nav: ["工作流", "功能", "原则"],
    login: "登录",
    eyebrow: "为创造者设计的规划工具",
    title: "把宏大的目标变成",
    titleAccent: "今天的下一步。",
    intro: "NavoPath 将长期项目思考与真实日程连接起来，让计划经得起每一天的变化。",
    start: "开始规划",
    signIn: "打开工作区",
    proof: ["树状项目规划", "时间轴执行", "AI 辅助排程"],
    workflowTitle: "从目标到行动，一条连续的路径。",
    workflowIntro: "规划与执行始终相连。先选择真正重要的工作，再为它安排真实的时间。",
    steps: [
      ["01", "搭建项目结构", "把复杂目标拆解为项目、任务和清晰的下一步行动。"],
      ["02", "选择今日推进项", "只把今天值得推进的任务带入候选列表。"],
      ["03", "让时间变得真实", "把任务放入时间轴，解决冲突，并随变化重新安排。"],
    ],
    featureTitle: "足够安静，便于思考；足够精确，支持执行。",
    features: [
      ["结构", "可视化规划树清楚呈现项目、任务与下一步行动之间的关系。"],
      ["时间", "日、三日、周和月视图，让工作量真正可见。"],
      ["调整", "拖拽、调整时长、重新规划或退回任务，同时保留上下文。"],
      ["辅助", "Navo AI 根据选定任务生成日程草案，最终决定始终由你掌握。"],
    ],
    principlesTitle: "围绕工作本身设计，而不是堆砌仪表盘。",
    principles: ["规划与执行是两种不同的思考模式。", "时间轴应该反映现实，而不是愿望。", "AI 提议，你决定。"],
    ctaTitle: "为下一件重要的事，留出真正发生的时间。",
    ctaBody: "从项目开始，以一个能够完成的今天结束。",
    footer: "NavoPath · 规划路径，执行今天。",
  },
};

function Glyph({ name }: { name: "tree" | "timeline" | "spark" | "sync" }) {
  const paths = {
    tree: <><path d="M12 4v16M12 8H6v4M12 12h6v4M6 12v4M18 16v4M6 16v4"/><circle cx="12" cy="4" r="2"/><circle cx="6" cy="20" r="2"/><circle cx="18" cy="20" r="2"/></>,
    timeline: <><path d="M5 4v16M9 7h10M9 12h7M9 17h10"/><circle cx="5" cy="7" r="1.5"/><circle cx="5" cy="12" r="1.5"/><circle cx="5" cy="17" r="1.5"/></>,
    spark: <><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z"/><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z"/></>,
    sync: <><path d="M20 7h-6V1"/><path d="M20 7a9 9 0 0 0-15.5-3M4 17h6v6"/><path d="M4 17a9 9 0 0 0 15.5 3"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

export default function LandingPage({ onLogin, onResend, onContinueAfterConfirm, busy, error, notice }: {
  onLogin: (email: string, password: string, displayName: string, intent: AuthIntent) => void;
  onResend: (email: string) => void;
  onContinueAfterConfirm: (email: string) => void;
  busy: boolean;
  error: string;
  notice: { type: "confirm-email"; email: string } | null;
}) {
  const [lang, setLang] = useState<Lang>("en");
  const [showAuth, setShowAuth] = useState(false);
  const [authIntent, setAuthIntent] = useState<AuthIntent>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const c = copy[lang];
  const passwordMismatch = authIntent === "signup" && password.length > 0 && confirmPassword.length > 0 && password !== confirmPassword;

  const openAuth = (intent: AuthIntent) => {
    setAuthIntent(intent);
    setShowAuth(true);
  };

  return (
    <div className="landing" lang={lang}>
      <nav className="landing-nav">
        <a className="landing-brand" href="#top"><ProductIcon compact /><span>NavoPath</span></a>
        <div className="landing-nav-links">
          {c.nav.map((item, index) => <a key={item} href={`#${["workflow", "features", "principles"][index]}`}>{item}</a>)}
        </div>
        <div className="landing-nav-actions">
          <button className="landing-lang" onClick={() => setLang(lang === "en" ? "zh" : "en")}>{lang === "en" ? "中" : "EN"}</button>
          <button className="landing-button quiet small" onClick={() => openAuth("signin")}>{c.login}</button>
        </div>
      </nav>

      <main>
        <section className="landing-hero" id="top">
          <div className="landing-orbit landing-orbit-one" />
          <div className="landing-orbit landing-orbit-two" />
          <div className="landing-hero-copy">
            <span className="landing-kicker"><i />{c.eyebrow}</span>
            <h1>{c.title}<br /><em>{c.titleAccent}</em></h1>
            <p>{c.intro}</p>
            <div className="landing-actions">
              <button className="landing-button primary" onClick={() => openAuth("signup")}>{c.start}<span>↗</span></button>
              <button className="landing-button quiet" onClick={() => openAuth("signin")}>{c.signIn}</button>
            </div>
            <div className="landing-proof">{c.proof.map((item) => <span key={item}><i />{item}</span>)}</div>
          </div>
          <div className="landing-product-frame">
            <div className="landing-frame-bar"><span /><span /><span /><b>NavoPath / Execute</b></div>
            <img src="/navo-dark.png" alt="NavoPath Execute workspace" />
          </div>
        </section>

        <section className="landing-section" id="workflow">
          <header className="landing-section-head"><span>01 / Workflow</span><h2>{c.workflowTitle}</h2><p>{c.workflowIntro}</p></header>
          <div className="landing-workflow">
            {c.steps.map(([number, title, body]) => <article key={number}><span>{number}</span><div><h3>{title}</h3><p>{body}</p></div></article>)}
          </div>
          <div className="landing-planning-frame">
            <div><span>Planning</span><strong>Think in outcomes.<br />Move in next actions.</strong></div>
            <img src="/navo-settings.png" alt="NavoPath settings and theme controls" />
          </div>
        </section>

        <section className="landing-section" id="features">
          <header className="landing-section-head"><span>02 / System</span><h2>{c.featureTitle}</h2></header>
          <div className="landing-feature-grid">
            {c.features.map(([title, body], index) => <article key={title}><div className="landing-glyph"><Glyph name={(["tree", "timeline", "sync", "spark"] as const)[index]} /></div><span>0{index + 1}</span><h3>{title}</h3><p>{body}</p></article>)}
          </div>
        </section>

        <section className="landing-section landing-principles" id="principles">
          <header className="landing-section-head"><span>03 / Principles</span><h2>{c.principlesTitle}</h2></header>
          <ol>{c.principles.map((item, index) => <li key={item}><span>0{index + 1}</span><strong>{item}</strong></li>)}</ol>
        </section>

        <section className="landing-cta">
          <ProductIcon />
          <h2>{c.ctaTitle}</h2>
          <p>{c.ctaBody}</p>
          <button className="landing-button primary" onClick={() => openAuth("signup")}>{c.start}<span>↗</span></button>
        </section>
      </main>

      <footer className="landing-footer"><span>{c.footer}</span><span>© 2026 Xiaoyang Chen</span></footer>

      {showAuth && <div className="landing-auth-overlay" onMouseDown={() => setShowAuth(false)}>
        <section className="landing-auth-card" onMouseDown={(event) => event.stopPropagation()}>
          <button className="landing-auth-close" onClick={() => setShowAuth(false)}>×</button>
          <ProductIcon /><span className="landing-auth-label">NavoPath account</span>
          <h2>{authIntent === "signin" ? (lang === "en" ? "Welcome back." : "欢迎回来。") : (lang === "en" ? "Start your path." : "开始你的路径。")}</h2>
          <div className="landing-auth-tabs"><button className={authIntent === "signin" ? "active" : ""} onClick={() => setAuthIntent("signin")}>Sign in</button><button className={authIntent === "signup" ? "active" : ""} onClick={() => setAuthIntent("signup")}>Sign up</button></div>
          <form onSubmit={(event) => { event.preventDefault(); if (!passwordMismatch) onLogin(email.trim(), password, displayName.trim(), authIntent); }}>
            {authIntent === "signup" && <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Display name" maxLength={64} />}
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" required />
            <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password (6+ characters)" minLength={6} required />
            {authIntent === "signup" && <input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirm password" minLength={6} required />}
            <label className="landing-auth-check"><input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} />Show password</label>
            {notice && <div className="landing-auth-notice"><strong>Check your inbox</strong><p>Confirm the email sent to {notice.email}, then sign in.</p><button type="button" onClick={() => onResend(notice.email)}>Resend email</button><button type="button" onClick={() => onContinueAfterConfirm(notice.email)}>Continue to sign in</button></div>}
            {passwordMismatch && <p className="landing-auth-error">Passwords do not match.</p>}
            {error && <p className="landing-auth-error">{error}</p>}
            <button className="landing-button primary full" disabled={busy || passwordMismatch}>{busy ? "Working…" : authIntent === "signin" ? "Open workspace" : "Create account"}</button>
          </form>
        </section>
      </div>}
    </div>
  );
}
