import { useEffect, useState } from "react";
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
    eyebrow: "为长期目标与今日行动而设计",
    title: "把宏大的目标变成",
    titleAccent: "今天清晰的下一步。",
    intro: "NavoPath 把长期项目规划与真实日程连接起来。先想清楚要推进什么，再把它放进今天真正可用的时间。",
    start: "开始规划",
    signIn: "打开工作区",
    proof: ["树状项目规划", "时间轴执行", "AI 辅助排程"],
    workflowTitle: "从长期目标，到今天真正完成的工作。",
    workflowIntro: "规划与执行保持连接。选择值得推进的任务，再为它安排一段真实可用的时间。",
    steps: [
      ["01", "搭建项目结构", "把复杂目标拆解为项目、任务和清晰的下一步行动。"],
      ["02", "选择今日推进项", "只把今天值得推进的任务带入今日候选。"],
      ["03", "让时间变得真实", "把任务拖入时间轴，解决冲突，并随变化重新安排。"],
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

function ProductFlowDemo({ lang }: { lang: Lang }) {
  const [step, setStep] = useState(0);
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const labels = lang === "zh"
    ? [
        ["01", "规划", "把长期目标拆成明确的下一步"],
        ["02", "选择", "把今天值得推进的任务加入候选"],
        ["03", "执行", "拖入时间轴，为任务留出真实时间"],
      ]
    : [
        ["01", "Plan", "Break long-term work into a clear next action"],
        ["02", "Choose", "Bring the right task into today's candidates"],
        ["03", "Execute", "Drag it onto the timeline and make time real"],
      ];

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (manuallyPaused || reducedMotion) return;
    const timer = window.setInterval(() => setStep((current) => (current + 1) % labels.length), 5200);
    return () => window.clearInterval(timer);
  }, [manuallyPaused, reducedMotion, labels.length]);

  return (
    <div className={`landing-flow-demo step-${step}`}>
      <div className="landing-frame-bar"><span /><span /><span /><b>NavoPath / Planning → Execute</b></div>
      <div className="landing-flow-stage">
        <figure className="landing-flow-pane planning">
          <figcaption>Planning</figcaption>
          <img src="/navo-planning-paper.png" alt={lang === "zh" ? "NavoPath 规划工作区" : "NavoPath Planning workspace"} />
        </figure>
        <div className="landing-flow-path" aria-hidden="true"><i /><i /><i /></div>
        <figure className="landing-flow-pane execute">
          <figcaption>Execute</figcaption>
          <img src="/navo-execute-paper.png" alt={lang === "zh" ? "NavoPath 执行工作区" : "NavoPath Execute workspace"} />
        </figure>
        <div className="landing-flow-task" aria-hidden="true">
          <span />
          <strong>{lang === "zh" ? "重构 NavoPath 视觉系统" : "Refine the NavoPath visual system"}</strong>
          <small>{step === 0 ? "Planning" : step === 1 ? (lang === "zh" ? "今日候选" : "Today's candidates") : "13:00 – 14:00"}</small>
        </div>
      </div>
      <div className="landing-flow-story" aria-label={lang === "zh" ? "产品操作流程" : "Product workflow"}>
        {labels.map(([number, title, body], index) => (
          <button type="button" key={number} className={index === step ? "active" : ""} onClick={() => { setStep(index); setManuallyPaused(true); }}>
            <span>{number}</span><strong>{title}</strong><small>{body}</small>
          </button>
        ))}
      </div>
      <button className="landing-flow-play" type="button" onClick={() => setManuallyPaused((value) => !value)}>
        {manuallyPaused ? (lang === "zh" ? "自动播放" : "Auto play") : (lang === "zh" ? "暂停演示" : "Pause demo")}
      </button>
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
  const [authIntent, setAuthIntent] = useState<AuthIntent>("signin");
  const [authView, setAuthView] = useState<"login" | "forgot" | "forgotSent">("login");
  const [forgotBusy, setForgotBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [preferredTheme, setPreferredTheme] = useState<"light" | "dark">("light");
  const c = copy[lang];
  const authText = lang === "zh" ? {
    account: "NavoPath 账户", welcome: "欢迎回来。", begin: "开始你的路径。",
    signIn: "登录", signUp: "注册", name: "显示名称", email: "邮箱",
    password: "密码（至少 6 位）", confirm: "确认密码", show: "显示密码",
    inbox: "请查收邮件", inboxBody: "请确认发送至该邮箱的邮件，然后返回登录。",
    resend: "重新发送邮件", continue: "继续登录", mismatch: "两次输入的密码不一致。",
    working: "处理中…", open: "打开工作区", create: "创建账户",
    theme: "进入工作区时使用", light: "浅色纸张", dark: "深色纸张",
    forgot: "忘记密码？", forgotTitle: "找回密码", forgotBody: "输入注册邮箱，我们将发送密码重置链接。",
    sendReset: "发送重置链接", sentTitle: "邮件已发送", sentBody: "密码重置邮件已发送。请检查收件箱，点击链接设置新密码。",
    backToLogin: "返回登录", resendReset: "重新发送",
  } : {
    account: "NavoPath account", welcome: "Welcome back.", begin: "Start your path.",
    signIn: "Sign in", signUp: "Sign up", name: "Display name", email: "Email",
    password: "Password (6+ characters)", confirm: "Confirm password", show: "Show password",
    inbox: "Check your inbox", inboxBody: "Confirm the email sent to this address, then return to sign in.",
    resend: "Resend email", continue: "Continue to sign in", mismatch: "Passwords do not match.",
    working: "Working…", open: "Open workspace", create: "Create account",
    theme: "Open workspace in", light: "Light paper", dark: "Dark paper",
    forgot: "Forgot password?", forgotTitle: "Reset Password", forgotBody: "Enter your registered email and we'll send a password reset link.",
    sendReset: "Send Reset Link", sentTitle: "Email Sent", sentBody: "Password reset email sent. Check your inbox and click the link to set a new password.",
    backToLogin: "Back to login", resendReset: "Resend",
  };
  const passwordMismatch = authIntent === "signup" && password.length > 0 && confirmPassword.length > 0 && password !== confirmPassword;

  useEffect(() => {
    if (!error && !notice) return;
    setShowAuth(true);
    if (notice) setAuthIntent("signup");
  }, [error, notice]);

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
          <button className="landing-lang" aria-label={lang === "en" ? "切换为中文" : "Switch to English"} onClick={() => setLang(lang === "en" ? "zh" : "en")}>{lang === "en" ? "中" : "EN"}</button>
          <button className="landing-button quiet small" onClick={() => openAuth("signin")}>{c.login}</button>
        </div>
      </nav>

      <main>
        <section className="landing-hero" id="top">
          <div className="landing-hero-copy">
            <span className="landing-kicker"><i />{c.eyebrow}</span>
            <h1>{c.title}<br /><em>{c.titleAccent}</em></h1>
            <p>{c.intro}</p>
            <div className="landing-actions">
              <button className="landing-button primary hero-cta" onClick={() => openAuth("signup")}>{c.start}<span>↗</span></button>
              <button className="landing-button quiet hero-cta" onClick={() => openAuth("signin")}>{c.signIn}</button>
            </div>
            <div className="landing-hero-path" aria-label={lang === "zh" ? "规划、选择、执行" : "Plan, choose, execute"}>
              <span><i className="plan" />{lang === "zh" ? "规划" : "Plan"}</span>
              <b aria-hidden="true">→</b>
              <span><i className="choice" />{lang === "zh" ? "选择" : "Choice"}</span>
              <b aria-hidden="true">→</b>
              <span><i className="execution" />{lang === "zh" ? "执行" : "Execution"}</span>
            </div>
          </div>
        </section>

        <section className="landing-demo-section" aria-label={lang === "zh" ? "NavoPath 产品操作演示" : "NavoPath product demonstration"}>
          <div className="landing-product-frame"><ProductFlowDemo lang={lang} /></div>
        </section>

        <section className="landing-section" id="workflow">
          <header className="landing-section-head"><span>{lang === "zh" ? "01 / 工作流" : "01 / Workflow"}</span><h2>{c.workflowTitle}</h2><p>{c.workflowIntro}</p></header>
          <div className="landing-workflow">
            {c.steps.map(([number, title, body]) => <article key={number}><span>{number}</span><div><h3>{title}</h3><p>{body}</p></div></article>)}
          </div>
          <div className="landing-planning-frame">
            <div><span>Planning</span><strong>{lang === "zh" ? <>以成果思考。<br />以下一步行动。</> : <>Think in outcomes.<br />Move in next actions.</>}</strong></div>
            <img src="/navo-planning-paper.png" alt={lang === "zh" ? "NavoPath 规划工作区" : "NavoPath Planning workspace"} />
          </div>
        </section>

        <section className="landing-section" id="features">
          <header className="landing-section-head"><span>{lang === "zh" ? "02 / 系统" : "02 / System"}</span><h2>{c.featureTitle}</h2></header>
          <div className="landing-feature-grid">
            {c.features.map(([title, body], index) => <article key={title}><div className="landing-glyph"><Glyph name={(["tree", "timeline", "sync", "spark"] as const)[index]} /></div><span>0{index + 1}</span><h3>{title}</h3><p>{body}</p></article>)}
          </div>
        </section>

        <section className="landing-section landing-principles" id="principles">
          <header className="landing-section-head"><span>{lang === "zh" ? "03 / 原则" : "03 / Principles"}</span><h2>{c.principlesTitle}</h2></header>
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

      {showAuth && <div className="landing-auth-overlay" onMouseDown={() => { setShowAuth(false); setAuthView("login"); }}>
        <section className="landing-auth-card" onMouseDown={(event) => event.stopPropagation()}>
          <button className="landing-auth-close" aria-label={lang === "zh" ? "关闭" : "Close"} onClick={() => { setShowAuth(false); setAuthView("login"); }}>×</button>
          <ProductIcon />
          {authView !== "login" ? (
            <>
              <span className="landing-auth-label">{authText.account}</span>
              <h2>{authView === "forgot" ? authText.forgotTitle : authText.sentTitle}</h2>
              {authView === "forgot" ? (
                <form onSubmit={async (event) => { event.preventDefault(); setForgotBusy(true); try { await onForgotPassword(email.trim()); setAuthView("forgotSent"); } finally { setForgotBusy(false); } }}>
                  <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "12px" }}>{authText.forgotBody}</p>
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={authText.email} required autoFocus />
                  {error && <p className="landing-auth-error">{error}</p>}
                  <button className="landing-button primary full" disabled={forgotBusy || !email.trim()}>{forgotBusy ? authText.working : authText.sendReset}</button>
                  <button type="button" className="landing-button quiet full" style={{ marginTop: "8px" }} onClick={() => { setAuthView("login"); }}>{authText.backToLogin}</button>
                </form>
              ) : (
                <div>
                  <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "12px" }}>{authText.sentBody}</p>
                  <p style={{ fontSize: "13px", fontWeight: 600, marginBottom: "16px", color: "var(--text-main)" }}>{email}</p>
                  <button className="landing-button primary full" onClick={async () => { setForgotBusy(true); try { await onForgotPassword(email.trim()); } finally { setForgotBusy(false); } }}>{authText.resendReset}</button>
                  <button className="landing-button quiet full" style={{ marginTop: "8px" }} onClick={() => { setAuthView("login"); }}>{authText.backToLogin}</button>
                </div>
              )}
            </>
          ) : (
            <>
              <span className="landing-auth-label">{authText.account}</span>
              <h2>{authIntent === "signin" ? authText.welcome : authText.begin}</h2>
              <div className="landing-auth-tabs"><button className={authIntent === "signin" ? "active" : ""} onClick={() => setAuthIntent("signin")}>{authText.signIn}</button><button className={authIntent === "signup" ? "active" : ""} onClick={() => setAuthIntent("signup")}>{authText.signUp}</button></div>
              <form onSubmit={(event) => { event.preventDefault(); if (!passwordMismatch) onLogin(email.trim(), password, displayName.trim(), authIntent, preferredTheme); }}>
                {authIntent === "signup" && <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={authText.name} maxLength={64} />}
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={authText.email} required />
                <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={authText.password} minLength={6} required />
                {authIntent === "signup" && <input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder={authText.confirm} minLength={6} required />}
                <fieldset className="landing-auth-theme">
                  <legend>{authText.theme}</legend>
                  <button type="button" className={preferredTheme === "light" ? "active" : ""} onClick={() => setPreferredTheme("light")}><i className="light" /><span>{authText.light}</span></button>
                  <button type="button" className={preferredTheme === "dark" ? "active" : ""} onClick={() => setPreferredTheme("dark")}><i className="dark" /><span>{authText.dark}</span></button>
                </fieldset>
                <label className="landing-auth-check"><input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} />{authText.show}</label>
                {authIntent === "signin" && <button type="button" className="landing-forgot-link" onClick={() => { setAuthView("forgot"); }}>{authText.forgot}</button>}
                {notice && <div className="landing-auth-notice"><strong>{authText.inbox}</strong><p>{authText.inboxBody}<br />{notice.email}</p><button type="button" onClick={() => onResend(notice.email)}>{authText.resend}</button><button type="button" onClick={() => onContinueAfterConfirm(notice.email)}>{authText.continue}</button></div>}
                {passwordMismatch && <p className="landing-auth-error">{authText.mismatch}</p>}
                {error && <p className="landing-auth-error">{error}</p>}
                <button className="landing-button primary full" disabled={busy || passwordMismatch}>{busy ? authText.working : authIntent === "signin" ? authText.open : authText.create}</button>
              </form>
            </>
          )}
        </section>
      </div>}
    </div>
  );
}
