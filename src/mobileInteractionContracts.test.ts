import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const main = readFileSync(resolve(__dirname, "main.tsx"), "utf8");
const mobileCss = readFileSync(resolve(__dirname, "mobile.css"), "utf8");

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

  it("uses the portrait settings switch style in narrow landscape mode", () => {
    expect(mobileCss).toContain("(max-width: 899.98px) and (orientation: portrait),");
    expect(mobileCss).toContain("(max-width: 1180px) and (orientation: landscape)");
    expect(mobileCss).toContain("/* Touch settings use the same system switch in portrait and landscape. */");
  });

  it("keeps the landscape candidate list as the native vertical touch scroller", () => {
    expect(mobileCss).toContain("#root .df-app .df-candidate-list {");
    expect(mobileCss).toContain("touch-action: pan-y !important;");
    expect(mobileCss).toContain("overscroll-behavior-y: contain !important;");
    expect(mobileCss).toContain("#root .df-app .df-candidate-list .df-candidate-task-row {");
  });

  it("resolves the product mark from the Vite base path", () => {
    expect(main).toContain("const PRODUCT_ICON_SRC = `${import.meta.env.BASE_URL}navopath-icon.png`;");
    expect(main).toContain("<img src={PRODUCT_ICON_SRC} alt=\"\" />");
  });

  it("snaps the real task block into timeline slots instead of covering a white target preview", () => {
    expect(main).toContain("function SnappedTimelineDragBlock");
    expect(main).toContain("const timelineSnapActive = Boolean(draggedTask && hoverSlot && !drag?.outsideTimeline);");
    expect(main).toContain("drag.pointer && draggedTask && !timelineSnapActive");
    expect(main).toContain("dragOverlayTask && drag?.source !== \"candidate\" && !timelineSnapActive");
    expect(main).not.toContain("draggingBlock conflict=");
  });
});
