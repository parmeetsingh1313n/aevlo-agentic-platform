import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime.js";
import { loadModule } from "./helpers/load-ts-module.mjs";

const { loadAgentSpace } = loadModule("lib/agent-space.ts");
const { toAgentListEntries } = loadModule("lib/workspace-ui.ts");

function renderAgentView(View, props) {
  const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch: async () => {} };
  return renderToStaticMarkup(React.createElement(AppRouterContext.Provider, { value: router }, React.createElement(View, props)));
}

const agent = {
  id: 7,
  agentId: "2f1c9d3e-8b47-4a51-9f0c-1d2e3f4a5b6c",
  name: "Daily Briefer",
  description: "Summarize my inbox every morning.",
  agentImage: "https://api.dicebear.com/10.x/gaze/svg?tags=animation&seed=daily-briefer",
  createdAt: new Date("2026-11-26T09:00:00.000Z"),
  userEmail: "owner@example.test",
};

test("the agent space loads an owned agent and refuses a missing or anonymous one", async () => {
  const calls = [];
  const find = async (email, agentId) => {
    calls.push({ email, agentId });
    return email === "owner@example.test" && agentId === agent.agentId ? agent : null;
  };

  const ready = await loadAgentSpace({ email: " owner@example.test ", agentId: agent.agentId, find });
  assert.equal(ready.kind, "ready");
  assert.equal(ready.agent.name, "Daily Briefer");
  assert.deepEqual(calls, [{ email: "owner@example.test", agentId: agent.agentId }]);

  const missing = await loadAgentSpace({ email: "owner@example.test", agentId: "missing-agent", find });
  assert.equal(missing.kind, "missing");

  const anonymous = await loadAgentSpace({ email: null, agentId: agent.agentId, find });
  assert.equal(anonymous.kind, "missing");
  assert.equal(calls.length, 1, "An anonymous visitor must never reach the agent lookup.");
});

test("the agent space rejects a malformed agent id before any lookup", async () => {
  let called = 0;
  const find = async () => {
    called += 1;
    return agent;
  };
  for (const agentId of ["", "not-a-uuid", "2f1c9d3e8b474a519f0c1d2e3f4a5b6c"]) {
    const result = await loadAgentSpace({ email: "owner@example.test", agentId, find });
    assert.equal(result.kind, "missing", agentId);
  }
  assert.equal(called, 0, "A malformed id must not query the database.");
});

test("the sidebar entries are serializable, ordered, and owned", () => {
  const entries = toAgentListEntries([
    { ...agent, createdAt: new Date("2026-11-26T09:00:00.000Z") },
    { ...agent, id: 8, agentId: "3a2b9d3e-8b47-4a51-9f0c-1d2e3f4a5b6c", name: "Second", createdAt: new Date("2026-11-25T09:00:00.000Z") },
  ]);

  assert.equal(entries.length, 2);
  assert.equal(entries[0].name, "Daily Briefer");
  assert.equal(entries[0].createdAt, "2026-11-26T09:00:00.000Z");
  assert.equal(typeof entries[0].createdAt, "string", "Entries cross the server/client boundary as strings.");
  for (const entry of entries) {
    assert.deepEqual(Object.keys(entry).sort(), ["agentId", "agentImage", "createdAt", "name"]);
    assert.ok(!("userEmail" in entry), "The sidebar must not publish the owner's email.");
  }
});

test("the agent space view shows the saved name, avatar, and instructions", async () => {
  const { AgentSpaceView } = loadModule("components/custom/workspace/agent-space-view.tsx");
  const html = renderAgentView(AgentSpaceView, {
    agent: { ...agent, createdAt: agent.createdAt.toISOString() },
  });

  assert.match(html, /Daily Briefer/);
  assert.match(html, /Summarize my inbox every morning\./);
  assert.match(html, /api\.dicebear\.com\/10\.x\/gaze\/svg/);
  assert.equal((html.match(/<h1(?:\s|>)/g) ?? []).length, 1);
});

test("the agent space view states plainly that chat is not available yet", async () => {
  const { AgentSpaceView } = loadModule("components/custom/workspace/agent-space-view.tsx");
  const html = renderAgentView(AgentSpaceView, {
    agent: { ...agent, description: null, createdAt: agent.createdAt.toISOString() },
  });

  assert.match(html, /not available yet/i);
  assert.ok(!/undefined/.test(html), "A missing instruction must not render as 'undefined'.");
});

test("the sidebar agent list links to each saved agent and explains an empty list", async () => {
  const { AgentList } = loadModule("components/custom/workspace/agent-list.tsx");
  const populated = renderToStaticMarkup(React.createElement(AgentList, {
    agents: [{
      agentId: agent.agentId,
      name: "Daily Briefer",
      agentImage: agent.agentImage,
      createdAt: "2026-11-26T09:00:00.000Z",
    }],
  }));
  assert.match(populated, /href="\/workspace\/2f1c9d3e-8b47-4a51-9f0c-1d2e3f4a5b6c"/);
  assert.match(populated, /Daily Briefer/);

  const empty = renderToStaticMarkup(React.createElement(AgentList, { agents: [] }));
  assert.match(empty, /No agents yet/i);
});

test("the workspace not-found page offers a way back to the workspace", async () => {
  const { default: NotFound } = loadModule("app/workspace/not-found.tsx");
  const html = renderToStaticMarkup(React.createElement(NotFound));
  assert.match(html, /href="\/workspace"/);
  assert.match(html, /find that agent/i);
});
