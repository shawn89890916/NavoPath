import { useEffect, useState } from "react";
import changelog from "../CHANGELOG.md?raw";
import type { Language } from "./types";
import "./changelog.css";

type Block = { type: "h1" | "h2" | "h3" | "li" | "p"; text: string };
type LanguageStorage = Pick<Storage, "getItem" | "key" | "length">;
type StoredLanguage = { language: Language; savedAt: string };

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

function parseStoredObject(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

export function resolveChangelogLanguage(
  search: string,
  storage: LanguageStorage,
  browserLanguage: string,
): Language {
  const requested = new URLSearchParams(search).get("lang");
  if (requested === "zh" || requested === "en") return requested;

  const cached: StoredLanguage[] = [];
  let storageLength = 0;
  try {
    storageLength = storage.length;
  } catch {
    // Continue to the browser-language fallback when storage is unavailable.
  }
  for (let index = 0; index < storageLength; index += 1) {
    try {
      const key = storage.key(index);
      if (!key?.startsWith("navopath-bootstrap:")) continue;
      const value = parseStoredObject(storage.getItem(key));
      const settings = value?.settings;
      if (!settings || typeof settings !== "object" || Array.isArray(settings)) continue;
      const language = (settings as Record<string, unknown>).language;
      if (language !== "zh" && language !== "en") continue;
      cached.push({
        language,
        savedAt: typeof value.savedAt === "string" ? value.savedAt : "",
      });
    } catch {
      // One unreadable cache entry must not hide the other accounts.
    }
  }
  cached.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  if (cached[0]) return cached[0].language;

  try {
    const preview = parseStoredObject(storage.getItem("planner-preview-settings"));
    if (preview?.language === "zh" || preview?.language === "en") return preview.language;
  } catch {
    // Fall through to the browser language when storage is unavailable.
  }
  return browserLanguage.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function accountLanguage(): Language {
  try {
    return resolveChangelogLanguage(window.location.search, localStorage, navigator.language);
  } catch {
    return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
  }
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
