import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const main = readFileSync(resolve(__dirname, "main.tsx"), "utf8");

describe("portrait interaction contracts", () => {
  it("opens the task short sheet on the second tap after selection", () => {
    expect(main).toContain("function selectTimelineTask(task: Task)");
    expect(main).toContain("if (resizeHintTaskId === taskId)");
    expect(main).toContain("openTaskEdit(task);");
    expect(main).toContain("onSelect={() => selectTimelineTask(task)}");
  });

  it("keeps returned-unfinished timeline records resizable", () => {
    expect(main).toContain("const canResize = !isExternalEvent && (isEvent || !recurringLocked);");
    expect(main).not.toContain("const canResize = !isExternalEvent && !isReturnedUnfinished");
  });

  it("uses the task-detail language for quick-add More with a start/end range", () => {
    expect(main).toContain("quickAddDetail={quickAddDetailOpen}");
    expect(main).toContain('className="df-drawer df-task-detail df-quick-add-detail"');
    expect(main).toContain('className="df-detail-time-range"');
  });

  it("dismisses the AI plus menu outside and omits hardware sync", () => {
    expect(main).toContain('document.addEventListener("pointerdown", closeComposerMenu)');
    expect(main).not.toContain("同步硬件");
    expect(main).not.toContain("Sync hardware");
  });
});
