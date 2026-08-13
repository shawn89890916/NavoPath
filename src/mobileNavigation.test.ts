import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const mainSource = readFileSync(new URL("./main.tsx", import.meta.url), "utf8");
const mobileStyles = readFileSync(new URL("./mobile.css", import.meta.url), "utf8");

describe("portrait mobile navigation", () => {
  it("uses the dock's left slot for AI and a separate floating task action", () => {
    expect(mainSource).toContain('className="df-mobile-dock-action df-mobile-ai"');
    expect(mainSource).toContain('className="df-mobile-quick-add-fab"');
    expect(mainSource).not.toContain('className="df-candidate-quick-add-top"');
  });

  it("keeps AI and Settings in dismissible task-detail-sized sheets", () => {
    expect(mobileStyles).toContain("#root .df-app .df-ai-panel-reference,");
    expect(mobileStyles).toContain("#root .df-app .df-utility-panel {");
    expect(mobileStyles).toContain("inset: 4dvh 0 0 !important;");
    expect(mobileStyles).toContain("border-radius: 18px 18px 0 0 !important;");
  });

  it("uses an iOS-sized switch while keeping the active theme accent", () => {
    expect(mobileStyles).toContain("width: 51px !important;");
    expect(mobileStyles).toContain("height: 31px !important;");
    expect(mobileStyles).toContain("background: var(--accent-active) !important;");
  });
});
