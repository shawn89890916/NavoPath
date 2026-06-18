import changelog from "../CHANGELOG.md?raw";
import "./changelog.css";

type Block = { type: "h1" | "h2" | "h3" | "li" | "p"; text: string };

function parseMarkdown(source: string): Block[] {
  return source.split(/\r?\n/).flatMap((line): Block[] => {
    const value = line.trim();
    if (!value) return [];
    if (value.startsWith("### ")) return [{ type: "h3", text: value.slice(4) }];
    if (value.startsWith("## ")) return [{ type: "h2", text: value.slice(3) }];
    if (value.startsWith("# ")) return [{ type: "h1", text: value.slice(2) }];
    if (value.startsWith("- ")) return [{ type: "li", text: value.slice(2) }];
    return [{ type: "p", text: value }];
  });
}

export default function ChangelogPage() {
  const blocks = parseMarkdown(changelog);
  return <main className="np-changelog">
    <nav><a href="/">← 返回 NavoPath</a><span>RELEASE NOTES</span></nav>
    <article>{blocks.map((block, index) => {
      if (block.type === "h1") return <h1 key={index}>{block.text}</h1>;
      if (block.type === "h2") return <h2 key={index}>{block.text}</h2>;
      if (block.type === "h3") return <h3 key={index}>{block.text}</h3>;
      if (block.type === "li") return <p className="entry" key={index}>{block.text}</p>;
      return <p key={index}>{block.text}</p>;
    })}</article>
  </main>;
}
