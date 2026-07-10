import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { WidgetSnapshot } from "../types";
import { WidgetView, opacityAction } from "./WidgetApp";

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
  it("renders the simplified accessible panel in stacked layout", () => {
    const html = renderToStaticMarkup(
      <WidgetView
        snapshot={snapshot}
        elapsedSeconds={snapshot.elapsedSeconds}
        layout="stacked"
        panelOpen
        onToggleTimer={() => undefined}
        onTogglePanel={() => undefined}
        onClosePanel={() => undefined}
        onToggleAlwaysOnTop={() => undefined}
        onOpacityChange={() => undefined}
        onResetPosition={() => undefined}
        onCloseWidget={() => undefined}
      />,
    );

    expect(html).toContain('data-layout="stacked"');
    expect(html).toContain('aria-label="Widget controls"');
    expect(html).toContain("Always on top");
    expect(html).toContain("Opacity");
    expect(html).toContain("Reset position");
    expect(html).toContain("Close widget");
    expect(html).not.toContain('role="menu"');
    expect(html).not.toContain("Background color");
  });

  it("normalizes opacity updates into a widget action", () => {
    expect(opacityAction(2)).toEqual({ type: "updateAppearance", patch: { opacity: 1 } });
    expect(opacityAction(0.72)).toEqual({ type: "updateAppearance", patch: { opacity: 0.72 } });
  });

  it("keeps touch targets and rounded paper edges in the scoped stylesheet", () => {
    const css = readFileSync(new URL("./widget.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.df-widget-icon-btn[\s\S]*min-width:\s*44px/);
    expect(css).toMatch(/\.df-widget-panel-action[\s\S]*min-height:\s*44px/);
    expect(css).toMatch(/\.df-widget-card[\s\S]*border-radius:\s*16px/);
    expect(css).toMatch(/\.df-widget-panel[\s\S]*border-radius:\s*12px/);
    expect(css).toContain("-webkit-app-region: no-drag");
  });
});
