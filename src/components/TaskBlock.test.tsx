import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  TaskBlockAccent,
  TaskBlockAppearance,
  TaskBlockPriority,
  taskBlockClassNames,
  taskBlockDataAttrs,
  taskBlockStyle,
} from "./TaskBlock";

describe("TaskBlock shared component contract", () => {
  it("builds one stable class contract for variant, appearance, priority, and state combinations", () => {
    expect(taskBlockClassNames({
      variant: "scheduled",
      appearance: "medium",
      priority: "high",
      checked: true,
      selected: true,
      dragging: true,
      className: "df-time-block",
    })).toBe(
      "df-task-block df-task-block--scheduled df-task-block--appearance-medium df-task-block--priority-high is-checked is-selected is-dragging df-time-block"
    );
  });

  it("defaults to calm appearance when none is provided", () => {
    expect(taskBlockClassNames({ variant: "candidate" })).toBe(
      "df-task-block df-task-block--candidate df-task-block--appearance-calm"
    );
  });

  it("exposes shared accent and density variables without hard-coded layout width", () => {
    expect(taskBlockStyle({
      projectColor: "#D7816A",
      density: "compact",
      style: { top: 20, height: 48 },
    })).toEqual({
      "--task-project-color": "#D7816A",
      "--cat": "#D7816A",
      "--task-block-density": "compact",
      top: 20,
      height: 48,
    });
  });

  it("emits data-task-appearance and data-task-variant attributes for CSS mode targeting", () => {
    const attrs = taskBlockDataAttrs({
      variant: "candidate",
      appearance: "medium",
      priority: "urgent",
      checked: true,
      selected: false,
    });
    expect(attrs["data-task-appearance"]).toBe("medium");
    expect(attrs["data-task-variant"]).toBe("candidate");
    expect(attrs["data-task-priority"]).toBe("urgent");
    expect(attrs["data-task-checked"]).toBe("true");
    expect(attrs["data-task-selected"]).toBeUndefined();
  });

  it("keeps the appearance type vocabulary closed to calm | medium | custom", () => {
    const values: TaskBlockAppearance[] = ["calm", "medium", "custom"];
    expect(values).toHaveLength(3);
  });

  it("keeps the priority type vocabulary closed to low | normal | high | urgent", () => {
    const values: TaskBlockPriority[] = ["low", "normal", "high", "urgent"];
    expect(values).toHaveLength(4);
  });

  it("keeps habit child rows on their own variant instead of reusing candidate or generic compact sizing", () => {
    expect(taskBlockClassNames({ variant: "habit-child", appearance: "calm" })).toBe(
      "df-task-block df-task-block--habit-child df-task-block--appearance-calm"
    );
    expect(taskBlockDataAttrs({ variant: "habit-child" })["data-task-variant"]).toBe("habit-child");
  });

  it("declares variant layout isolation rules in the shared stylesheet", () => {
    const css = readFileSync(resolve(__dirname, "../task-block.css"), "utf8");
    expect(css).toContain('[data-task-variant="habit-child"]');
    expect(css).toContain("--task-grid-template: auto minmax(0, 1fr) auto auto;");
    expect(css).toContain("--task-min-height: unset;");
  });

  it("keeps scheduled blocks absolutely positioned so timeline top and height styles remain authoritative", () => {
    const css = readFileSync(resolve(__dirname, "../task-block.css"), "utf8");
    const scheduledRule = css.match(/\.df-app \.df-task-block\[data-task-appearance\]\[data-task-variant="scheduled"\],[\s\S]*?\n}/)?.[0] || "";
    expect(scheduledRule).toContain("position: absolute !important;");
    expect(scheduledRule).not.toContain("height: 100% !important;");
  });

  it("uses a project-color left rule as the shared task annotation across Execute and Planning task surfaces", () => {
    const taskBlockCss = readFileSync(resolve(__dirname, "../task-block.css"), "utf8");
    const appCss = readFileSync(resolve(__dirname, "../app-redesign.css"), "utf8");
    expect(taskBlockCss).toContain("--task-accent-position: left;");
    expect(taskBlockCss).toContain("border-left-color: var(--task-project-color");
    expect(appCss).toContain(".df-kanban-card");
    expect(appCss).toContain("border-left-color: var(--task-project-color");
  });

  it("renders the accent layer with a position modifier", () => {
    expect(TaskBlockAccent({ position: "left" })).toMatchObject({
      props: expect.objectContaining({
        className: "df-task-block-accent df-task-block-accent--left",
      }),
    });
  });
});
