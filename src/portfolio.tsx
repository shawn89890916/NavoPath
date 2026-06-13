import { useState } from "react";
import { createRoot } from "react-dom/client";
import "./portfolio.css";

type Lang = "en" | "zh";

const projects = [
  { number: "01", title: "NavoPath", type: "Product · React · Electron", desc: "A planning system that connects long-term project structure with realistic daily execution.", featured: true, href: "https://navopath-xiaoyang.pages.dev" },
  { number: "02", title: "Water Rocket Data Logger", type: "Arduino · BMP280 · 3D Printing", desc: "A real-time altitude and pressure logging system paired with a four-point parachute deployment mechanism." },
  { number: "03", title: "XiaoZhi AI Voice Assistant", type: "ESP32-S3 · Protocol Hacking · MCP", desc: "A local voice assistant with reverse-engineered serial communication and physical servo control." },
  { number: "04", title: "JOLI SPORTS Research", type: "Python · K-means · Data Analysis", desc: "An English research paper analyzing sports consumer behavior through clustering and data mining." },
];

function Arrow() { return <svg viewBox="0 0 24 24"><path d="M5 19 19 5M9 5h10v10" /></svg>; }

function Portfolio() {
  const [lang, setLang] = useState<Lang>("en");
  const zh = lang === "zh";
  return <div className="portfolio">
    <nav className="portfolio-nav">
      <a href="#top" className="portfolio-mark">XC<span>×</span>26</a>
      <div><a href="#about">{zh ? "关于" : "About"}</a><a href="#projects">{zh ? "项目" : "Projects"}</a><a href="#contact">{zh ? "联系" : "Contact"}</a></div>
      <button onClick={() => setLang(zh ? "en" : "zh")}>{zh ? "EN" : "中"}</button>
    </nav>

    <main>
      <section className="portfolio-hero" id="top">
        <div className="portfolio-hero-grid">
          <span className="portfolio-index">01 / 04</span>
          <p className="portfolio-intro">{zh ? "学生、工程师、创造者。来自浙江瑞安，目标是用工程把想法变成真实可用的东西。" : "Student, engineer, and builder from Rui'an, Zhejiang. I use engineering to turn ideas into things that work."}</p>
          <h1>Xiaoyang<br /><em>Chen.</em></h1>
          <div className="portfolio-status"><i /><span>{zh ? "正在构建 NavoPath" : "Currently building NavoPath"}</span></div>
          <a className="portfolio-primary-link" href="https://navopath-xiaoyang.pages.dev">Explore NavoPath <Arrow /></a>
        </div>
        <div className="portfolio-marquee"><span>ENGINEERING · PRODUCTS · HARDWARE · RESEARCH · ENGINEERING · PRODUCTS · HARDWARE · RESEARCH ·</span></div>
      </section>

      <section className="portfolio-section portfolio-about" id="about">
        <header><span>02 / About</span><h2>{zh ? "我喜欢理解系统，尤其喜欢亲手把它们做出来。" : "I like understanding systems. I like building them even more."}</h2></header>
        <div className="portfolio-about-grid">
          <p>{zh ? "从软件产品到嵌入式硬件，再到模型航空和数据研究，我关注的是如何把模糊的问题转化为可以测试、迭代和使用的方案。" : "From software products and embedded hardware to model aviation and data research, I focus on turning ambiguous problems into testable, iterative, useful systems."}</p>
          <dl><div><dt>Based in</dt><dd>Rui'an, Zhejiang</dd></div><div><dt>Focus</dt><dd>Engineering & Product</dd></div><div><dt>Education</dt><dd>Rui'an High School</dd></div><div><dt>Next</dt><dd>Cambridge · Imperial · UCL</dd></div></dl>
        </div>
      </section>

      <section className="portfolio-section" id="projects">
        <header><span>03 / Selected work</span><h2>{zh ? "选择的项目" : "Selected projects"}</h2></header>
        <div className="portfolio-projects">
          {projects.map((project) => <article className={project.featured ? "featured" : ""} key={project.title}>
            <span>{project.number}</span><div><small>{project.type}</small><h3>{project.title}</h3><p>{project.desc}</p></div>
            {project.href ? <a href={project.href} aria-label={`Open ${project.title}`}><Arrow /></a> : <i />}
          </article>)}
        </div>
      </section>

      <section className="portfolio-contact" id="contact">
        <span>04 / Contact</span>
        <h2>{zh ? "讨论工程，或者一起构建点什么。" : "Let's talk engineering, or build something together."}</h2>
        <div><a href="mailto:shawn89890916@163.com">shawn89890916@163.com <Arrow /></a><a href="https://github.com/shawn89890916">GitHub <Arrow /></a></div>
      </section>
    </main>
    <footer><span>© 2026 Xiaoyang Chen</span><a href="#top">Back to top ↑</a></footer>
  </div>;
}

createRoot(document.getElementById("root")!).render(<Portfolio />);
