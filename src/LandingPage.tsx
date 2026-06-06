import { useState, useEffect, useRef } from "react";
import { ProductIcon } from "./main";

type AuthIntent = "signin" | "signup";
type Lang = "en" | "zh";

function localizeAuthMessage(message: string, lang: Lang) {
  if (!message) return "";
  if (lang === "zh") return message;
  if (message.includes("邮箱或密码不正确")) return "Incorrect email or password.";
  if (message.includes("邮箱还没有完成确认")) return "Your email is not confirmed yet. Open the confirmation link in your inbox first.";
  if (message.includes("这个邮箱已经注册过")) return "This email is already registered. Sign in instead.";
  if (message.includes("密码强度不够")) return "Password is too weak. Use at least 6 characters.";
  if (message.includes("请求过于频繁")) return "Too many requests. Please try again later.";
  if (message.includes("确认邮件已重新发送")) return "Confirmation email has been sent again.";
  if (message.includes("邮箱确认完成后，请直接登录")) return "After confirming your email, sign in with your password.";
  return message;
}

const t = {
  en: {
    nav: { features: "Features", projects: "Projects", contact: "Contact", login: "Log In" },
    hero: { title: "Navigate your next step.", subtitle: "The planning tool for turning goals into action.", getStarted: "Get Started", signIn: "Sign In" },
    features: { badge: "What it does", title: "From Planning to Execution", subtitle: "Break down complex long-term projects into actionable daily plans", items: [
      { title: "Tree Planning", desc: "Organize long-term projects in a tree structure. Break complex goals into manageable steps.", icon: "🌳" },
      { title: "Timeline Execution", desc: "Drag tasks to the timeline. Precisely schedule your day's action plan.", icon: "📅" },
      { title: "AI Assisted", desc: "Smart daily planning based on priority and deadlines. Let AI handle the scheduling.", icon: "🤖" },
      { title: "Cloud Sync", desc: "Data stored securely in the cloud. Access from any device, anywhere.", icon: "☁️" },
    ]},
    work: { badge: "Built on", title: "Tech Stack & Open Source", subtitle: "Built with modern technology. Fully open source. Contributions welcome.", items: [
      { title: "Navo AI", desc: "ESP32-S3 voice assistant with serial protocol hacking and MCP-integrated servo control", tags: ["Hardware", "Voice", "IoT"] },
      { title: "OpenClaw Soul", desc: "AI Agent self-evolution framework with three-layer memory architecture and autonomous reflection", tags: ["TypeScript", "MCP", "Memory"] },
    ]},
    cta: { title: "Ready to plan?", subtitle: "Start organizing your projects and time with NavoPath.", button: "Get Started" },
    auth: { signin: "Sign In", signup: "Sign Up", email: "Email", displayName: "Display Name", password: "Password (6+ chars)", signingIn: "Signing in...", signingUp: "Signing up...", note: "Account data is stored independently. Repeated signups may trigger email rate limiting." },
    footer: "© 2026 NavoPath by 陈潇杨. Built with 🟣",
  },
  zh: {
    nav: { features: "功能", projects: "项目", contact: "联系", login: "登录" },
    hero: { title: "导航你的下一步。", subtitle: "面向工程学生的时间管理工具。", getStarted: "立即开始", signIn: "登录" },
    features: { badge: "核心功能", title: "从规划到执行，一步到位", subtitle: "把长期项目的复杂任务拆解为每天可执行的行动计划", items: [
      { title: "项目树规划", desc: "用树形结构组织长期项目，拆解复杂任务为可执行的小步骤", icon: "🌳" },
      { title: "时间轴执行", desc: "拖拽任务到时间轴，精确安排每天的行动计划", icon: "📅" },
      { title: "AI 辅助", desc: "智能规划今天要做什么，基于优先级和截止日自动安排", icon: "🤖" },
      { title: "数据同步", desc: "云端存储，多设备访问，数据安全加密", icon: "☁️" },
    ]},
    work: { badge: "技术栈", title: "技术栈与开源", subtitle: "现代技术栈构建，完全开源，欢迎贡献", items: [
      { title: "Navo AI", desc: "ESP32-S3 语音助手，串口协议破解，MCP 集成舵机控制", tags: ["硬件黑客", "语音识别", "IoT"] },
      { title: "OpenClaw Soul", desc: "AI Agent 自我进化框架，三层记忆架构，目标管理，自主反思", tags: ["TypeScript", "MCP", "记忆架构"] },
    ]},
    cta: { title: "准备开始了吗？", subtitle: "开始用 NavoPath 管理你的项目和时间。", button: "立即开始" },
    auth: { signin: "登录", signup: "注册", email: "邮箱", displayName: "用户名", password: "密码（至少6位）", signingIn: "登录中...", signingUp: "注册中...", note: "每个账号的数据独立保存。连续注册会触发邮件安全限流。" },
    footer: "© 2026 NavoPath by 陈潇杨. Built with 🟣",
  }
};

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
  const content = t[lang];
  const passwordMismatch = authIntent === "signup" && password.length > 0 && confirmPassword.length > 0 && password !== confirmPassword;
  const visibleError = localizeAuthMessage(error, lang);

  // Scroll reveal
  const observerRef = useRef<IntersectionObserver | null>(null);
  const revealRefs = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
          }
        });
      },
      { threshold: 0.1 }
    );

    revealRefs.current.forEach((el) => observerRef.current?.observe(el));

    return () => observerRef.current?.disconnect();
  }, []);

  function setRevealRef(id: string) {
    return (el: HTMLElement | null) => {
      if (el) {
        revealRefs.current.set(id, el);
        observerRef.current?.observe(el);
      }
    };
  }

  function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (passwordMismatch) return;
    onLogin(email.trim(), password, displayName.trim(), authIntent);
  }

  const techTags = ["React", "Vite", "TypeScript", "Electron", "GitHub Actions", "Cloudflare Pages"];

  return (
    <div className="landing" lang={lang}>
      {/* Particle Canvas */}
      <ParticleBackground />

      {/* Navigation */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-nav-brand">
            <ProductIcon compact />
            <span>NavoPath</span>
          </div>
          <div className="landing-nav-links">
            <a href="#features">{content.nav.features}</a>
            <a href="#work">{content.nav.projects}</a>
            <a href="#contact">{content.nav.contact}</a>
          </div>
          <div className="landing-nav-actions">
            <div className="landing-lang-switch">
              <button className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>EN</button>
              <button className={lang === "zh" ? "active" : ""} onClick={() => setLang("zh")}>中</button>
            </div>
            <button
              className="landing-cta-pill small"
              onClick={() => { setAuthIntent("signin"); setShowAuth(true); }}
            >{content.nav.login}</button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero-content">
          <h1>
            <span className="hero-name">NavoPath</span>
            <br />
            <span className="hero-tagline">{content.hero.title}</span>
          </h1>
          <p>{content.hero.subtitle}</p>
          <div className="landing-hero-buttons">
            <button
              className="landing-cta-pill primary"
              onClick={() => { setAuthIntent("signup"); setShowAuth(true); }}
            >{content.hero.getStarted}</button>
            <button
              className="landing-cta-pill secondary"
              onClick={() => { setAuthIntent("signin"); setShowAuth(true); }}
            >{content.hero.signIn}</button>
          </div>
        </div>
      </section>

      {/* Auth Modal */}
      {showAuth && (
        <div className="landing-auth-overlay" onClick={() => setShowAuth(false)}>
          <div className="landing-auth-card" onClick={(e) => e.stopPropagation()}>
            <button className="landing-auth-close" onClick={() => setShowAuth(false)}>×</button>
            <div className="landing-auth-tabs">
              <button className={authIntent === "signin" ? "active" : ""} onClick={() => setAuthIntent("signin")}>{content.auth.signin}</button>
              <button className={authIntent === "signup" ? "active" : ""} onClick={() => setAuthIntent("signup")}>{content.auth.signup}</button>
            </div>
            <form onSubmit={handleAuthSubmit}>
              {authIntent === "signup" && <input type="text" placeholder={lang === "en" ? "Display Name" : "用户名"} value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={64} />}
              <input type="email" placeholder={content.auth.email} value={email} onChange={(e) => setEmail(e.target.value)} required />
              <input type={showPassword ? "text" : "password"} placeholder={content.auth.password} value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} maxLength={128} required />
              {authIntent === "signup" && <input type={showPassword ? "text" : "password"} placeholder={lang === "en" ? "Confirm password" : "确认密码"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={6} maxLength={128} required />}
              <label className="landing-auth-check">
                <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
                <span>{lang === "en" ? "Show password" : "显示密码"}</span>
              </label>
              {notice?.type === "confirm-email" && (
                <div className="landing-auth-notice">
                  <strong>{lang === "en" ? "Check your inbox" : "请检查邮箱"}</strong>
                  <p>{lang === "en" ? `We've sent a confirmation email to ${notice.email}. Confirm it, then sign in.` : `确认邮件已发送到 ${notice.email}。完成确认后再登录。`}</p>
                  <div className="landing-auth-notice-actions">
                    <button type="button" className="landing-auth-secondary" onClick={() => onResend(notice.email)}>{lang === "en" ? "Resend email" : "重发邮件"}</button>
                    <button type="button" className="landing-auth-secondary" onClick={() => { setAuthIntent("signin"); onContinueAfterConfirm(notice.email); }}>{lang === "en" ? "I've confirmed, go to sign in" : "我已确认，去登录"}</button>
                  </div>
                </div>
              )}
              {passwordMismatch && <p className="landing-auth-error">{lang === "en" ? "Passwords do not match." : "两次输入的密码不一致。"}</p>}
              <button type="submit" disabled={busy || passwordMismatch} className="landing-cta-pill primary full">
                {busy ? (authIntent === "signin" ? content.auth.signingIn : content.auth.signingUp) : (authIntent === "signin" ? content.auth.signin : content.auth.signup)}
              </button>
              {visibleError && <p className="landing-auth-error">{visibleError}</p>}
            </form>
            <p className="landing-auth-note">{content.auth.note}</p>
          </div>
        </div>
      )}

      {/* Features Section */}
      <section id="features" className="landing-section">
        <div className="landing-section-header" ref={setRevealRef("features-header")}>
          <span className="landing-badge">{content.features.badge}</span>
          <h2>{content.features.title}</h2>
          <p>{content.features.subtitle}</p>
        </div>
        <div className="landing-features-grid">
          {content.features.items.map((f, i) => (
            <div key={f.title} className="landing-feature-card" ref={setRevealRef(`feat-${i}`)} style={{ transitionDelay: `${i * 0.08}s` }}>
              <span className="landing-feature-icon">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Projects Section */}
      <section id="work" className="landing-section">
        <div className="landing-section-header" ref={setRevealRef("work-header")}>
          <span className="landing-badge">{content.work.badge}</span>
          <h2>{content.work.title}</h2>
          <p>{content.work.subtitle}</p>
        </div>
        <div className="landing-projects-grid">
          <div className="landing-project-card featured" ref={setRevealRef("proj-navopath")}>
            <div className="landing-project-glare" />
            <div className="landing-project-content">
              <span className="landing-project-version">v0.4.1</span>
              <h3>NavoPath</h3>
              <p>{lang === "en" ? "Time management tool for engineering students. Break down long-term projects into daily execution with AI assistance." : "面向工程学生的时间管理工具。从长期项目拆解到每日执行，AI辅助规划。"}</p>
              <div className="landing-project-tags">
                {techTags.map((t) => <span key={t} className="landing-tag">{t}</span>)}
              </div>
            </div>
          </div>
          {content.work.items.map((p, i) => (
            <div key={p.title} className="landing-project-card" ref={setRevealRef(`proj-${i}`)} style={{ transitionDelay: `${i * 0.08}s` }}>
              <div className="landing-project-stripe" />
              <h3>{p.title}</h3>
              <p>{p.desc}</p>
              <div className="landing-project-tags">
                {p.tags.map((t) => <span key={t} className="landing-tag">{t}</span>)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <section id="contact" className="landing-section landing-footer">
        <div className="landing-section-header" ref={setRevealRef("footer")}>
          <h2>{content.cta.title}</h2>
          <p>{content.cta.subtitle}</p>
          <button
            className="landing-cta-pill primary"
            style={{ marginTop: 24 }}
            onClick={() => { setAuthIntent("signup"); setShowAuth(true); }}
          >{content.cta.button}</button>
        </div>
        <div className="landing-footer-meta">
          <span>{content.footer}</span>
        </div>
      </section>
    </div>
  );
}

function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; opacity: number; radius: number }>>([]);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const animRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    const maxParticles = Math.min(Math.floor((canvas.width * canvas.height) / 18000), 100);
    const particles: typeof particlesRef.current = [];
    for (let i = 0; i < maxParticles; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        opacity: 0.15 + Math.random() * 0.25,
        radius: 0.4 + Math.random() * 0.8,
      });
    }
    particlesRef.current = particles;

    function onMouseMove(e: MouseEvent) {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    }
    window.addEventListener("mousemove", onMouseMove);

    function animate() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        const dx = mx - p.x;
        const dy = my - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        let particleOpacity = p.opacity;
        if (dist < 180) {
          const force = (1 - dist / 180) * 0.3;
          p.vx += dx * force * 0.001;
          p.vy += dy * force * 0.001;
          particleOpacity = Math.min(p.opacity + (1 - dist / 180) * 0.5, 0.9);
        }
        p.vx = Math.max(-0.5, Math.min(0.5, p.vx));
        p.vy = Math.max(-0.5, Math.min(0.5, p.vy));

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(198, 156, 249, ${particleOpacity.toFixed(3)})`;
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const d2 = Math.hypot(p.x - p2.x, p.y - p2.y);
          if (d2 < 120) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(198, 156, 249, ${(0.08 * (1 - d2 / 120)).toFixed(4)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      animRef.current = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="landing-particles" />;
}
