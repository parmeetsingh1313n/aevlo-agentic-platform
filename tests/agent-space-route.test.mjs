import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadModule } from "./helpers/load-ts-module.mjs";

test("the workspace page lists the owner's saved agents instead of an empty promise", async () => {
  const { WorkspaceEmptyState } = loadModule("components/custom/workspace/workspace-empty-state.tsx");
  const html = renderToStaticMarkup(React.createElement(WorkspaceEmptyState, { agentCount: 2 }));
  assert.match(html, /2 agents/);
  assert.match(html, /href="\/workspace\/create-agent"/);

  const empty = renderToStaticMarkup(React.createElement(WorkspaceEmptyState, { agentCount: 0 }));
  assert.match(empty, /first agent/i);
});

test("the create form posts the saved agent to the agent space route", async () => {
  const { buildCreateAgentRequest } = loadModule("lib/agent-space.ts");
  const request = buildCreateAgentRequest({
    agentId: "2f1c9d3e-8b47-4a51-9f0c-1d2e3f4a5b6c",
    name: "Daily Briefer",
    description: "Summarize my inbox.",
    agentImage: "https://api.dicebear.com/10.x/gaze/svg?tags=animation&seed=x",
  });
  assert.equal(request.agentId, "2f1c9d3e-8b47-4a51-9f0c-1d2e3f4a5b6c");
  assert.equal(request.name, "Daily Briefer");
  assert.equal(request.description, "Summarize my inbox.");
  assert.match(request.agentImage, /api\.dicebear\.com/);
});

test("the agent space path is built from a validated agent id", async () => {
  const { agentSpacePath } = loadModule("lib/agent-space.ts");
  assert.equal(agentSpacePath("2f1c9d3e-8b47-4a51-9f0c-1d2e3f4a5b6c"), "/workspace/2f1c9d3e-8b47-4a51-9f0c-1d2e3f4a5b6c");
  assert.equal(agentSpacePath("../../etc/passwd"), null);
  assert.equal(agentSpacePath("not-a-uuid"), null);
});
