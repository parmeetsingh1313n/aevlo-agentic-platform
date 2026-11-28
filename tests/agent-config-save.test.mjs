import assert from "node:assert/strict";
import test from "node:test";
import { loadModule } from "./helpers/load-ts-module.mjs";

const { prepareAgentConfigSave } = loadModule("lib/agent-config-save.ts");
const { agentConfigReducer, createAgentConfigState, editableConfigSignature } = loadModule("lib/agent-config-state.ts");
const { createAgentHandlers } = loadModule("lib/agent-api.ts");
const { AgentUpdateConflictError } = loadModule("lib/agent-validation.ts");
const agentId = "2f1c9d3e-8b47-4a51-9f0c-1d2e3f4a5b6c";
const baseline = { name: "Daily Briefer", description: "Be concise.", agentImage: "https://api.dicebear.com/10.x/gaze/svg?seed=original", version: "100" };
const profile = (patch = {}) => ({ ...baseline, agentId, createdAt: "2026-11-26T09:00:00Z", ...patch });
const signal = () => new AbortController().signal;

test("a save begun before the tool refresh merges uses the freshly verified token and retains later typing", async () => {
  let state = agentConfigReducer(createAgentConfigState(baseline), { type: "edit", patch: { name: "Planning Partner" } });
  const clicked = { ...state.draft };
  state = agentConfigReducer(state, { type: "start", snapshot: clicked });
  let releaseRead;
  const requests = [];
  const preparation = prepareAgentConfigSave(agentId, baseline, signal(), async (url, options) => {
    requests.push({ url, options });
    return new Promise((resolve) => { releaseRead = () => resolve(Response.json(profile({ version: "101", tools: ["github"] }))); });
  });
  // An RSC refresh and more typing can both land while the profile GET waits.
  state = agentConfigReducer(state, { type: "incoming", value: { ...baseline, version: "101" } });
  state = agentConfigReducer(state, { type: "edit", patch: { description: "Later unsaved typing" } });
  releaseRead();
  const prepared = await preparation;
  assert.equal(prepared.kind, "ready");
  assert.equal(prepared.value.version, "101");
  assert.equal(editableConfigSignature(prepared.value), editableConfigSignature(baseline));
  assert.equal("tools" in prepared.value, false);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "/api/agent?agentId=" + agentId);
  assert.equal(requests[0].options.cache, "no-store");
  assert.equal(state.remote, null);
  assert.equal(state.phase, "saving");
  assert.equal(state.pending.name, clicked.name);
  state = agentConfigReducer(state, { type: "success", value: { ...prepared.value, name: clicked.name, version: "102" } });
  assert.equal(state.phase, "saved");
  assert.equal(state.saved.name, clicked.name);
  assert.equal(state.draft.description, "Later unsaved typing");
});

test("a fresh token cannot authorize replacing a real remote name, instruction, or avatar change", async () => {
  for (const patch of [{ name: "Other session name" }, { description: "Other instructions" }, { agentImage: "https://api.dicebear.com/10.x/gaze/svg?seed=other" }]) {
    const prepared = await prepareAgentConfigSave(agentId, baseline, signal(), async () => Response.json(profile({ ...patch, version: "101" })));
    assert.equal(prepared.kind, "conflict");
    assert.equal(prepared.value.version, "101");
  }
  const empty = { ...baseline, description: "" };
  const nullRead = await prepareAgentConfigSave(agentId, empty, signal(), async () => Response.json(profile({ description: null, version: "101" })));
  assert.equal(nullRead.kind, "conflict", "Empty and null saved instructions are distinct comparison values.");
});

test("a metadata-only incoming refresh never replaces an already-observed real conflict during save", () => {
  let state = agentConfigReducer(createAgentConfigState(baseline), { type: "edit", patch: { name: "My name" } });
  state = agentConfigReducer(state, { type: "start", snapshot: state.draft });
  const remote = { ...baseline, description: "Changed in another session", version: "102" };
  state = agentConfigReducer(state, { type: "incoming", value: remote });
  state = agentConfigReducer(state, { type: "incoming", value: { ...baseline, version: "101" } });
  assert.equal(state.remote.description, remote.description);
  assert.equal(state.remote.version, remote.version);
  assert.equal(state.saved.version, baseline.version);
  assert.equal(state.draft.name, "My name");
  state = agentConfigReducer(state, { type: "success", value: { ...baseline, name: "My name", version: "103" } });
  assert.equal(state.phase, "conflict");
  assert.equal(state.remote.description, remote.description);
});

