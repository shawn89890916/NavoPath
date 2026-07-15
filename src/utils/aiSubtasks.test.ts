import { describe, expect, it } from "vitest";
import { appendAiSubtasks } from "./aiSubtasks";

describe("appendAiSubtasks", () => {
  it("turns AI suggestions into visible subtasks while preserving existing rows", () => {
    let index = 0;
    const result = appendAiSubtasks(
      [{ id: "existing", title: "收集资料", completed: false, createdAt: "earlier" }],
      [{ title: "  列出提纲  " }, { title: "收集资料" }, { title: "" }],
      () => `ai-${++index}`,
      "now",
    );

    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({ id: "ai-1", title: "列出提纲", completed: false, done: false, createdAt: "now" });
  });
});
