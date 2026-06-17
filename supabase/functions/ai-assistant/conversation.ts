export type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

const CLARIFICATION_RE = /(?:\?|？|请问|告诉我|需要补充|还需要|什么时间|几点|哪天|多久|时长|任务名称|所属项目|确认)/;
const FOLLOW_UP_RE = /^(?:今|明|后天|上午|中午|下午|晚上|早上|凌晨|周[一二三四五六日天]|星期|下周|这周|#|改|对|是|否|不|要|可以|好的|继续|就|它|这个|那个|\d{1,2}\s*(?:[:：点时]|分钟|小时))|(?:\d{1,2}\s*[:：]\s*\d{1,2})/;
const COMPLETE_REQUEST_RE = /^(?:请|帮我|替我|给我)?\s*(?:规划|创建|添加|新建|生成|安排|提醒|查询|查看|写|做|完成|开始)/;

function compact(value: string, max = 500): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function isLikelyFollowUp(message: string, lastAssistant?: string): boolean {
  const text = compact(message, 120);
  if (!text || text.length > 40) return false;
  if (text.length > 12 && COMPLETE_REQUEST_RE.test(text)) return false;
  return FOLLOW_UP_RE.test(text) || Boolean(lastAssistant && CLARIFICATION_RE.test(lastAssistant));
}

/**
 * Convert a short answer to the assistant's clarification into one explicit,
 * self-contained turn. The model still receives the original role messages;
 * this block only makes the unresolved subject deterministic.
 */
export function buildConversationContinuation(
  history: ConversationMessage[],
  latestMessage: string,
): string | null {
  const cleanHistory = history
    .filter((item) => (item.role === "user" || item.role === "assistant") && compact(item.content))
    .map((item) => ({ role: item.role, content: compact(item.content) }));
  const lastAssistant = [...cleanHistory].reverse().find((item) => item.role === "assistant")?.content;
  if (!isLikelyFollowUp(latestMessage, lastAssistant)) return null;

  const originalRequest = [...cleanHistory]
    .reverse()
    .find((item) => item.role === "user" && !isLikelyFollowUp(item.content))?.content;
  if (!originalRequest) return null;

  return [
    "[同一对话的澄清续答]",
    `原始请求：${originalRequest}`,
    lastAssistant ? `助手刚才的问题：${lastAssistant}` : "",
    `用户本轮补充：${compact(latestMessage)}`,
    "请把本轮补充合并到原始请求。不得把时间、日期、时长或项目名本身当作任务标题，也不要再次询问已经给出的信息。",
  ].filter(Boolean).join("\n");
}
