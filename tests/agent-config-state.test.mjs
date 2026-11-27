import assert from "node:assert/strict";
import test from "node:test";
import { loadModule } from "./helpers/load-ts-module.mjs";
const {
  createAgentConfigState,
  agentConfigReducer,
  changedConfigFields,
  readAgentConfigResponse,
  validateConfigDraft,
} = loadModule("lib/agent-config-state.ts");
const saved = Object.freeze({
  name: "Daily Briefer",
  description: "Be concise.",
  agentImage: "https://api.dicebear.com/10.x/gaze/svg?seed=original",
});

test("editing is a draft until explicit save succeeds, and discard restores the latest saved version", () => {
  let state = createAgentConfigState(saved);
  state = agentConfigReducer(state, {
    type: "edit",
    patch: { name: "Planning Partner" },
  });
  assert.equal(state.saved.name, saved.name);
  assert.deepEqual(Array.from(changedConfigFields(state)), ["name"]);
  state = agentConfigReducer(state, { type: "start", snapshot: state.draft });
  state = agentConfigReducer(state, {
    type: "success",
    value: { ...saved, name: "Planning Partner" },
  });
  assert.equal(changedConfigFields(state).length, 0);
  assert.equal(saved.name, "Daily Briefer");
  state = agentConfigReducer(state, {
    type: "edit",
    patch: { description: "An unsaved instruction" },
  });
  state = agentConfigReducer(state, { type: "discard" });
  assert.equal(state.draft.name, "Planning Partner");
  assert.equal(state.draft.description, saved.description);
});
test("a persisted empty description remains exact in the saved comparison snapshot", () => {
  const state = createAgentConfigState({ ...saved, description: "", version: "100" });
  assert.equal(state.saved.description, "");
  assert.equal(state.draft.description, "");
  assert.equal(changedConfigFields(state).length, 0);
});
test("edits typed during an in-flight save remain unsaved after its canonical response and route refresh", () => {
  let state = agentConfigReducer(createAgentConfigState(saved), {
    type: "edit",
    patch: { name: "  Submitted name  ", description: "New instructions " },
  });
  state = agentConfigReducer(state, { type: "start", snapshot: state.draft });
  state = agentConfigReducer(state, {
    type: "edit",
    patch: { name: "Newer typing" },
  });
  const persisted = {
    ...saved,
    name: "Submitted name",
    description: "New instructions",
  };
  state = agentConfigReducer(state, { type: "success", value: persisted });
  assert.equal(state.saved.name, "Submitted name");
  assert.equal(state.draft.name, "Newer typing");
  assert.equal(state.draft.description, "New instructions");
  state = agentConfigReducer(state, { type: "incoming", value: persisted });
  assert.equal(state.draft.name, "Newer typing");
  assert.deepEqual(Array.from(changedConfigFields(state)), ["name"]);
});
test("failures preserve edits; rebasing keeps edited fields and adopts unrelated remote changes", () => {
  let state = agentConfigReducer(createAgentConfigState(saved), {
    type: "edit",
    patch: { name: "My edit" },
  });
  state = agentConfigReducer(state, { type: "start", snapshot: state.draft });
  const remote = { ...saved, description: "Other tab instructions" };
  state = agentConfigReducer(state, {
    type: "failure",
    error: "Changed elsewhere",
    remote,
  });
  assert.equal(state.draft.name, "My edit");
  assert.equal(state.saved.description, saved.description);
  const rebased = agentConfigReducer(state, { type: "keep-draft" });
  assert.equal(rebased.saved.description, remote.description);
  assert.equal(rebased.draft.description, remote.description);
  assert.equal(rebased.draft.name, "My edit");
  const restored = agentConfigReducer(state, { type: "use-remote" });
  assert.equal(restored.draft.name, saved.name);
  assert.equal(restored.draft.description, remote.description);
  const discarded = agentConfigReducer(state, { type: "discard" });
  assert.equal(discarded.saved.description, remote.description);
  assert.equal(discarded.draft.name, saved.name);
});
test("incoming saved changes never silently replace a dirty draft or its expected snapshot", () => {
  let state = agentConfigReducer(createAgentConfigState(saved), {
    type: "edit",
    patch: { description: "My instructions" },
  });
  state = agentConfigReducer(state, {
    type: "incoming",
    value: { ...saved, name: "Other tab name" },
  });
  assert.equal(state.phase, "conflict");
  assert.equal(state.saved.name, saved.name);
  assert.equal(state.draft.description, "My instructions");
  assert.equal(state.remote.name, "Other tab name");
});
test("rebasing preserves additional fields edited while reviewing a conflict", () => {
  let state = agentConfigReducer(createAgentConfigState(saved), {
    type: "edit",
    patch: { name: "My name" },
  });
  const remote = { ...saved, description: "Other session instructions", version: "102" };
  state = agentConfigReducer(state, { type: "incoming", value: remote });
  state = agentConfigReducer(state, {
    type: "edit",
    patch: { description: "My later instructions", agentImage: "https://api.dicebear.com/10.x/gaze/svg?seed=later" },
  });
  const rebased = agentConfigReducer(state, { type: "keep-draft" });
  assert.equal(rebased.saved.description, remote.description);
  assert.equal(rebased.draft.name, "My name");
  assert.equal(rebased.draft.description, "My later instructions");
  assert.equal(rebased.draft.agentImage, state.draft.agentImage);
  assert.deepEqual(Array.from(changedConfigFields(rebased)), ["name", "description", "agentImage"]);
});
test("draft validation and response decoding reject invalid data while excluding protected fields", () => {
  assert.match(
    validateConfigDraft({ ...saved, description: "", name: "  " }).name,
    /1–80/,
  );
  assert.ok(
    validateConfigDraft({ ...saved, description: "x".repeat(1001) })
      .description,
  );
  const agentId = "2f1c9d3e-8b47-4a51-9f0c-1d2e3f4a5b6c";
  const response = {
    ...saved,
    agentId,
    createdAt: "2026-11-26T09:00:00Z",
    userEmail: "private@example.invalid",
    id: 10,
    version: "100",
  };
  const decoded = readAgentConfigResponse(response, agentId);
  assert.ok(decoded);
  assert.equal("userEmail" in decoded, false);
  assert.equal("id" in decoded, false);
  assert.equal(readAgentConfigResponse(response, "other"), null);
});

