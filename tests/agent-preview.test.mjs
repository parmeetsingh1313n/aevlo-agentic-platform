import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadModule } from "./helpers/load-ts-module.mjs";
const { createAgentPreview, agentPreviewReducer } = loadModule(
  "lib/agent-preview.ts",
);

test("invalid and paused sends do nothing; sending replaces examples and awaits a real response", () => {
  const state = createAgentPreview();
  for (const text of ["  ", "a".repeat(4001)])
    assert.equal(agentPreviewReducer(state, { type: "send", text }), state);
  const paused = agentPreviewReducer(state, { type: "toggle" });
  assert.equal(
    agentPreviewReducer(paused, { type: "send", text: "Hello" }),
    paused,
  );
  const sent = agentPreviewReducer(state, {
    type: "send",
    text: "  Hello\nworld  ",
  });
  assert.equal(sent.example, false);
  assert.equal(sent.pending, true);
  assert.equal(sent.messages.length, 1);
  assert.equal(sent.messages[0].role, "user");
  assert.equal(sent.messages[0].text, "Hello\nworld");
  assert.equal(sent.messages[0].example, false);
  assert.match(sent.notice, /thinking/i);
  assert.equal(agentPreviewReducer(sent, { type: "send", text: "Duplicate" }), sent);
  const received = agentPreviewReducer(sent, { type: "reply", text: "The actual reply" });
  assert.equal(received.pending, false);
  assert.equal(received.messages[1].role, "assistant");
  assert.equal(received.messages[1].text, "The actual reply");
});

test("the message cap reserves an assistant slot and the character cap reserves response space", () => {
  let state = agentPreviewReducer(createAgentPreview(), { type: "clear" });
  for (let i = 0; i < 50; i++) {
    state = agentPreviewReducer(state, { type: "send", text: `Message ${i}` });
    state = agentPreviewReducer(state, { type: "reply", text: `Reply ${i}` });
  }
  const full = agentPreviewReducer(state, { type: "send", text: "Overflow" });
  assert.equal(full.messages.length, 100);
  assert.equal(full.pending, false);
  assert.equal(full.capacityReached, true);
  assert.match(full.notice, /full/);
  let long = agentPreviewReducer(createAgentPreview(), { type: "clear" });
  for (let i = 0; i < 3; i++) {
    long = agentPreviewReducer(long, { type: "send", text: "u".repeat(4000) });
    long = agentPreviewReducer(long, { type: "reply", text: "a".repeat(16000) });
  }
  const bounded = agentPreviewReducer(long, { type: "send", text: "More" });
  assert.equal(bounded.messages.length, 6);
  assert.equal(bounded.pending, false);
  assert.match(bounded.notice, /full/);
});

const { createAgentChatSession } = loadModule("hooks/use-agent-chat.ts");
const agentId = "2f1c9d3e-8b47-4a51-9f0c-1d2e3f4a5b6c";
function deferredFetch() {
  const requests = [];
  const fetcher = (url, init) => new Promise((resolve, reject) => requests.push({ url, init, resolve, reject }));
  return { fetcher, requests };
}
function reply(request, body, status = 200) { request.resolve(Response.json(body, { status })); }

const interaction = {
  id: "scope-fixture",
  questions: [{
    id: "audience", prompt: "Who will read this?", mode: "single",
    options: [{ id: "team", label: "My team" }, { id: "customer", label: "A customer" }],
  }],
};

test("failed replies retain the user turn and retry never appends another user message", () => {
  const sent = agentPreviewReducer(createAgentPreview(), { type: "send", text: "Hello" });
  const failed = agentPreviewReducer(sent, { type: "fail", error: "Please retry." });
  assert.equal(failed.pending, false);
  assert.equal(failed.messages.length, 1);
  assert.equal(agentPreviewReducer(failed, { type: "send", text: "Next" }), failed);
  const retry = agentPreviewReducer(failed, { type: "retry" });
  assert.equal(retry.pending, true);
  assert.equal(retry.error, "");
  assert.equal(retry.messages.length, 1);
  const cleared = agentPreviewReducer(retry, { type: "clear" });
  assert.equal(cleared.pending, false);
  assert.equal(cleared.messages.length, 0);
  assert.equal(agentPreviewReducer(cleared, { type: "reply", text: "Late" }), cleared);
  for (const text of [" ", "a".repeat(16001)]) {
    const invalid = agentPreviewReducer(sent, { type: "reply", text });
    assert.equal(invalid.messages.length, 1);
    assert.equal(invalid.pending, false);
    assert.ok(invalid.error);
  }
});

