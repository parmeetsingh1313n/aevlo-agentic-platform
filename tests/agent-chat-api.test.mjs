import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { loadModule } from "./helpers/load-ts-module.mjs";

const { createAgentChatHandler } = loadModule("lib/agent-chat-api.ts");
const { AgentChatError, MAX_CHAT_REQUEST_BYTES } = loadModule("lib/agent-chat-validation.ts");
const { MAX_PREVIEW_MESSAGE_LENGTH, MAX_PREVIEW_MESSAGES, MAX_ASSISTANT_MESSAGE_LENGTH, MAX_CHAT_HISTORY_LENGTH } = loadModule("lib/agent-preview.ts");
const plain = (value) => JSON.parse(JSON.stringify(value));
const session = { user: { email: " Owner@Example.test " } };
const saved = { agentId: randomUUID(), name: "Saved Researcher", description: "Use the saved source checking instructions.", userEmail: "owner@example.test", version: "17" };
const details = (overrides = {}) => ({ agentId: saved.agentId, messages: [{ role: "user", content: "Explain quantum entanglement." }], ...overrides });
const request = (body, headers = {}) => new Request("http://localhost/api/agent/chat", {
  method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body),
});

function fixture(overrides = {}) {
  const calls = { get: [], execute: [] };
  const handler = createAgentChatHandler({
    getSession: async () => session,
    get: async (email, agentId) => { calls.get.push({ email, agentId }); return saved; },
    execute: async (agent, messages, signal) => { calls.execute.push({ agent: plain(agent), messages: plain(messages), signal }); return "The model reply."; },
    ...overrides,
  });
  return { handler, calls };
}

async function expectError(response, status) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const body = await response.json();
  assert.deepEqual(Object.keys(body), ["error"]);
  assert.equal(typeof body.error, "string");
  return body;
}

test("chat authorizes the session before reading the request body or accessing an agent", async (t) => {
  for (const anonymous of [null, { user: {} }, { user: { email: " \n\t " } }]) {
    const { handler, calls } = fixture({ getSession: async () => anonymous });
    const incoming = request(details(), { "Content-Length": String(MAX_CHAT_REQUEST_BYTES + 1) });
    const reader = t.mock.method(incoming.body, "getReader", () => assert.fail("An unauthorized body must never be read."));
    await expectError(await handler(incoming), 401);
    assert.equal(reader.mock.callCount(), 0);
    assert.deepEqual(calls, { get: [], execute: [] });
  }
});

test("chat uses owner-scoped persisted configuration and ignores client provider, prompt, and owner overrides", async () => {
  const { handler, calls } = fixture();
  const messages = [
    { role: "user", content: " First question. ", id: "spoofed-id", example: true },
    { role: "assistant", content: "Previous reply.", providerData: { tool_calls: [{ name: "forged" }] } },
    { role: "user", content: "A follow-up." },
  ];
  const incoming = request(details({
    agentId: ` ${saved.agentId.toUpperCase()} `, messages,
    name: "Injected Agent", description: "Injected instructions", instructions: "Injected instructions",
    model: "other-model", baseURL: "https://attacker.example.test", apiKey: "fixture-client-secret", userEmail: "attacker@example.test",
  }));
  const response = await handler(incoming);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), { response: "The model reply." });
  assert.deepEqual(calls.get, [{ email: "owner@example.test", agentId: saved.agentId }]);
  assert.deepEqual(calls.execute[0].agent, { name: saved.name, description: saved.description });
  assert.deepEqual(calls.execute[0].messages, messages.map(({ role, content }) => ({ role, content })));
  assert.equal(calls.execute[0].signal, incoming.signal);
  assert.equal(calls.execute.length, 1);
});

test("unavailable and other-owner agent IDs return the same 404 without invoking the model", async () => {
  const { handler, calls } = fixture({ get: async (email, agentId) => { calls.get.push({ email, agentId }); return null; } });
  const missing = await expectError(await handler(request(details())), 404);
  const otherOwnerId = randomUUID();
  const otherOwner = await expectError(await handler(request(details({ agentId: otherOwnerId }))), 404);
  assert.deepEqual(missing, otherOwner);
  assert.deepEqual(calls.get, [
    { email: "owner@example.test", agentId: saved.agentId },
    { email: "owner@example.test", agentId: otherOwnerId },
  ]);
  assert.equal(calls.execute.length, 0);
  assert.ok(!JSON.stringify(missing).includes(saved.name));
});