test("newer remote snapshots survive a delayed success and resolution cannot run during saving", () => {
  const baseline = { ...saved, version: "100" };
  let state = agentConfigReducer(createAgentConfigState(baseline), {
    type: "edit",
    patch: { name: "Submitted" },
  });
  state = agentConfigReducer(state, { type: "start", snapshot: state.draft });
  const remote = { ...baseline, name: "Other session", version: "102" };
  state = agentConfigReducer(state, { type: "incoming", value: remote });
  assert.equal(agentConfigReducer(state, { type: "use-remote" }), state);
  assert.equal(agentConfigReducer(state, { type: "keep-draft" }), state);
  state = agentConfigReducer(state, {
    type: "success",
    value: { ...baseline, name: "Submitted", version: "101" },
  });
  assert.equal(state.phase, "conflict");
  assert.equal(state.remote.name, "Other session");
  assert.equal(state.saved.name, "Submitted");
  state = agentConfigReducer(state, { type: "incoming", value: remote });
  assert.equal(state.remote.version, "102");
  const rebased = agentConfigReducer(state, { type: "keep-draft" });
  assert.equal(rebased.saved.name, "Other session");
  assert.equal(rebased.draft.name, "Submitted");
});

test("reverting to the baseline during an uncertain save keeps retry intent and pending state", () => {
  let state = agentConfigReducer(createAgentConfigState(saved), {
    type: "edit",
    patch: { name: "Submitted" },
  });
  state = agentConfigReducer(state, { type: "start", snapshot: state.draft });
  state = agentConfigReducer(state, {
    type: "edit",
    patch: { name: saved.name },
  });
  assert.equal(changedConfigFields(state).length, 0);
  assert.ok(state.pending);
  state = agentConfigReducer(state, {
    type: "failure",
    error: "Unknown result",
    uncertain: true,
  });
  assert.ok(
    state.pending,
    "Unknown results must remain retryable even with no field delta.",
  );
  assert.deepEqual(Array.from(state.intentFields), ["name"]);
  state = agentConfigReducer(state, {
    type: "failure",
    error: "Conflicting saved version",
    remote: { ...saved, name: "Submitted", version: "101" },
  });
  const rebased = agentConfigReducer(state, { type: "keep-draft" });
  assert.equal(rebased.saved.name, "Submitted");
  assert.equal(rebased.draft.name, saved.name);
  assert.equal(changedConfigFields(rebased).length, 1);
});

test("a recovery GET acknowledgement cannot erase newer known remote changes", () => {
  const baseline = { ...saved, version: "100" };
  let state = agentConfigReducer(createAgentConfigState(baseline), {
    type: "edit", patch: { name: "Submitted after lost response" },
  });
  state = agentConfigReducer(state, { type: "start", snapshot: state.draft });
  const remote = { ...baseline, name: "A newer session name", version: "102" };
  state = agentConfigReducer(state, { type: "incoming", value: remote });
  state = agentConfigReducer(state, {
    type: "success", verified: true,
    value: { ...baseline, name: "Submitted after lost response", version: "101" },
  });
  assert.equal(state.phase, "conflict");
  assert.equal(state.remote.version, "102");
  state = agentConfigReducer(state, { type: "incoming", value: remote });
  assert.equal(state.draft.name, "Submitted after lost response");
  assert.equal(state.remote.version, "102");
  const rebased = agentConfigReducer(state, { type: "keep-draft" });
  assert.equal(rebased.saved.name, remote.name);
  assert.equal(rebased.draft.name, "Submitted after lost response");
});
