import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AI module deployment safety", () => {
  it("loads the AI client with the main application instead of on first send", () => {
    const source = readFileSync("src/main.tsx", "utf8");
    expect(source).toContain('import { callAiAssistant,');
    expect(source).not.toContain('import("./aiAssistantApi")');
  });

  it("requires deployed JavaScript and HTML to revalidate their versions", () => {
    const headers = readFileSync("public/_headers", "utf8");
    expect(headers).toMatch(/\/assets\/\*\.js\s+Cache-Control: public, max-age=0, must-revalidate/);
    expect(headers).toMatch(/\/\*\s+Cache-Control: public, max-age=0, must-revalidate/);
  });
});
