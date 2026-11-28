import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadModule } from "./helpers/load-ts-module.mjs";

const { AgentQuestionCard } = loadModule("components/custom/agent-space/agent-question-card.tsx");
const { MAX_AGENT_ANSWER_CUSTOM_LENGTH } = loadModule("lib/agent-interaction.ts");
const interaction = {
  id: "clarification-fixture",
  questions: [
    { id: "audience", prompt: "Who will read this?", mode: "single", options: [{ id: "team", label: "My team", description: "Include implementation details." }, { id: "customer", label: "A customer", description: "Use a concise explanation." }] },
    { id: "details", prompt: "What should the brief include?", mode: "multiple", options: [{ id: "risk", label: "Risks" }, { id: "steps", label: "Next steps" }] },
  ],
};
const render = (props = {}) => renderToStaticMarkup(React.createElement(AgentQuestionCard, { interaction, onSubmit: () => false, ...props }));

test("agent questions expose native single/multiple choices, descriptions and custom answers with one disabled initial submission", () => {
  const html = render();
  assert.equal((html.match(/<fieldset/g) || []).length, 2);
  assert.equal((html.match(/type="radio"/g) || []).length, 2);
  assert.equal((html.match(/type="checkbox"/g) || []).length, 2);
  assert.equal((html.match(/<textarea/g) || []).length, 2);
  assert.match(html, /<legend[^>]*>Who will read this\?<\/legend>/);
  assert.match(html, /Include implementation details\./);
  assert.match(html, /Choose any that apply, or write your own answer\./);
  assert.match(html, new RegExp(`maxLength="${MAX_AGENT_ANSWER_CUSTOM_LENGTH}"`, "i"));
  assert.match(html, /type="submit"[^>]*disabled|disabled[^>]*type="submit"/);
  assert.equal((html.match(/type="submit"/g) || []).length, 1);
});

test("an answered question card is read-only and a paused card disables its question groups", () => {
  const answered = render({ answered: true });
  assert.match(answered, /Details provided/);
  assert.match(answered, /Your answers are included in the conversation\./);
  assert.doesNotMatch(answered, /<form|<textarea|<input|type="submit"/);
  const paused = render({ disabled: true });
  assert.equal((paused.match(/<fieldset[^>]*disabled/g) || []).length, 2);
  assert.match(paused, /Continue when the conversation is ready\./);
});

test("question and option text render as inert text rather than model-authored markup", () => {
  const unsafeText = '<img src="x" onerror="alert(1)">';
  const html = render({ interaction: { id: "escaped-fixture", questions: [{ id: "safety", prompt: unsafeText, mode: "single", options: [{ id: "first", label: unsafeText, description: '<script>alert(1)</script>' }, { id: "second", label: "Safe alternative" }] }] } });
  assert.match(html, /&lt;img/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<img|<script|onerror="alert/);
});