test("another row change after save preparation still hits the unchanged API conflict boundary", async () => {
  let current = profile({ version: "101" });
  let writes = 0;
  const handlers = createAgentHandlers({
    getSession: async () => ({ user: { email: "owner@example.test" } }),
    get: async () => current,
    update: async (input) => {
      writes++;
      assert.equal(input.expectedVersion, "101");
      if (input.expectedVersion !== current.version) throw new AgentUpdateConflictError();
      return current;
    },
  });
  const prepared = await prepareAgentConfigSave(agentId, baseline, signal(), async (url) => handlers.GET(new Request("http://localhost" + url)));
  assert.equal(prepared.kind, "ready");
  // A second toolkit write advances the row after the preflight's read.
  current = profile({ version: "102" });
  const response = await handlers.PUT(new Request("http://localhost/api/agent", {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId, name: "My changed profile", description: baseline.description, agentImage: baseline.agentImage,
      expected: baseline, expectedVersion: prepared.value.version }),
  }));
  assert.equal(response.status, 409);
  assert.equal(writes, 1);
  assert.equal(current.name, baseline.name);
});

test("failed, malformed, or mismatched profile reads never supply a token for a write", async () => {
  for (const read of [
    async () => Response.json({ error: "private provider details" }, { status: 401 }),
    async () => Response.json({ error: "private provider details" }, { status: 500 }),
    async () => Response.json(profile({ agentId: "other-agent" })),
    async () => Response.json(profile({ version: "not-a-token" })),
    async () => new Response("private malformed response"),
    async () => { throw new Error("private connection details"); },
  ]) {
    const prepared = await prepareAgentConfigSave(agentId, baseline, signal(), read);
    assert.equal(prepared.kind, "unavailable");
    assert.equal("value" in prepared, false);
    assert.doesNotMatch(prepared.error, /private|provider|connection/);
  }
});

test("an unavailable preflight preserves recovery intent from an earlier unknown save", async () => {
  let state = agentConfigReducer(createAgentConfigState(baseline), { type: "edit", patch: { name: "First submission" } });
  state = agentConfigReducer(state, { type: "start", snapshot: state.draft });
  state = agentConfigReducer(state, { type: "edit", patch: { name: baseline.name } });
  state = agentConfigReducer(state, { type: "failure", error: "Unknown save outcome", uncertain: true });
  const earlierPending = Boolean(state.pending);
  state = agentConfigReducer(state, { type: "start", snapshot: state.draft });

  const prepared = await prepareAgentConfigSave(agentId, baseline, signal(), async () => {
    throw new Error("Read unavailable");
  });
  assert.equal(prepared.kind, "unavailable");
  state = agentConfigReducer(state, { type: "failure", error: prepared.error, uncertain: earlierPending });
  assert.ok(state.pending, "The prior write must remain unverified until a later read confirms it.");
  assert.ok(state.intentFields.includes("name"));
  assert.equal(state.draft.name, baseline.name);
  assert.equal(agentConfigReducer(state, { type: "discard" }), state);

  const latest = { ...baseline, name: "First submission", version: "101" };
  state = agentConfigReducer(state, { type: "incoming", value: latest });
  assert.equal(state.phase, "conflict");
  state = agentConfigReducer(state, { type: "keep-draft" });
  assert.equal(state.saved.name, "First submission");
  assert.equal(state.draft.name, baseline.name);
});

test("aborted save preparation cannot authorize a write, including abort after the GET response arrives", async () => {
  const before = new AbortController(); before.abort();
  const prepared = await prepareAgentConfigSave(agentId, baseline, before.signal, async () => assert.fail("No request after cancellation."));
  assert.equal(prepared.kind, "aborted");
  const during = new AbortController();
  const later = await prepareAgentConfigSave(agentId, baseline, during.signal, async () => {
    during.abort();
    return Response.json(profile({ version: "101" }));
  });
  assert.equal(later.kind, "aborted");
  assert.equal("value" in later, false);
});
