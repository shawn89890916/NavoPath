function parseStructuredReply(value: string): Record<string, unknown> | null {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  if (!candidate.startsWith("{") || !candidate.endsWith("}")) return null;
  try {
    const parsed = JSON.parse(candidate);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

/** Unwrap only a complete JSON object (optionally inside one JSON fence). */
export function unwrapReplyLayers(reply: string): string {
  let current = reply;
  for (let i = 0; i < 8; i += 1) {
    const parsed = parseStructuredReply(current);
    if (!parsed || typeof parsed.reply !== "string" || parsed.reply === current.trim()) return current;
    current = parsed.reply;
  }
  return current;
}
