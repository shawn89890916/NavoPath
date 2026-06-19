import fs from "node:fs";

const path = new URL("../CHANGELOG.md", import.meta.url);
const checkOnly = process.argv.includes("--check");
const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
const source = fs.readFileSync(path, "utf8").replace(/\r\n/g, "\n");

if (source.includes("�") || /鏇存柊|鏂板姛|浠诲姟/.test(source)) {
  throw new Error("CHANGELOG.md contains mojibake and must be repaired before delivery.");
}
if ((source.match(new RegExp(`^## ${date}\\b`, "gm")) || []).length !== 2) {
  throw new Error(`CHANGELOG.md must contain mirrored Chinese and English entries for ${date}.`);
}

const compact = source
  .split("\n")
  .filter((line, index, lines) => !line.startsWith("- ") || line !== lines[index - 1])
  .join("\n")
  .replace(/\n{3,}/g, "\n\n")
  .trimEnd() + "\n";

if (checkOnly && compact !== source) throw new Error("Run changelog-maintain.mjs to compact duplicate or excess whitespace.");
if (!checkOnly) fs.writeFileSync(path, compact, "utf8");
