import { describe, expect, it } from "vitest";
import { normalizeAiReply } from "./aiReply";

describe("normalizeAiReply", () => {
  it("formats escaped Markdown and removes a leaked final protocol envelope", () => {
    const reply = "## 三项优先级\\n1. 完成 AP 物理\\n\\n> 简报为只读生成。\\n\\n{\"format\":\"markdown\",\"steps\":[{\"label\":\"读取工作区\",\"status\":\"done\"}],\"commands\":[],\"memories\":[]}";

    expect(normalizeAiReply(reply)).toBe("## 三项优先级\n1. 完成 AP 物理\n\n> 简报为只读生成。");
  });

  it("keeps ordinary single escaped sequences unchanged", () => {
    expect(normalizeAiReply("Use \\n in this code example.")).toBe("Use \\n in this code example.");
  });
});
