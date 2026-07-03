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

  it("uses a project-color left rule in the shared TaskBlock stylesheet", () => {
    const taskBlockCss = readFileSync(resolve(__dirname, "../task-block.css"), "utf8");
    expect(taskBlockCss).toContain("--task-accent-position: left;");
    expect(taskBlockCss).toContain("border-left-color: var(--task-project-color");
  });

  it("keeps candidate content vertically centered while allowing long titles to wrap left-aligned", () => {
    const css = readFileSync(resolve(__dirname, "../task-block.css"), "utf8");
    const contentRule = css.match(/Content[\s\S]*?\.df-app \.df-task-block\[data-task-appearance\] \.df-task-block-main[\s\S]*?\n}/)?.[0] || "";
    const titleRule = css.match(/Title[\s\S]*?\.df-app \.df-task-block\[data-task-appearance\] \.df-task-block-title[\s\S]*?\n}/)?.[0] || "";
    const actionsRule = css.match(/Actions[\s\S]*?\.df-app \.df-task-block\[data-task-appearance\] \.df-task-actions[\s\S]*?\n}/)?.[0] || "";

    expect(contentRule).toContain("justify-content: center;");
    expect(contentRule).toContain("align-self: stretch;");
    expect(titleRule).toContain("line-height: 1.35;");
    expect(titleRule).toContain("text-align: left;");
    expect(titleRule).toContain("overflow-wrap: anywhere;");
    expect(titleRule).toContain("word-break: break-word;");
    expect(titleRule).toContain("white-space: normal;");
    expect(actionsRule).toContain("align-self: center;");
    expect(actionsRule).toContain("flex-shrink: 0;");
  });

  it("keeps Planning task-like surfaces on TaskBlock instead of CSS-only legacy card systems", () => {
    const planning = readFileSync(resolve(__dirname, "../PlanningView.tsx"), "utf8");
    const css = readFileSync(resolve(__dirname, "../app-redesign.css"), "utf8");

    expect(planning).toContain('variant="planning"');
    expect(planning).toContain('variant="compact"');
    expect(planning).toContain('variant="habit-child"');
    expect(planning).not.toContain("<article");
    expect(css).not.toContain("Canonical Planning task blocks: Today Candidate style wins over legacy Planning cards.");
    expect(css).not.toMatch(/\.df-app\.mode-planning[\s\S]*?\.df-kanban-card[\s\S]*?grid-template-columns: auto minmax\(0, 1fr\) auto auto;/);
  });

  it("keeps completed task blocks free of full-card opacity and overlay masks", () => {
    const css = readFileSync(resolve(__dirname, "../task-block.css"), "utf8");
    const completedRule = css.match(/Completed[\s\S]*?\.df-app \.df-task-block\[data-task-appearance\]\.is-checked[\s\S]*?\n}/)?.[0] || "";

    expect(completedRule).toContain("opacity: 1;");
    expect(completedRule).not.toContain("opacity: .");
    expect(css).not.toMatch(/\.df-task-block[\s\S]*?::(?:before|after)[\s\S]*?background:\s*(?:gray|grey|rgba\(128|#ccc|#d)/i);
  });

  it("renders the accent layer with a position modifier", () => {
    expect(TaskBlockAccent({ position: "left" })).toMatchObject({
      props: expect.objectContaining({
        className: "df-task-block-accent df-task-block-accent--left",
      }),
    });
  });

  it("keeps Planning tree controls in the left sidebar with compact tree rows and no task left strip", () => {
    const planning = readFileSync(resolve(__dirname, "../PlanningView.tsx"), "utf8");
    const css = readFileSync(resolve(__dirname, "../app-redesign.css"), "utf8");

    expect(planning).toContain('className="df-planning-sidebar"');
    expect(planning).toMatch(/<aside className="df-planning-sidebar"[\s\S]*df-planning-filter-menu[\s\S]*df-planning-view-switch[\s\S]*<\/aside>/);
    expect(css).toContain(".df-planning-sidebar");
    expect(css).toContain("left: 0 !important;");
    expect(css).toContain(".df-app.mode-planning .df-tree .df-task-block[data-task-variant=\"planning\"]");
    expect(css).toContain("--task-project-accent-size: 0px;");
    expect(css).toContain(".df-category-branch");
    expect(css).toContain("margin-bottom: 28px !important;");
  });
});
