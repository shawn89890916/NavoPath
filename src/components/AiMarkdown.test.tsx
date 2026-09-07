import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it } from "vitest";
import AiMarkdown, { safeMarkdownUrl } from "./AiMarkdown";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function render(markdown: string) {
  let tree!: ReactTestRenderer;
  act(() => { tree = create(<AiMarkdown>{markdown}</AiMarkdown>); });
  return tree;
}

describe("AiMarkdown", () => {
  it("renders headings, lists, tables, task lists, quotes, inline code, and fenced code", () => {
    const tree = render("# 标题\n\n- 列表\n- [x] 完成\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n> 引用\n\n使用 `inline`。\n\n```ts\nconst ok = true\n```");
    expect(tree.root.findAllByType("h1")).toHaveLength(1);
    expect(tree.root.findAllByType("ul")).toHaveLength(1);
    expect(tree.root.findAllByType("table")).toHaveLength(1);
    expect(tree.root.findAllByType("blockquote")).toHaveLength(1);
    expect(tree.root.findAllByType("input").some((node) => node.props.type === "checkbox" && node.props.checked === true)).toBe(true);
    expect(tree.root.findAllByType("button").some((node) => node.children.includes("复制"))).toBe(true);
    expect(tree.root.findAllByType("code").some((node) => node.children.join("").includes("const ok"))).toBe(true);
  });

  it("drops raw HTML and dangerous link protocols", () => {
    const tree = render("<script>alert(1)</script>\n\n[安全](https://example.com) [危险](javascript:alert(1))");
    expect(tree.root.findAllByType("script")).toHaveLength(0);
    const links = tree.root.findAllByType("a");
    expect(links[0].props.href).toBe("https://example.com");
    expect(links[0].props.target).toBe("_blank");
    expect(links[0].props.rel).toBe("noopener noreferrer");
    expect(links[1].props.href).toBe("");
  });

  it("keeps safe links and removes dangerous protocols", () => {
    expect(safeMarkdownUrl("https://example.com/guide")).toBe("https://example.com/guide");
    expect(safeMarkdownUrl("mailto:hello@example.com")).toBe("mailto:hello@example.com");
    expect(safeMarkdownUrl("javascript:alert(1)")).toBe("");
    expect(safeMarkdownUrl("data:text/html,hello")).toBe("");
  });

  it("renders escaped agent Markdown without its trailing protocol envelope", () => {
    const tree = render("## 今日重点\\n1. 完成练习\\n\\n{\"format\":\"markdown\",\"steps\":[],\"commands\":[],\"memories\":[]}");
    expect(tree.root.findAllByType("h2")).toHaveLength(1);
    expect(tree.root.findAllByType("li")).toHaveLength(1);
    expect(JSON.stringify(tree.toJSON())).not.toContain("commands");
  });
});
