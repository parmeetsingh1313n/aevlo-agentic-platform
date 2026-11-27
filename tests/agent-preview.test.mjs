import assert from "node:assert/strict";
import test from "node:test";
import { loadModule } from "./helpers/load-ts-module.mjs";
const { createAgentPreview, agentPreviewReducer } = loadModule(
  "lib/agent-preview.ts",
);

test("blank, paused and oversized sends do not add messages; valid sends replace examples with a local user message", () => {
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
  assert.equal(sent.messages.length, 1);
  assert.equal(sent.messages[0].role, "user");
  assert.equal(sent.messages[0].text, "Hello\nworld");
  assert.equal(sent.messages[0].example, false);
  assert.match(sent.notice, /not available yet/);
  assert.equal(agentPreviewReducer(sent, { type: "clear" }).messages.length, 0);
});

test("message previews are bounded and never invent an assistant response", () => {
  let state = agentPreviewReducer(createAgentPreview(), { type: "clear" });
  for (let i = 0; i < 100; i++)
    state = agentPreviewReducer(state, { type: "send", text: `Message ${i}` });
  const full = agentPreviewReducer(state, { type: "send", text: "Overflow" });
  assert.equal(full.messages.length, 100);
  assert.match(full.notice, /full/);
  assert.equal(
    full.messages.every((message) => message.role === "user"),
    true,
  );
});