test("a failure after tool execution prevents replay and a fresh conversation restores sending", async () => {
  const { ChatPanel } = loadModule("components/custom/agent-space/chat-panel.tsx");
  const { fetcher, requests } = deferredFetch();
  const session = createAgentChatSession(agentId, fetcher);
  session.send("Create the task");
  reply(requests[0], { error: "A tool ran, but the final reply failed.", retryable: false }, 502);
  await setImmediate();
  const failed = session.getSnapshot();
  assert.equal(failed.pending, false);
  assert.equal(failed.retryable, false);
  assert.equal(failed.messages.length, 1);
  assert.equal(session.retry(), false);
  assert.equal(session.send("Try again"), false);
  assert.equal(requests.length, 1, "Retry must not replay an already-executed tool action.");
  const html = renderToStaticMarkup(React.createElement(ChatPanel, {
    agent: { name: "Briefer", description: "", agentImage: "https://api.dicebear.com/10.x/gaze/svg?seed=test" },
    ...failed, dirty: false, draft: "",
    onDraft() {}, onSend: session.send, onExample: session.example, onRetry: session.retry, onNewConversation: session.clear,
  }));
  assert.doesNotMatch(html, /Retry message/);
  assert.match(html, /Check the connected app for completed actions/);
  assert.match(html, />New conversation</);
  session.clear();
  assert.equal(session.getSnapshot().retryable, true);
  assert.equal(session.getSnapshot().error, "");
  assert.equal(session.send("Check the existing task"), true);
  reply(requests[1], { response: "Here is the existing task." });
  await setImmediate();
  assert.equal(session.getSnapshot().messages.length, 2);
});

test("a synchronous lock sends no examples, rejects duplicate sends, and preserves completed history", async () => {
  const { fetcher, requests } = deferredFetch();
  const session = createAgentChatSession(agentId, fetcher);
  assert.equal(session.send("First"), true);
  assert.equal(session.send("Duplicate"), false);
  assert.equal(requests.length, 1);
  assert.deepEqual(JSON.parse(requests[0].init.body), { agentId, messages: [{ role: "user", content: "First" }] });
  assert.equal(requests[0].url, "/api/agent/chat");
  reply(requests[0], { response: "First reply" });
  await setImmediate();
  assert.equal(session.getSnapshot().pending, false);
  assert.equal(session.send("Second"), true);
  assert.deepEqual(JSON.parse(requests[1].init.body).messages, [
    { role: "user", content: "First" }, { role: "assistant", content: "First reply" }, { role: "user", content: "Second" },
  ]);
  reply(requests[1], { response: "Second reply" });
  await setImmediate();
  assert.equal(session.getSnapshot().messages.length, 4);
});

test("explicit errors retry the same turn once while malformed success requires a fresh conversation", async () => {
  const { fetcher, requests } = deferredFetch();
  const session = createAgentChatSession(agentId, fetcher);
  session.send("Please answer");
  reply(requests[0], { error: "The model is unavailable. Please retry." }, 502);
  await setImmediate();
  assert.equal(session.getSnapshot().pending, false);
  assert.match(session.getSnapshot().error, /unavailable/);
  assert.equal(session.send("Another message"), false);
  assert.equal(session.retry(), true);
  assert.equal(session.retry(), false);
  assert.equal(requests[1].init.body, requests[0].init.body);
  reply(requests[1], { response: null });
  await setImmediate();
  assert.equal(session.getSnapshot().messages.length, 1);
  assert.ok(session.getSnapshot().error);
  assert.equal(session.getSnapshot().retryable, false);
  assert.equal(session.retry(), false);
  session.clear();
  assert.equal(session.send("Check the current result"), true);
  reply(requests[2], { response: "Recovered" });
  await setImmediate();
  assert.equal(session.getSnapshot().messages.length, 2);
  assert.equal(session.getSnapshot().error, "");
});

test("clear aborts a pending request and ignores its late reply after a new conversation starts", async () => {
  const { fetcher, requests } = deferredFetch();
  const session = createAgentChatSession(agentId, fetcher);
  session.send("Old conversation");
  session.clear();
  assert.equal(requests[0].init.signal.aborted, true);
  assert.equal(session.getSnapshot().messages.length, 0);
  assert.equal(session.send("New conversation"), true);
  reply(requests[0], { response: "Stale reply" });
  await setImmediate();
  assert.equal(session.getSnapshot().messages.length, 1);
  assert.equal(session.getSnapshot().pending, true);
  reply(requests[1], { response: "Current reply" });
  await setImmediate();
  assert.deepEqual(Array.from(session.getSnapshot().messages, ({ text }) => text), ["New conversation", "Current reply"]);
});

test("unmount cancellation aborts the request and a late result cannot append a reply", async () => {
  const { fetcher, requests } = deferredFetch();
  const session = createAgentChatSession(agentId, fetcher);
  session.send("Pending");
  session.cancel();
  assert.equal(requests[0].init.signal.aborted, true);
  assert.equal(session.getSnapshot().pending, false);
  reply(requests[0], { response: "Too late" });
  await setImmediate();
  assert.equal(session.getSnapshot().messages.length, 1);
});

