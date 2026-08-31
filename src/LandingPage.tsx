import { type CSSProperties, useEffect, useState } from "react";
import { ProductIcon } from "./main";
import { DESKTOP_DOWNLOAD_URL } from "./downloads";
import "./landing.css";

type AuthIntent = "signin" | "signup";
type Lang = "en" | "zh";

const DONATION_URL = "https://afdian.com/a/233cxy/plan";
const GITHUB_URL = "https://github.com/shawn89890916/NavoPath-planner";

const copy = {
  en: {
    nav: [["How it works", "#how-it-works"], ["Support", DONATION_URL], ["GitHub", GITHUB_URL]],
    login: "Log in", donate: "Support",
    productName: "NavoPath",
    title: "See what to do today — and when to do it.",
    scroll: "Scroll to explore", start: "Start planning", download: "Download for Windows",
    productKicker: "Execute / Today", productLabel: "Candidates · Timeline",
    preview: {
      execute: "Execute", planning: "Planning", candidates: "Today's Candidates", allDay: "All Day", add: "Add task #project",
      views: ["Day", "3-Day", "Week", "Month"], date: "31 · Mon",
      candidateGroups: [
        { title: "Client work", tasks: [["Prepare weekly update", "30m"], ["Review design handoff", "45m"]] },
        { title: "Personal", tasks: [["Inbox & follow-ups", "30m"], ["Prepare team 1:1", "25m"], ["Book focus time", "15m"]] },
      ],
      timeline: [["09:00", "Team stand-up", "coral"], ["10:00", "Deep work: proposal", "sage"], ["13:30", "Client review", "blue"], ["15:00", "Follow-up block", "brown"]],
    },
    stepsKicker: "Plan the day", stepsTitle: "Turn one list into a timeline you can follow.",
    steps: [
      ["01", "Keep the list small", "Bring only the tasks that might genuinely fit today into view."],
      ["02", "See the open time", "Place a task beside the commitments that already shape your day."],
      ["03", "Follow the next step", "A clear timeline makes the next useful action easier to begin."],
    ],
    planningKicker: "Work plan", planningTitle: "Keep work moving without losing the day.",
    planningBody: "Keep related work together, then make room for it in a real week.",
    planningProject: "Client launch", planningTasks: [["Prepare project update", "45m"], ["Review campaign brief", "30m"], ["Send follow-up", "15m"]],
    ctaTitle: "Give the next useful task a time and a place.", ctaBody: "Open a calm workspace for the day ahead.",
    footer: "NavoPath / Plan the path. Execute today.", ctaDonate: "Support ongoing development",
  },
  zh: {
    nav: [["怎么用", "#how-it-works"], ["支持我们", DONATION_URL], ["GitHub", GITHUB_URL]],
    login: "登录", donate: "支持",
    productName: "NavoPath",
    title: "今天的事，先安排明白。",
    scroll: "继续探索", start: "开始安排", download: "下载 Windows 版",
    productKicker: "今天的安排", productLabel: "待办 · 日程",
    preview: {
      execute: "执行", planning: "规划", candidates: "今日候选", allDay: "全天", add: "添加任务 #项目",
      views: ["日", "3 天", "周", "月"], date: "31 · 周一",
      candidateGroups: [
        { title: "客户项目", tasks: [["整理本周项目进度", "30 分钟"], ["审阅设计交接", "45 分钟"]] },
        { title: "个人安排", tasks: [["处理邮件与跟进", "30 分钟"], ["准备团队一对一", "25 分钟"], ["预留专注时间", "15 分钟"]] },
      ],
      timeline: [["09:00", "团队站会", "coral"], ["10:00", "专注：客户方案", "sage"], ["13:30", "客户评审", "blue"], ["15:00", "集中跟进", "brown"]],
    },
    stepsKicker: "怎么用", stepsTitle: "别让待办，只是一长串。",
    steps: [
      ["01", "先挑最要紧的几件", "不用什么都塞进今天。今天该做什么，先挑出来。"],
      ["02", "再看看怎么排", "打开日历，把它们挪进空档。忙不忙、赶不赶，一眼就知道。"],
      ["03", "照着做下去", "几点做什么，都写在眼前。接下来该做哪件，不用再想。"],
    ],
    planningKicker: "项目规划", planningTitle: "项目再大，也能一件件做下去。",
    planningBody: "把相关的事放在一块儿，什么时候该推哪一件，就清楚了。",
    planningProject: "客户发布", planningTasks: [["对一遍项目进度", "45 分钟"], ["看活动方案", "30 分钟"], ["发跟进邮件", "15 分钟"]],
    ctaTitle: "今天，先把一件事做好。", ctaBody: "打开 NavoPath，把它排进日程，就开始。",
    footer: "NavoPath / 今天的事，今天安排。", ctaDonate: "支持我们",
  },
} as const;

