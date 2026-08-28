export type ManifestEntry = {
  hash: string;
  mtime: number;
  size: number;
};

export type BridgeManifest = Record<string, ManifestEntry>;

export type DetectedChange = {
  path: string;
  changeType: "created" | "modified" | "deleted";
  previous?: ManifestEntry;
  current?: ManifestEntry;
};

const SCHEDULE_LINE = /(?:\b(?:due|deadline|submit|submission|exam|test|interview|schedule|todo)\b|截止|提交|考试|模考|面试|申请|日期|时间|待办|计划|ddl|\b20\d{2}[-/.年]\d{1,2}(?:[-/.月]\d{1,2}日?)?|\b\d{1,2}:\d{2}\b|- \[ \])/i;

export function normalizeVaultPath(path: string) {
  return path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

export function isPathWatched(path: string, watchedRoot: string) {
  const normalizedPath = normalizeVaultPath(path);
  const normalizedRoot = normalizeVaultPath(watchedRoot);
  return Boolean(normalizedRoot) && (normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`));
}

export function detectManifestChanges(previous: BridgeManifest, current: BridgeManifest): DetectedChange[] {
  const paths = new Set([...Object.keys(previous), ...Object.keys(current)]);
  const changes: DetectedChange[] = [];
  for (const path of [...paths].sort()) {
    const before = previous[path];
    const after = current[path];
    if (!after && before) changes.push({ path, changeType: "deleted", previous: before });
    else if (after && !before) changes.push({ path, changeType: "created", current: after });
    if (after && before && (after.hash !== before.hash || after.size !== before.size)) {
      changes.push({ path, changeType: "modified", previous: before, current: after });
    }
  }
  return changes;
}

export function schedulingExcerpt(content: string, maxChars = 3600) {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const selected: string[] = [];
  if (lines[0]?.trim() === "---") {
    const closing = lines.slice(1, 80).findIndex((line) => line.trim() === "---");
    if (closing >= 0) selected.push(...lines.slice(0, closing + 2));
  }
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && SCHEDULE_LINE.test(trimmed) && !selected.includes(line)) selected.push(line);
    if (selected.join("\n").length >= maxChars) break;
  }
  const excerpt = selected.length ? selected.join("\n") : normalized.slice(0, Math.min(800, maxChars));
  return excerpt.slice(0, maxChars).trim();
}

export async function sha256Hex(value: string | ArrayBuffer) {
  const input = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function eventDedupeKey(changes: DetectedChange[]) {
  const canonical = changes
    .map((change) => `${change.changeType}:${normalizeVaultPath(change.path)}:${change.current?.hash || change.previous?.hash || "none"}:${change.current?.mtime || change.previous?.mtime || 0}`)
    .sort()
    .join("\n");
  return `obsidian-${await sha256Hex(canonical)}`;
}
