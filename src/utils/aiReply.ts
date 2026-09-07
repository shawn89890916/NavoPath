type AgentEnvelope = Record<string, unknown>;

function isEscapedMarkdown(value: string) {
  const escapedBreaks = value.match(/(?<!\\)\\(?:r\\)?n/g)?.length || 0;
  const lineBreaks = value.match(/\r?\n/g)?.length || 0;
  return escapedBreaks >= 2 && lineBreaks === 0;
}

function isAgentEnvelope(value: unknown): value is AgentEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const envelope = value as AgentEnvelope;
  return typeof envelope.format === "string"
    && (Array.isArray(envelope.steps) || Array.isArray(envelope.commands) || Array.isArray(envelope.memories));
}

function removeTrailingAgentEnvelope(value: string) {
  for (let start = value.lastIndexOf("{"); start >= 0; start = value.lastIndexOf("{", start - 1)) {
    const prefix = value.slice(0, start);
    if (!/\n\s*$/.test(prefix)) continue;
    try {
      if (isAgentEnvelope(JSON.parse(value.slice(start).trim()))) return prefix.trimEnd();
    } catch {
      // Continue searching for the start of a complete trailing JSON object.
    }
  }
  return value;
}

function removeLeakedProtocol(value: string) {
  const protocol = value.search(/\{\s*["']kind["']\s*:\s*["'](?:tool_calls|final)["']/);
  if (protocol < 0) return value;
  const prefix = value.slice(0, protocol).trim();
  return prefix || (value.includes('"tool_calls"') ? "正在整理工作区信息。" : value);
}

/** Makes provider replies safe to display when a model leaks its final protocol envelope. */
export function normalizeAiReply(value: string) {
  const decoded = isEscapedMarkdown(value)
    ? value.replace(/(?<!\\)\\(?:r\\)?n/g, "\n")
    : value;
  return removeLeakedProtocol(removeTrailingAgentEnvelope(decoded)).trim();
}