function ProductPreview({ lang }: { lang: Lang }) {
  const c = copy[lang];
  const p = c.preview;
  return <section className="landing-product-rise" aria-label={c.productKicker}>
    <div className={`landing-execute-preview lang-${lang}`} role="img" aria-label={lang === "zh" ? "NavoPath 执行页面：日常职场任务和时间轴" : "NavoPath Execute view with an everyday professional schedule"}>
      <header className="landing-execute-preview-header">
        <div className="landing-execute-preview-brand"><ProductIcon compact /><strong>NavoPath</strong></div>
        <nav><b>{p.execute}</b><span>{p.planning}</span></nav>
        <div className="landing-execute-preview-actions" aria-hidden="true"><i>↻</i><i>⌕</i><i>⚙</i></div>
      </header>
      <div className="landing-execute-preview-body">
        <aside className="landing-execute-candidates">
          <header><h3>{p.candidates}</h3><span aria-hidden="true">⌘</span><span aria-hidden="true">◎</span><span aria-hidden="true">⌄</span></header>
          <div className="landing-execute-candidate-list">
            {p.candidateGroups.map((group) => <section key={group.title} className="landing-execute-group">
              <div className="landing-execute-group-label"><i /><span>{group.title}</span><small>{group.tasks.length}</small></div>
              {group.tasks.map(([title, duration]) => <article key={title} className="landing-execute-task"><i aria-hidden="true" /><strong>{title}</strong><small>{duration}</small><span aria-hidden="true">⌄</span></article>)}
            </section>)}
          </div>
          <footer><span>{p.add}</span><i aria-hidden="true" /><button type="button" tabIndex={-1}>{lang === "zh" ? "添加" : "Add"}</button></footer>
        </aside>
        <section className="landing-execute-timeline">
          <header className="landing-execute-timeline-header"><strong>{p.date}</strong><nav>{p.views.map((view, index) => <span key={view} className={index === 0 ? "active" : ""}>{view}</span>)}</nav></header>
          <div className="landing-execute-all-day"><b>{p.allDay}</b><span /></div>
          <div className="landing-execute-hours">
            {p.timeline.map(([time, title, tone]) => <div className={`landing-execute-hour is-${tone}`} key={time}><time>{time}</time><span className="landing-execute-hour-rule" /><article><i aria-hidden="true" /><strong>{title}</strong></article></div>)}
          </div>
          <div className="landing-execute-preview-fabs" aria-hidden="true"><i>+</i><i>AI</i></div>
        </section>
      </div>
    </div>
  </section>;
}

