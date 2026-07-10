import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { WidgetSnapshot } from "../types";
import { WidgetPopoverView, WidgetView, opacityAction } from "./WidgetApp";

const snapshot: WidgetSnapshot = {
  taskId: "task-1",
  taskTitle: "Write a long application essay title",
  taskProjectColor: "#D7816A",
  elapsedSeconds: 125,
  timerRunning: true,
  candidateCount: 3,
  lang: "en",
  alwaysOnTop: true,
  appearanceConfigured: true,
  appearance: {
    backgroundColor: "#FBF9FF",
    fontColor: "#27231E",
    accentColor: "#27231E",
    opacity: 0.96,
    version: 1,
  },
};

describe("WidgetView", () => {
  it("keeps settings out of the compact surface and renders them in the popover", () => {
    const mainHtml = renderToStaticMarkup(
      <WidgetView
        snapshot={snapshot}
        elapsedSeconds={snapshot.elapsedSeconds}
        layout="stacked"
        onToggleTimer={() => undefined}
        onTogglePopover={() => undefined}
      />,
    );
    const popoverHtml = renderToStaticMarkup(
      <WidgetPopoverView
        snapshot={snapshot}
        onToggleAlwaysOnTop={() => undefined}
        onOpacityChange={() => undefined}
        onResetPosition={() => undefined}
        onCloseWidget={() => undefined}
      />,
    );

    expect(mainHtml).toContain('data-layout="stacked"');
    expect(mainHtml).toContain("Working");
    expect(mainHtml).toContain('aria-haspopup="dialog"');
    expect(mainHtml).not.toContain("Always on top");
    expect(mainHtml).not.toContain("df-widget-accent-line");

    expect(popoverHtml).toContain("Always on top");
    expect(popoverHtml).toContain('role="dialog"');
    expect(popoverHtml).toContain('autofocus=""');
    expect(popoverHtml).toContain("Background opacity");
    expect(popoverHtml).toContain('min="0"');
    expect(popoverHtml).toContain('max="1"');
    expect(popoverHtml).toContain("Reset position");
    expect(popoverHtml).toContain("Close widget");
  });

  it("normalizes opacity updates into a widget action", () => {
    expect(opacityAction(2)).toEqual({ type: "updateAppearance", patch: { opacity: 1 } });
    expect(opacityAction(-1)).toEqual({ type: "updateAppearance", patch: { opacity: 0 } });
    expect(opacityAction(0.72)).toEqual({ type: "updateAppearance", patch: { opacity: 0.72 } });
  });

  it("restores and periodically persists widget bounds while mounted", () => {
    const source = readFileSync(new URL("./WidgetApp.tsx", import.meta.url), "utf8");
    expect(source).toContain('const WIDGET_BOUNDS_KEY = "navopath-widget-bounds"');
    expect(source).toMatch(/restoreStoredWidgetBounds\(raw\)[\s\S]*?setBounds\(restored\)/);
    expect(source).not.toContain("getWorkArea()");
    expect(source).toMatch(/setInterval\([\s\S]*?getBounds\(\)[\s\S]*?localStorage\.setItem\(WIDGET_BOUNDS_KEY[\s\S]*?1200/);
  });

  it("keeps opacity on the paper shell and establishes the compact hierarchy", () => {
    const css = readFileSync(new URL("./widget.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.df-widget-root\s*\{[\s\S]*?padding:\s*6px[\s\S]*?-webkit-app-region:\s*no-drag/);
    expect(css).toMatch(/\.df-widget-card::before\s*\{[\s\S]*?opacity:\s*var\(--widget-opacity\)/);
    expect(css).toMatch(/\.df-widget-card\s*>\s*\*\s*\{[\s\S]*?z-index:\s*1/);
    expect(css).toMatch(/\.df-widget-status\s*\{[\s\S]*?color:\s*var\(--widget-muted\)[\s\S]*?font-size:\s*clamp\(11px,/);
    expect(css).toMatch(/\.df-widget-task-title\s*\{[\s\S]*?font-size:\s*clamp\(18px,/);
    expect(css).toMatch(/\.df-widget-timer\s*\{[\s\S]*?font:\s*750\s+clamp\(18px,/);
    expect(css).toMatch(/\.df-widget-icon-btn[\s\S]*min-width:\s*44px/);
    expect(css).toMatch(/\.df-widget-popover-action[\s\S]*min-height:\s*44px/);
    expect(css).toMatch(/\.df-widget-card[\s\S]*border-radius:\s*16px/);
    expect(css).toMatch(/\.df-widget-popover-surface[\s\S]*border-radius:\s*12px/);
    expect(css).not.toContain(".df-widget-accent-line");
  });
});