test("guided answers send readable question context and retain the same answer turn on retry", async () => {
  const { formatInteractionAnswers } = loadModule("lib/agent-interaction.ts");
  const { fetcher, requests } = deferredFetch();
  const session = createAgentChatSession(agentId, fetcher);
  session.send("Prepare a brief");
  reply(requests[0], { response: "I need the audience to choose the level of detail.", interaction });
  await setImmediate();
  const questionReply = session.getSnapshot().messages[1];
  assert.equal(questionReply.interaction.id, interaction.id);
  assert.equal(questionReply.text, "I need the audience to choose the level of detail.");
  const answers = formatInteractionAnswers(questionReply.interaction, [{ questionId: "audience", optionIds: ["team"], customText: "Include launch risks." }]);
  assert.equal(session.send(answers), true);
  assert.equal(session.send(answers), false);
  const body = JSON.parse(requests[1].init.body);
  assert.equal(body.messages.length, 3);
  assert.match(body.messages[1].content, /Who will read this\?/);
  assert.match(body.messages[1].content, /- My team/);
  assert.match(body.messages[2].content, /Selected: My team/);
  assert.match(body.messages[2].content, /My answer: Include launch risks\./);
  assert.doesNotMatch(requests[1].init.body, /scope-fixture|optionIds|questionId/);
  reply(requests[1], { error: "Retry this reply." }, 502);
  await setImmediate();
  assert.equal(session.getSnapshot().messages.length, 3);
  assert.equal(session.retry(), true);
  assert.equal(requests[2].init.body, requests[1].init.body);
  reply(requests[2], { response: "Here is the team brief." });
  await setImmediate();
  assert.equal(session.getSnapshot().messages.length, 4);
});

test("invalid question metadata is recoverable and late guided replies cannot repopulate a cleared session", async () => {
  const { fetcher, requests } = deferredFetch();
  const session = createAgentChatSession(agentId, fetcher);
  session.send("Prepare a brief");
  reply(requests[0], { response: "Choose an audience.", interaction: { ...interaction, questions: [] } });
  await setImmediate();
  assert.equal(session.getSnapshot().messages.length, 1);
  assert.ok(session.getSnapshot().error);
  assert.equal(session.getSnapshot().retryable, false);
  assert.equal(session.retry(), false);
  session.clear();
  assert.equal(session.send("Check what happened"), true);
  session.clear();
  reply(requests[1], { response: "Choose an audience.", interaction });
  await setImmediate();
  assert.equal(session.getSnapshot().messages.length, 0);
  assert.equal(session.getSnapshot().pending, false);
  assert.equal(session.getSnapshot().error, "");
});

test("transport and JSON failures cannot offer a replay when the execution result is unknown", async () => {
  for (const malformed of ["transport", "json", "blank", "oversized"]) {
    const { fetcher, requests } = deferredFetch();
    const session = createAgentChatSession(agentId, fetcher);
    session.send("Create the task");
    if (malformed === "transport") requests[0].reject(new Error("Fixture disconnected"));
    else if (malformed === "json") requests[0].resolve(new Response("not-json", { status: 502 }));
    else reply(requests[0], { response: malformed === "blank" ? " " : "A".repeat(16001) });
    await setImmediate();
    assert.equal(session.getSnapshot().pending, false);
    assert.equal(session.getSnapshot().retryable, false);
    assert.match(session.getSnapshot().error, /couldn’t confirm the result/);
    assert.equal(session.retry(), false);
    assert.equal(requests.length, 1);
  }
});

test("question context counts toward reply and conversation capacity limits", () => {
  let state = agentPreviewReducer(createAgentPreview(), { type: "send", text: "First" });
  const oversized = agentPreviewReducer(state, { type: "reply", text: "x".repeat(16000), interaction });
  assert.ok(oversized.error, "Question context must fit in the assistant slot reserved by send.");
  assert.equal(oversized.messages.length, 1);
  state = agentPreviewReducer(state, { type: "reply", text: "x".repeat(15800), interaction });
  state = agentPreviewReducer(state, { type: "send", text: "u".repeat(4000) });
  state = agentPreviewReducer(state, { type: "reply", text: "x".repeat(16000) });
  state = agentPreviewReducer(state, { type: "send", text: "u".repeat(4000) });
  state = agentPreviewReducer(state, { type: "reply", text: "x".repeat(8185) });
  const bounded = agentPreviewReducer(state, { type: "send", text: "More" });
  assert.equal(bounded.capacityReached, true);
  assert.equal(bounded.pending, false);
  assert.equal(bounded.messages.length, 6);
});

