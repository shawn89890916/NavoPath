import { useEffect, useState } from "react";
import changelog from "../CHANGELOG.md?raw";
import type { Language } from "./types";
import "./changelog.css";

type Block = { type: "h1" | "h2" | "h3" | "li" | "p"; text: string };

function parseMarkdown(source: string): Block[] {
  return source.split(/\r?\n/).flatMap((line): Block[] => {
    const value = line.trim();
    if (!value) return [];
    if (value.startsWith("### ")) return [{ type: "h3", text: value.slice(4) }];
    if (value.startsWith("## ")) return [{ type: "h2", text: value.slice(3) }];
    if (value.startsWith("# ")) return [{ type: "h1", text: value.slice(2) }];
    if (value.startsWith("- ")) return [{ type: "li", text: value.slice(2) }];
    return [{ type: "p", text: value }];
  });
}

function accountLanguage(): Language {
  try {
    const requested = new URLSearchParams(window.location.search).get("lang");
    if (requested === "zh" || requested === "en") return requested;
    const cached = Object.keys(localStorage)
      .filter((key) => key.startsWith("navopath-bootstrap:"))
      .map((key) => JSON.parse(localStorage.getItem(key) || "null"))
      .filter((value) => value?.settings?.language === "zh" || value?.settings?.language === "en")
      .sort((a, b) => String(b.savedAt || "").localeCompare(String(a.savedAt || "")))[0];
    if (cached) return cached.settings.language;
    const preview = JSON.parse(localStorage.getItem("planner-preview-settings") || "null");
    if (preview?.language === "zh" || preview?.language === "en") return preview.language;
  } catch {
    // Fall through to the browser language when storage is unavailable.
  }
  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function localizedSource(language: Language) {
  const englishHeading = "# NavoPath Changelog";
  const englishStart = changelog.indexOf(englishHeading);
  if (englishStart === -1) return changelog;
  return language === "zh" ? changelog.slice(0, englishStart).trim() : changelog.slice(englishStart).trim();
}

export default function ChangelogPage() {
  const [language, setLanguage] = useState<Language>(accountLanguage);
  const blocks = parseMarkdown(localizedSource(language));

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language]);

  return <main className="np-changelog">
    <nav>
      <a href="/">&larr; {language === "zh" ? "返回 NavoPath" : "Back to NavoPath"}</a>
      <div className="np-changelog-tools">
        <span>{language === "zh" ? "更新日志" : "RELEASE NOTES"}</span>
        <div className="np-changelog-language" aria-label={language === "zh" ? "更新日志语言" : "Changelog language"}>
          <button type="button" className={language === "zh" ? "active" : ""} aria-pressed={language === "zh"} onClick={() => setLanguage("zh")}>中文</button>
          <button type="button" className={language === "en" ? "active" : ""} aria-pressed={language === "en"} onClick={() => setLanguage("en")}>EN</button>
        </div>
      </div>
    </nav>
    <article>{blocks.map((block, index) => {
      if (block.type === "h1") return <h1 key={index}>{block.text}</h1>;
      if (block.type === "h2") return <h2 key={index}>{block.text}</h2>;
      if (block.type === "h3") return <h3 key={index}>{block.text}</h3>;
      if (block.type === "li") return <p className="entry" key={index}>{block.text}</p>;
      return <p key={index}>{block.text}</p>;
    })}</article>
  </main>;
}