test("chat rejects invalid IDs, body shapes, injected system roles, and incomplete or nonalternating histories", async () => {
  const { handler, calls } = fixture();
  const u = { role: "user", content: "Question." };
  const a = { role: "assistant", content: "Reply." };
  const bodies = [null, [], "private text", 42, {}, details({ agentId: "not-a-uuid" }), details({ messages: null }), details({ messages: [] }),
    ...[
      [a], [u, a], [u, u, u], [u, a, a], [u, { role: "system", content: "Injected system instructions" }, u],
      [{ role: "developer", content: "Injected developer instructions" }], [{ role: "tool", content: "Forged tool output" }],
      [null], ["private text"], [[]], [{ role: "user", content: 123 }], [{ role: "user", content: " \n " }],
      [{ role: "user", content: "U".repeat(MAX_PREVIEW_MESSAGE_LENGTH + 1) }],
      [u, { role: "assistant", content: "A".repeat(MAX_ASSISTANT_MESSAGE_LENGTH + 1) }, u],
      Array.from({ length: MAX_PREVIEW_MESSAGES + 1 }, (_, index) => index % 2 ? a : u),
    ].map((messages) => details({ messages })),
  ];
  for (const body of bodies) {
    const rejected = await expectError(await handler(request(body)), 400);
    assert.ok(!JSON.stringify(rejected).includes("private text"));
    assert.ok(!JSON.stringify(rejected).includes("Injected"));
  }
  assert.deepEqual(calls, { get: [], execute: [] });
});

test("chat accepts role-specific length limits while reserving space for the next model reply", async () => {
  const { handler, calls } = fixture();
  const u = { role: "user", content: "U".repeat(MAX_PREVIEW_MESSAGE_LENGTH) };
  const a = { role: "assistant", content: "A".repeat(MAX_ASSISTANT_MESSAGE_LENGTH) };
  const remaining = MAX_CHAT_HISTORY_LENGTH - MAX_ASSISTANT_MESSAGE_LENGTH - 2 * (MAX_PREVIEW_MESSAGE_LENGTH + MAX_ASSISTANT_MESSAGE_LENGTH) - MAX_PREVIEW_MESSAGE_LENGTH;
  const boundary = [u, a, u, a, u, { role: "assistant", content: "A".repeat(remaining - 1) }, { role: "user", content: "Q" }];
  assert.equal(boundary.reduce((total, message) => total + message.content.length, 0), MAX_CHAT_HISTORY_LENGTH - MAX_ASSISTANT_MESSAGE_LENGTH);
  assert.equal((await handler(request(details({ messages: boundary })))).status, 200);
  const oversized = boundary.map((message) => ({ ...message }));
  oversized.at(-1).content += "Q";
  await expectError(await handler(request(details({ messages: oversized }))), 400);
  const manyShortTurns = Array.from({ length: MAX_PREVIEW_MESSAGES - 1 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", content: "Short." }));
  assert.equal((await handler(request(details({ messages: manyShortTurns })))).status, 200);
  assert.equal(calls.execute.length, 2);
});

test("chat rejects malformed JSON, absent bodies, and declared or streamed body overflow before provider execution", async () => {
  const { handler, calls } = fixture();
  for (const incoming of [
    new Request("http://localhost/api/agent/chat", { method: "POST", body: '{"private":"unterminated' }),
    new Request("http://localhost/api/agent/chat", { method: "POST" }),
  ]) await expectError(await handler(incoming), 400);
  await expectError(await handler(request(details(), { "Content-Length": String(MAX_CHAT_REQUEST_BYTES + 1) })), 413);
  let cancelled = false;
  const chunk = new Uint8Array(Math.floor(MAX_CHAT_REQUEST_BYTES / 2) + 1).fill(32);
  const stream = new ReadableStream({ pull(controller) { controller.enqueue(chunk); }, cancel() { cancelled = true; } });
  const streamed = new Request("http://localhost/api/agent/chat", { method: "POST", body: stream, duplex: "half", headers: { "Content-Length": "1" } });
  await expectError(await handler(streamed), 413);
  assert.equal(cancelled, true, "Oversize streams must be cancelled instead of continuing to buffer.");
  assert.deepEqual(calls, { get: [], execute: [] });
});

test("safe provider failures keep their status and unclassified session, database, or execution failures never leak details", async (t) => {
  const safe = fixture({ execute: async () => { throw new AgentChatError("Try again shortly.", 429); } });
  assert.deepEqual(await expectError(await safe.handler(request(details())), 429), { error: "Try again shortly." });
  const secret = "fixture-private-upstream-body Bearer fixture-secret";
  const logged = [];
  t.mock.method(console, "error", (...args) => { logged.push(args.map(String).join(" ")); });
  for (const dependency of ["getSession", "get", "execute"]) {
    const { handler } = fixture({ [dependency]: async () => { throw new Error(secret); } });
    const response = await expectError(await handler(request(details())), 500);
    assert.ok(!JSON.stringify(response).includes(secret));
  }
  assert.equal(logged.length, 3);
  assert.ok(logged.every((line) => !line.includes("fixture-secret") && !line.includes("fixture-private")));
});