test("chat renders question controls inline, disables blocked answers and marks older questions answered", () => {
  const { ChatPanel } = loadModule("components/custom/agent-space/chat-panel.tsx");
  const props = {
    agent: { name: "Briefer", description: "", agentImage: "https://api.dicebear.com/10.x/gaze/svg?seed=test" },
    active: true, example: false, pending: false, error: "", dirty: false, capacityReached: false, draft: "",
    messages: [{ id: 1, role: "user", text: "Prepare a brief", example: false }, { id: 2, role: "assistant", text: "Choose the audience.", example: false, interaction }],
    onDraft() {}, onSend: () => false, onExample() {}, onRetry: () => false, onNewConversation() {},
  };
  const render = (overrides = {}) => renderToStaticMarkup(React.createElement(ChatPanel, { ...props, ...overrides }));
  const ready = render();
  assert.equal((ready.match(/Who will read this\?/g) || []).length, 1);
  assert.match(ready, /Answer your agent.*questions/);
  assert.equal((ready.match(/type="radio"/g) || []).length, 2);
  for (const override of [{ active: false }, { pending: true }, { error: "Please retry." }, { capacityReached: true }]) {
    assert.match(render(override), /<fieldset[^>]*disabled/);
  }
  const answered = render({ messages: [...props.messages, { id: 3, role: "user", text: "Use my team.", example: false }], pending: true });
  assert.match(answered, /Details provided/);
  assert.doesNotMatch(answered, /<fieldset|type="radio"/);
});

test("chat renders pending and failure states without labeling real replies as examples", () => {
  const { ChatPanel } = loadModule("components/custom/agent-space/chat-panel.tsx");
  const props = {
    agent: { name: "Briefer", description: "", agentImage: "https://api.dicebear.com/10.x/gaze/svg?seed=test" },
    active: true, example: false, pending: true, error: "", dirty: false, capacityReached: false, draft: "Next draft",
    messages: [{ id: 1, role: "user", text: "Hello", example: false }],
    onDraft() {}, onSend: () => false, onExample() {}, onRetry: () => false, onNewConversation() {},
  };
  const pending = renderToStaticMarkup(React.createElement(ChatPanel, props));
  assert.match(pending, /Thinking/);
  assert.match(pending, /aria-label="Send message"[^>]*disabled|disabled[^>]*aria-label="Send message"/);
  const complete = renderToStaticMarkup(React.createElement(ChatPanel, {
    ...props, pending: false, messages: [...props.messages, { id: 2, role: "assistant", text: "Live answer", example: false }],
  }));
  assert.match(complete, /Live answer/);
  assert.doesNotMatch(complete, /Example|Thinking/);
  const failed = renderToStaticMarkup(React.createElement(ChatPanel, { ...props, pending: false, error: "Unable to reply.", dirty: true }));
  assert.match(failed, /role="alert"/);
  assert.match(failed, /Retry message/);
  assert.match(failed, /Save your configuration changes to use them in replies/);
});

test("capacity rejection keeps the draft, visibly explains the limit, and disables sending without a retry error", () => {
  const { ChatPanel } = loadModule("components/custom/agent-space/chat-panel.tsx");
  let state = agentPreviewReducer(createAgentPreview(), { type: "clear" });
  for (let i = 0; i < 50; i++) {
    state = agentPreviewReducer(state, { type: "send", text: `Message ${i}` });
    state = agentPreviewReducer(state, { type: "reply", text: `Reply ${i}` });
  }
  const draft = "Keep this draft";
  const rejected = agentPreviewReducer(state, { type: "send", text: draft });
  assert.equal(rejected.messages.length, 100);
  assert.equal(rejected.capacityReached, true);
  assert.equal(rejected.error, "");
  assert.equal(rejected.pending, false);
  const html = renderToStaticMarkup(React.createElement(ChatPanel, {
    agent: { name: "Briefer", description: "", agentImage: "https://api.dicebear.com/10.x/gaze/svg?seed=test" },
    active: rejected.active, messages: rejected.messages, example: false, pending: false, error: "", dirty: false,
    capacityReached: rejected.capacityReached, draft,
    onDraft() {}, onSend: () => false, onExample() {}, onRetry: () => false, onNewConversation() {},
  }));
  assert.match(html, /This conversation is full\. Start a new conversation to continue\./);
  assert.match(html, />New conversation</);
  assert.match(html, /aria-label="Send message"[^>]*disabled|disabled[^>]*aria-label="Send message"/);
  assert.match(html, /Keep this draft/);
  assert.doesNotMatch(html, /Retry message|role="alert"/);
  const cleared = agentPreviewReducer(rejected, { type: "clear" });
  assert.equal(cleared.capacityReached, false);
});
