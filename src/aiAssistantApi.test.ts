import { beforeEach, describe, expect, it, vi } from "vitest";
import { aiGatewayUrl, FALLBACK_AI_MODELS, invokeAiAssistant, listAiModels } from "./aiAssistantApi";

beforeEach(() => {
  vi.stubGlobal("window", { setTimeout, clearTimeout });
});

describe("AI assistant client", () => {
  it("routes production AI requests through the NavoPath origin", () => {
    expect(aiGatewayUrl(
      "https://project.supabase.co/functions/v1/ai-assistant",
      "https://navopath.com/app",
      "https://project.supabase.co",
    )).toBe("https://navopath.com/api/supabase/functions/v1/ai-assistant");
    expect(aiGatewayUrl(
      "https://project.supabase.co/functions/v1/ai-assistant",
      "http://127.0.0.1:5173/app",
      "https://project.supabase.co",
    )).toBe("https://project.supabase.co/functions/v1/ai-assistant");
  });

  it("exposes the current curated model catalog without retired models", async () => {
    const models = await listAiModels();
    expect(new Set(models)).toEqual(new Set(FALLBACK_AI_MODELS));
    expect(FALLBACK_AI_MODELS).toContain("deepseek-ai/DeepSeek-V4-Flash");
    expect(FALLBACK_AI_MODELS).not.toContain("deepseek-ai/DeepSeek-V3.2");
    expect(FALLBACK_AI_MODELS).not.toContain("deepseek-ai/DeepSeek-R1");
  });

  it("preserves structured edge-function errors", async () => {
    const context = Response.json({ error: { code: "AI_AUTH", retryable: false, requestId: "req-1", message: "凭据无效" } }, { status: 503 });
    const client = { functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: { message: "non-2xx", context } }) } } as any;
    const result = await invokeAiAssistant(client, { mode: "chat", message: "hello" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatchObject({ code: "AI_AUTH", requestId: "req-1", retryable: false });
  });

  it("cancels a hanging request within the configured timeout", async () => {
    const client = { functions: { invoke: vi.fn((_name: string, options: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    })) } } as any;
    const result = await invokeAiAssistant(client, { mode: "chat", message: "hello", timeoutMs: 20 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("AI_TIMEOUT");
  });

  it("lets the user cancel a hanging request", async () => {
    const controller = new AbortController();
    const client = { functions: { invoke: vi.fn((_name: string, options: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    })) } } as any;
    const pending = invokeAiAssistant(client, { mode: "chat", message: "keep my draft", signal: controller.signal });
    controller.abort();
    const result = await pending;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("AI_CANCELLED");
  });

  it("returns successful payloads without requiring a model-list request", async () => {
    const client = { functions: { invoke: vi.fn().mockResolvedValue({ data: { ok: true, reply: "ok", actions: [] }, error: null }) } } as any;
    await expect(invokeAiAssistant(client, { mode: "chat", message: "hello" })).resolves.toMatchObject({ ok: true, reply: "ok" });
    expect(client.functions.invoke).toHaveBeenCalledTimes(1);
  });
});
