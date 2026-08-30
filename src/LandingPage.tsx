import { useState } from "react";
import { ProductIcon } from "./main";
import { DESKTOP_DOWNLOAD_URL } from "./downloads";
import "./landing.css";

type AuthIntent = "signin" | "signup";
type Lang = "en" | "zh";

const DONATION_URL = "https://afdian.com/a/233cxy/plan";

const copy = {
  en: {
    nav: [["How it works", "#how-it-works"]],
    login: "Log in", donate: "Support",
    productName: "NavoPath",
    title: "See what to do today — and when to do it.",
    scroll: "Explore the day", start: "Start planning", download: "Download for Windows",
    productKicker: "Execute / Today", productLabel: "Candidates · Timeline",
    stepsKicker: "Plan the day", stepsTitle: "Turn one list into a timeline you can follow.",
    steps: [
      ["01", "Keep the list small", "Bring only the tasks that might genuinely fit today into view."],
      ["02", "See the open time", "Place a task beside the commitments that already shape your day."],
      ["03", "Follow the next step", "A clear timeline makes the next useful action easier to begin."],
    ],
    planningKicker: "Planning view", planningTitle: "Keep work and learning on one path.",
    planningBody: "Use projects to hold the longer story, then turn a small part of it into an ordinary day.",
    planningProject: "After-work learning", planningTasks: [["Read one chapter", "45m"], ["Write commute notes", "20m"], ["Practice one problem", "15m"]],
    ctaTitle: "Give the next useful task a time and a place.", ctaBody: "Open a calm workspace for the day ahead.",
    footer: "NavoPath / Plan the path. Execute today.", ctaDonate: "Support ongoing development",
  },
  zh: {
    nav: [["如何使用", "#how-it-works"]],
    login: "登录", donate: "支持",
    productName: "NavoPath",
    title: "今天做什么，什么时候做，一眼看清。",
    scroll: "查看今天", start: "开始规划", download: "下载 Windows 版",
    productKicker: "执行 / 今天", productLabel: "候选任务 · 时间轴",
    stepsKicker: "安排今天", stepsTitle: "一张清单，变成一条可以照着走的时间线。",
    steps: [
      ["01", "先让清单变小", "只把今天可能真的做完的事，留在眼前。"],
      ["02", "再看见空档", "把任务放在已经存在的安排旁边，先看清取舍。"],
      ["03", "然后开始下一步", "清楚的时间轴，让下一件有用的事更容易开始。"],
    ],
    planningKicker: "长期规划", planningTitle: "把工作与学习，放进同一条路径。",
    planningBody: "项目承载更长的故事，再从中挑出一小段，安放进平常的一天。",
    planningProject: "下班后的学习", planningTasks: [["读完一个章节", "45 分钟"], ["整理通勤笔记", "20 分钟"], ["练一道题", "15 分钟"]],
    ctaTitle: "给下一件重要的事，留出发生的位置。", ctaBody: "打开一个安静、清楚的工作区，开始安排今天。",
    footer: "NavoPath / 规划路径，执行今天。", ctaDonate: "支持后续开发",
  },
} as const;

function ProductPreview({ lang }: { lang: Lang }) {
  const c = copy[lang];
  return <section className="landing-product-rise" aria-label={c.productKicker}>
    <p className="landing-product-kicker"><span>{c.productKicker}</span><strong>{c.productLabel}</strong></p>
    <img className="landing-product-shot" src={`${import.meta.env.BASE_URL}navo-execute-current.png`} alt={lang === "zh" ? "NavoPath 最新执行工作区，显示候选任务与时间轴" : "The current NavoPath Execute workspace with candidates and a timeline"} />
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
    account: "NavoPath 账户", welcome: "欢迎回来。", begin: "开始你的路径。", signIn: "登录", signUp: "注册", name: "显示名称", email: "邮箱", password: "密码（至少 6 位）", confirm: "确认密码", show: "显示密码", inbox: "请检查邮箱", inboxBody: "确认发送到该邮箱的邮件，然后返回登录。", resend: "重新发送", continue: "继续登录", mismatch: "两次输入的密码不一致。", working: "处理中...", open: "打开工作区", create: "创建账户", theme: "进入工作区时使用", light: "浅色纸张", dark: "深色纸张", forgot: "忘记密码？", forgotTitle: "找回密码", forgotBody: "输入注册邮箱，我们会发送密码重置链接。", sendReset: "发送重置链接", sentTitle: "邮件已发送", sentBody: "请检查收件箱并点击链接设置新密码。", backToLogin: "返回登录", resendReset: "重新发送",
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
  const c = copy[lang];

  return <div className="landing" lang={lang}>
    <nav className="landing-nav" aria-label="NavoPath">
      <a className="landing-brand" href="#top"><ProductIcon compact /><span>NavoPath</span></a>
      <div className="landing-nav-links">{c.nav.map(([label, href]) => <a key={href} href={href}>{label}</a>)}</div>
      <div className="landing-nav-actions"><a className="landing-donation-link" href={DONATION_URL} target="_blank" rel="noreferrer">{c.donate}</a><button className="landing-lang" aria-label={lang === "en" ? "切换为中文" : "Switch to English"} onClick={() => setLang(lang === "en" ? "zh" : "en")}>{lang === "en" ? "中" : "EN"}</button><button className="landing-button quiet small" onClick={() => setShowAuth(true)}>{c.login}</button></div>
    </nav>
    <main>
      <section className="landing-cover" id="top"><div className="landing-cover-content"><div className="landing-cover-logo"><ProductIcon /></div><p className="landing-product-name">{c.productName}</p><h1 className="landing-slogan">{c.title}</h1><span className="landing-scroll-cue">{c.scroll}</span></div></section>
      <ProductPreview lang={lang} />
      <section className="landing-steps" id="how-it-works"><div className="landing-steps-intro"><span>01 / {c.stepsKicker}</span><h2>{c.stepsTitle}</h2></div><ol>{c.steps.map(([number, title, body]) => <li key={number}><span>{number}</span><div><h3>{title}</h3><p>{body}</p></div></li>)}</ol></section>
      <section className="landing-planning" id="planning"><div className="landing-planning-copy"><span>02 / {c.planningKicker}</span><h2>{c.planningTitle}</h2><p>{c.planningBody}</p></div><PlanningPreview lang={lang} /></section>
      <section className="landing-cta"><span>03 / NAVOPATH</span><h2>{c.ctaTitle}</h2><p>{c.ctaBody}</p><div className="landing-actions"><button className="landing-button primary" onClick={() => setShowAuth(true)}>{c.start}<span>→</span></button><a className="landing-button quiet" href={DESKTOP_DOWNLOAD_URL} target="_blank" rel="noreferrer">{c.download}<span>→</span></a></div></section>
    </main>
    <footer className="landing-footer"><span>{c.footer}</span><a href={DONATION_URL} target="_blank" rel="noreferrer">{c.ctaDonate}</a><span>© 2026 Xiaoyang Chen</span></footer>
    {showAuth && <AuthDialog lang={lang} onClose={() => setShowAuth(false)} onLogin={onLogin} onResend={onResend} onContinueAfterConfirm={onContinueAfterConfirm} onForgotPassword={onForgotPassword} busy={busy} error={error} notice={notice} />}
  </div>;
}
