import test from "node:test";
import assert from "node:assert/strict";
import { AiGatewayError, callAiGateway, type AiProviderConfig } from "./gateway.ts";

const providers: AiProviderConfig[] = [
  { name: "siliconflow", baseUrl: "https://primary.test/v1", apiKey: "primary", model: "primary-model" },
  { name: "deepseek", baseUrl: "https://backup.test/v1", apiKey: "backup", model: "backup-model" },
];

test("returns the primary provider response without a backup call", async () => {
  let calls = 0;
  const result = await callAiGateway({
    providers,
    messages: [{ role: "user", content: "hello" }],
    maxTokens: 100,
    fetchImpl: async () => {
      calls += 1;
      return Response.json({ choices: [{ message: { content: "primary ok" } }] });
    },
  });
  assert.equal(result.provider, "siliconflow");
  assert.equal(calls, 1);
});

test("falls back immediately after a primary 403", async () => {
  const calls: string[] = [];
  const result = await callAiGateway({
    providers,
    messages: [{ role: "user", content: "hello" }],
    maxTokens: 100,
    fetchImpl: async (url) => {
      calls.push(String(url));
      return calls.length === 1
        ? new Response("forbidden", { status: 403 })
        : Response.json({ choices: [{ message: { content: "ok" } }] });
    },
  });
  assert.equal(result.provider, "deepseek");
  assert.equal(result.content, "ok");
  assert.equal(calls.length, 2);
});

test("returns a structured error when both providers fail", async () => {
  await assert.rejects(
    callAiGateway({
      providers,
      messages: [{ role: "user", content: "hello" }],
      maxTokens: 100,
      fetchImpl: async () => new Response("busy", { status: 429 }),
    }),
    (error: unknown) => error instanceof AiGatewayError && error.code === "AI_RATE_LIMIT" && error.retryable,
  );
});

test("caps each provider attempt with an abort signal", async () => {
  const startedAt = Date.now();
  await assert.rejects(callAiGateway({
    providers: providers.slice(0, 1),
    messages: [{ role: "user", content: "hello" }],
    maxTokens: 100,
    perProviderTimeoutMs: 20,
    totalTimeoutMs: 30,
    fetchImpl: (_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }),
  }), (error: unknown) => error instanceof AiGatewayError && error.code === "AI_TIMEOUT");
  assert.ok(Date.now() - startedAt < 250);
});

test("falls back after a primary timeout within the total budget", async () => {
  const startedAt = Date.now();
  let calls = 0;
  const result = await callAiGateway({
    providers,
    messages: [{ role: "user", content: "private task title" }],
    maxTokens: 100,
    perProviderTimeoutMs: 20,
    totalTimeoutMs: 60,
    fetchImpl: (_url, init) => {
      calls += 1;
      if (calls === 2) return Promise.resolve(Response.json({ choices: [{ message: { content: "backup ok" } }] }));
      return new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
    },
  });
  assert.equal(result.provider, "deepseek");
  assert.ok(Date.now() - startedAt < 250);
});

test("structured errors do not include credentials or prompt content", async () => {
  const secretProviders = providers.map((provider) => ({ ...provider, apiKey: `secret-${provider.name}` }));
  try {
    await callAiGateway({
      providers: secretProviders,
      messages: [{ role: "user", content: "private task title" }],
      maxTokens: 100,
      fetchImpl: async () => new Response("bad", { status: 403 }),
    });
    assert.fail("expected gateway failure");
  } catch (error) {
    const serialized = JSON.stringify(error);
    assert.equal(serialized.includes("secret-"), false);
    assert.equal(serialized.includes("private task title"), false);
  }
});
