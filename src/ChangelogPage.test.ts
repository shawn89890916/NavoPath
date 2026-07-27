import { describe, expect, it } from "vitest";
import { resolveChangelogLanguage } from "./ChangelogPage";

function createStorage(entries: Record<string, string>) {
  const keys = Object.keys(entries);
  return {
    get length() {
      return keys.length;
    },
    key(index: number) {
      return keys[index] ?? null;
    },
    getItem(key: string) {
      return entries[key] ?? null;
    },
  };
}

describe("resolveChangelogLanguage", () => {
  it("uses an explicit supported query language without reading storage", () => {
    const storage = {
      get length(): number {
        throw new Error("storage unavailable");
      },
      key: () => null,
      getItem: () => null,
    };

    expect(resolveChangelogLanguage("?lang=en", storage, "zh-CN")).toBe("en");
  });

  it("ignores malformed entries and selects the newest valid account cache", () => {
    const storage = createStorage({
      "navopath-bootstrap:broken": "{",
      "navopath-bootstrap:older": JSON.stringify({
        savedAt: "2026-07-01T08:00:00.000Z",
        settings: { language: "en" },
      }),
      "navopath-bootstrap:newer": JSON.stringify({
        savedAt: "2026-07-02T08:00:00.000Z",
        settings: { language: "zh" },
      }),
    });

    expect(resolveChangelogLanguage("", storage, "en-US")).toBe("zh");
  });

  it("uses preview settings when account caches are malformed", () => {
    const storage = createStorage({
      "navopath-bootstrap:broken": "not-json",
      "planner-preview-settings": JSON.stringify({ language: "en" }),
    });

    expect(resolveChangelogLanguage("", storage, "zh-CN")).toBe("en");
  });

  it("falls back to the browser language when storage cannot be read", () => {
    const storage = {
      get length(): number {
        throw new Error("storage unavailable");
      },
      key: () => null,
      getItem: () => {
        throw new Error("storage unavailable");
      },
    };

    expect(resolveChangelogLanguage("", storage, "zh-Hans")).toBe("zh");
    expect(resolveChangelogLanguage("", storage, "fr-FR")).toBe("en");
  });
});