function PlanningPreview({ lang }: { lang: Lang }) {
  const c = copy[lang];
  return <section className="landing-planning-preview" aria-label={c.planningTitle}>
    <div className="landing-project-node"><span>01</span><strong>{c.planningProject}</strong><i>3</i></div>
    <div className="landing-project-branch">{c.planningTasks.map(([task, duration]) => <div className="landing-project-task" key={task}><i aria-hidden="true" /><strong>{task}</strong><small>{duration}</small></div>)}</div>
  </section>;
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
    account: "NavoPath 账号", welcome: "欢迎回来。", begin: "今天，也可以从现在开始。", signIn: "登录", signUp: "注册", name: "怎么称呼你", email: "邮箱", password: "密码（至少 6 位）", confirm: "再输一次密码", show: "显示密码", inbox: "去收件箱看看", inboxBody: "确认邮件已经发到这个邮箱。点开链接确认后，再来登录。", resend: "再发一封", continue: "去登录", mismatch: "两次密码没有输一样。", working: "正在处理…", open: "打开 NavoPath", create: "注册 NavoPath", theme: "想用什么主题？", light: "浅色纸张", dark: "深色纸张", forgot: "想不起密码了？", forgotTitle: "重设密码", forgotBody: "填一下注册邮箱，我们把重置链接发给你。", sendReset: "把重置链接发给我", sentTitle: "重置链接已发出", sentBody: "去收件箱点开链接，设个新密码就好了。", backToLogin: "回到登录", resendReset: "再发一次",
  } : {
    account: "NavoPath account", welcome: "Welcome back.", begin: "Start your path.", signIn: "Sign in", signUp: "Sign up", name: "Display name", email: "Email", password: "Password (6+ characters)", confirm: "Confirm password", show: "Show password", inbox: "Check your inbox", inboxBody: "Confirm the email sent to this address, then return to sign in.", resend: "Resend email", continue: "Continue to sign in", mismatch: "Passwords do not match.", working: "Working...", open: "Open workspace", create: "Create account", theme: "Open workspace in", light: "Light paper", dark: "Dark paper", forgot: "Forgot password?", forgotTitle: "Reset password", forgotBody: "Enter your registered email and we will send a reset link.", sendReset: "Send reset link", sentTitle: "Email sent", sentBody: "Check your inbox and click the link to set a new password.", backToLogin: "Back to login", resendReset: "Resend",
  };
  const passwordMismatch = authIntent === "signup" && password.length > 0 && confirmPassword.length > 0 && password !== confirmPassword;

  return <div className="landing-auth-overlay" onMouseDown={onClose}>
    <section className="landing-auth-card" onMouseDown={(event) => event.stopPropagation()}>
      <button className="landing-auth-close" aria-label={lang === "zh" ? "关闭" : "Close"} onClick={onClose}>×</button>
      <ProductIcon /><span className="landing-auth-label">{text.account}</span>
      {authView !== "login" ? <>
        <h2>{authView === "forgot" ? text.forgotTitle : text.sentTitle}</h2>
        {authView === "forgot" ? <form onSubmit={async (event) => { event.preventDefault(); setForgotBusy(true); try { await onForgotPassword(email.trim()); setAuthView("forgotSent"); } finally { setForgotBusy(false); } }}>
          <p>{text.forgotBody}</p><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={text.email} required autoFocus />
          {error && <p className="landing-auth-error">{error}</p>}
          <button className="landing-button primary full" disabled={forgotBusy || !email.trim()}>{forgotBusy ? text.working : text.sendReset}</button>
          <button type="button" className="landing-button quiet full" onClick={() => setAuthView("login")}>{text.backToLogin}</button>
        </form> : <div><p>{text.sentBody}</p><strong className="landing-auth-email">{email}</strong><button className="landing-button primary full" onClick={async () => { setForgotBusy(true); try { await onForgotPassword(email.trim()); } finally { setForgotBusy(false); } }}>{text.resendReset}</button><button type="button" className="landing-button quiet full" onClick={() => setAuthView("login")}>{text.backToLogin}</button></div>}
      </> : <>
        <h2>{authIntent === "signin" ? text.welcome : text.begin}</h2>
        <div className="landing-auth-tabs"><button className={authIntent === "signin" ? "active" : ""} onClick={() => setAuthIntent("signin")}>{text.signIn}</button><button className={authIntent === "signup" ? "active" : ""} onClick={() => setAuthIntent("signup")}>{text.signUp}</button></div>
        <form onSubmit={(event) => { event.preventDefault(); if (!passwordMismatch) onLogin(email.trim(), password, displayName.trim(), authIntent, preferredTheme); }}>
          {authIntent === "signup" && <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={text.name} maxLength={64} />}
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={text.email} required />
          <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={text.password} minLength={6} required />
          {authIntent === "signup" && <input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder={text.confirm} minLength={6} required />}
          <fieldset className="landing-auth-theme"><legend>{text.theme}</legend><button type="button" className={preferredTheme === "light" ? "active" : ""} onClick={() => setPreferredTheme("light")}><i className="light" /><span>{text.light}</span></button><button type="button" className={preferredTheme === "dark" ? "active" : ""} onClick={() => setPreferredTheme("dark")}><i className="dark" /><span>{text.dark}</span></button></fieldset>
          <label className="landing-auth-check"><input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} />{text.show}</label>
          {authIntent === "signin" && <button type="button" className="landing-forgot-link" onClick={() => setAuthView("forgot")}>{text.forgot}</button>}
          {notice && <div className="landing-auth-notice"><strong>{text.inbox}</strong><p>{text.inboxBody}<br />{notice.email}</p><button type="button" onClick={() => onResend(notice.email)}>{text.resend}</button><button type="button" onClick={() => onContinueAfterConfirm(notice.email)}>{text.continue}</button></div>}
          {passwordMismatch && <p className="landing-auth-error">{text.mismatch}</p>}{error && <p className="landing-auth-error">{error}</p>}
          <button className="landing-button primary full" disabled={busy || passwordMismatch}>{busy ? text.working : authIntent === "signin" ? text.open : text.create}</button>
        </form>
      </>}
    </section>
  </div>;
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
  const [coverRecede, setCoverRecede] = useState(0);
  const c = copy[lang];

  useEffect(() => {
    document.documentElement.classList.add("landing-document");
    const nodes = [document.documentElement, document.body, document.getElementById("root")].filter(Boolean) as HTMLElement[];
    const previous = nodes.map((node) => node.getAttribute("style"));
    nodes.forEach((node) => {
      node.style.setProperty("height", "auto", "important");
      node.style.setProperty("min-height", "100%", "important");
      node.style.setProperty("overflow-y", "auto", "important");
      node.style.setProperty("overflow-x", "clip", "important");
      node.style.setProperty("touch-action", "pan-y", "important");
      node.style.setProperty("overscroll-behavior-y", "auto", "important");
    });
    return () => {
      document.documentElement.classList.remove("landing-document");
      nodes.forEach((node, index) => {
        const style = previous[index];
        if (style === null) node.removeAttribute("style");
        else node.setAttribute("style", style);
      });
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const viewport = Math.max(window.innerHeight, 1);
      const distance = Math.min(1, Math.max(0, (window.scrollY - viewport * .1) / (viewport * 1.4)));
      const progress = distance ** .34;
      setCoverRecede((current) => Math.abs(current - progress) < .01 ? current : progress);
    };
    const requestUpdate = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    requestUpdate();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, []);

  const coverStyle = {
    "--landing-cover-scale": String(1 - coverRecede * .16),
    "--landing-cover-gray": String(coverRecede * .98),
    "--landing-cover-brightness": String(1 - coverRecede * .22),
    "--landing-cover-opacity": String(1 - coverRecede * .56),
  } as CSSProperties;

  return <div className="landing" lang={lang}>
    <nav className="landing-nav" aria-label="NavoPath">
      <a className="landing-brand" href="#top" aria-label="NavoPath"><ProductIcon compact /><span>NavoPath</span></a>
      <div className="landing-nav-links">{c.nav.map(([label, href]) => <a key={href} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined}>{label}</a>)}</div>
      <div className="landing-nav-actions"><button className="landing-lang" aria-label={lang === "en" ? "切换为中文" : "Switch to English"} onClick={() => setLang(lang === "en" ? "zh" : "en")}>{lang === "en" ? "中" : "EN"}</button><button className="landing-button quiet small" onClick={() => setShowAuth(true)}>{c.login}</button></div>
    </nav>
    <main>
      <section className="landing-cover" id="top"><div className="landing-cover-content" style={coverStyle}><div className="landing-cover-logo"><ProductIcon /></div><div className="landing-brand-copy"><p className="landing-product-name">{c.productName}</p><h1 className="landing-slogan">{c.title}</h1></div></div><span className="landing-product-scroll-cue" aria-hidden="true"><i>↑</i>{c.scroll}</span></section>
      <ProductPreview lang={lang} />
      <section className="landing-steps" id="how-it-works"><div className="landing-steps-intro"><span>01 / {c.stepsKicker}</span><h2>{c.stepsTitle}</h2></div><ol>{c.steps.map(([number, title, body]) => <li key={number}><span>{number}</span><div><h3>{title}</h3><p>{body}</p></div></li>)}</ol></section>
      <section className="landing-planning" id="planning"><div className="landing-planning-copy"><span>02 / {c.planningKicker}</span><h2>{c.planningTitle}</h2><p>{c.planningBody}</p></div><PlanningPreview lang={lang} /></section>
      <section className="landing-cta"><span>03 / NAVOPATH</span><h2>{c.ctaTitle}</h2><p>{c.ctaBody}</p><div className="landing-actions"><button className="landing-button primary" onClick={() => setShowAuth(true)}>{c.start}<span>→</span></button><a className="landing-button quiet" href={DESKTOP_DOWNLOAD_URL} target="_blank" rel="noreferrer">{c.download}<span>→</span></a></div></section>
    </main>
    <footer className="landing-footer"><span>{c.footer}</span><a href={DONATION_URL} target="_blank" rel="noreferrer">{c.ctaDonate}</a><span>© 2026 Xiaoyang Chen</span></footer>
    {showAuth && <AuthDialog lang={lang} onClose={() => setShowAuth(false)} onLogin={onLogin} onResend={onResend} onContinueAfterConfirm={onContinueAfterConfirm} onForgotPassword={onForgotPassword} busy={busy} error={error} notice={notice} />}
  </div>;
}
