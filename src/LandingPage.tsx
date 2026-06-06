import { useState, useEffect, useRef } from "react";
import { ProductIcon } from "./main";

type AuthIntent = "signin" | "signup";

export default function LandingPage({ onLogin, busy, error }: {
  onLogin: (email: string, password: string, intent: AuthIntent) => void;
  busy: boolean;
  error: string;
}) {
  const [showAuth, setShowAuth] = useState(false);
  const [authIntent, setAuthIntent] = useState<AuthIntent>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
    onLogin(email.trim(), password, authIntent);
  }

  const techTags = ["React", "Vite", "TypeScript", "Electron", "GitHub Actions", "Cloudflare Pages"];

  return (
    <div className="landing">
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
            <a href="#features">Features</a>
            <a href="#work">Projects</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
          </div>
          <div className="landing-nav-actions">
            <button
              className="landing-cta-pill small"
              onClick={() => { setAuthIntent("signin"); setShowAuth(true); }}
            >Log In</button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero-content">
          <h1>
            <span className="hero-name">NavoPath</span>
            <br />
            <span className="hero-tagline">规划路径，执行今天</span>
          </h1>
          <p>从长期项目里选出今天要推进的事，排进时间轴，明确下一步。工程学生的时间管理工具。</p>
          <div className="landing-hero-buttons">
            <button
              className="landing-cta-pill primary"
              onClick={() => { setAuthIntent("signup"); setShowAuth(true); }}
            >Get Started</button>
            <button
              className="landing-cta-pill secondary"
              onClick={() => { setAuthIntent("signin"); setShowAuth(true); }}
            >Sign In</button>
          </div>
        </div>
      </section>

      {/* Auth Modal */}
      {showAuth && (
        <div className="landing-auth-overlay" onClick={() => setShowAuth(false)}>
          <div className="landing-auth-card" onClick={(e) => e.stopPropagation()}>
            <button className="landing-auth-close" onClick={() => setShowAuth(false)}>×</button>
            <div className="landing-auth-tabs">
              <button className={authIntent === "signin" ? "active" : ""} onClick={() => setAuthIntent("signin")}>登录</button>
              <button className={authIntent === "signup" ? "active" : ""} onClick={() => setAuthIntent("signup")}>注册</button>
            </div>
            <form onSubmit={handleAuthSubmit}>
              <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <input type="password" placeholder="Password (6+ chars)" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} maxLength={128} required />
              <button type="submit" disabled={busy} className="landing-cta-pill primary full">
                {busy ? `${authIntent === "signin" ? "登录" : "注册"}中...` : authIntent === "signin" ? "登录" : "注册"}
              </button>
              {error && <p className="landing-auth-error">{error}</p>}
            </form>
            <p className="landing-auth-note">每个账号的数据独立保存。连续注册会触发邮件安全限流。</p>
          </div>
        </div>
      )}

      {/* Features Section */}
      <section id="features" className="landing-section">
        <div className="landing-section-header" ref={setRevealRef("features-header")}>
          <span className="landing-badge">What it does</span>
          <h2>从规划到执行，一步到位</h2>
          <p>NavoPath 帮你把长期项目的复杂任务拆解为每天可执行的行动计划</p>
        </div>
        <div className="landing-features-grid">
          {[
            { title: "项目树规划", desc: "用树形结构组织长期项目，拆解复杂任务为可执行的小步骤", icon: "🌳" },
            { title: "时间轴执行", desc: "拖拽任务到时间轴，精确安排每天的行动计划", icon: "📅" },
            { title: "AI 辅助", desc: "智能规划今天要做什么，基于优先级和截止日自动安排", icon: "🤖" },
            { title: "数据同步", desc: "云端存储，多设备访问，数据安全加密", icon: "☁️" },
          ].map((f, i) => (
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
          <span className="landing-badge">Built on</span>
          <h2>技术栈与开源</h2>
          <p>现代技术栈构建，完全开源，欢迎贡献</p>
        </div>
        <div className="landing-projects-grid">
          <div className="landing-project-card featured" ref={setRevealRef("proj-navopath")}>
            <div className="landing-project-glare" />
            <div className="landing-project-content">
              <span className="landing-project-version">v0.4.1</span>
              <h3>NavoPath</h3>
              <p>面向工程学生的时间管理工具。从长期项目拆解到每日执行，AI辅助规划。</p>
              <div className="landing-project-tags">
                {techTags.map((t) => <span key={t} className="landing-tag">{t}</span>)}
              </div>
            </div>
          </div>
          {[
            { title: "OpenClaw Soul", desc: "AI Agent 自我进化框架，三层记忆架构，目标管理，自主反思", tags: ["TypeScript", "MCP", "记忆架构"] },
            { title: "Water Rocket", desc: "基于 ESP32 的水火箭记录仪，BMP280 传感器 + SD 卡数据采集", tags: ["ESP32", "嵌入式", "传感器"] },
            { title: "XiaoZhi AI", desc: "ESP32-S3 语音助手，串口协议破解，MCP 集成舵机控制", tags: ["硬件黑客", "语音识别", "IoT"] },
          ].map((p, i) => (
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
          <h2>Ready to plan?</h2>
          <p>开始用 NavoPath 管理你的项目和时间。</p>
          <button
            className="landing-cta-pill primary"
            style={{ marginTop: 24 }}
            onClick={() => { setAuthIntent("signup"); setShowAuth(true); }}
          >Get Started</button>
        </div>
        <div className="landing-footer-meta">
          <span>© 2026 NavoPath by 陈潇杨. Built with 🟣</span>
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
