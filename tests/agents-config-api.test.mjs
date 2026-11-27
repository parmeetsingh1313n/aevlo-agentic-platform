import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { loadModule } from "./helpers/load-ts-module.mjs";

const { createAgentHandlers } = loadModule("lib/agent-api.ts");
const { AgentNotFoundError, AgentUpdateConflictError, isAgentVersion, MAX_AGENT_NAME_LENGTH, MAX_AGENT_DESCRIPTION_LENGTH } = loadModule("lib/agent-validation.ts");
const { getAgentAvatarUrl } = loadModule("lib/workspace-ui.ts");
const session = { user: { email: " Owner@Example.test ", name: "Owner", image: "private-profile-image" } };
const saved = {
  id: 7,
  agentId: randomUUID(),
  name: "Daily Briefer",
  description: "Keep the sources clear.",
  agentImage: getAgentAvatarUrl("daily-briefer"),
  createdAt: "2026-11-26T09:00:00.000Z",
  userEmail: "owner@example.test",
  version: "123",
};
const snapshot = (agent = saved) => ({ name: agent.name, description: agent.description, agentImage: agent.agentImage });
const updateDetails = (overrides = {}) => ({
  agentId: saved.agentId,
  name: "Research Assistant",
  description: "Check every source.",
  agentImage: getAgentAvatarUrl("research-assistant"),
  expected: snapshot(),
  expectedVersion: saved.version,
  ...overrides,
});
const putRequest = (body) => new Request("http://localhost/api/agent", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const getRequest = (agentId) => new Request(`http://localhost/api/agent?agentId=${encodeURIComponent(agentId)}`);

function fixture(overrides = {}) {
  const calls = { get: [], update: [], list: [] };
  const handlers = createAgentHandlers({
    getSession: async () => session,
    create: async () => { assert.fail("Configuration requests must never create agents."); },
    list: async (email) => { calls.list.push(email); return [saved]; },
    get: async (email, agentId) => { calls.get.push({ email, agentId }); return saved; },
    update: async (input, email) => {
      calls.update.push({ input: JSON.parse(JSON.stringify(input)), email });
      return { ...saved, name: input.name, description: input.description, agentImage: input.agentImage, version: "124" };
    },
    ...overrides,
  });
  return { calls, handlers };
}

test("configuration reads and writes authorize the session before querying or parsing", async (t) => {
  for (const anonymous of [null, { user: {} }, { user: { email: " \t " } }]) {
    const { calls, handlers } = fixture({ getSession: async () => anonymous });
    const incoming = putRequest(updateDetails());
    const parser = t.mock.method(incoming, "json", async () => { assert.fail("Anonymous requests must not be parsed."); });
    for (const response of [await handlers.GET(getRequest(saved.agentId)), await handlers.PUT(incoming)]) {
      assert.equal(response.status, 401);
      assert.equal(response.headers.get("Cache-Control"), "no-store");
      assert.deepEqual(Object.keys(await response.json()), ["error"]);
    }
    assert.equal(parser.mock.callCount(), 0);
    assert.equal(calls.get.length, 0);
    assert.equal(calls.update.length, 0);
    assert.equal(calls.list.length, 0);
  }
});

test("detail GET returns a direct record for a normalized UUID while no-query GET keeps its array", async () => {
  const { calls, handlers } = fixture();
  const response = await handlers.GET(getRequest(` ${saved.agentId.toUpperCase()} `));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), saved);
  assert.deepEqual(calls.get, [{ email: "Owner@Example.test", agentId: saved.agentId }]);
  assert.equal(calls.list.length, 0);
  for (const request of [undefined, new Request("http://localhost/api/agent"), new Request("http://localhost/api/agent?unrelated=value")]) {
    const listed = await handlers.GET(request);
    assert.equal(listed.status, 200);
    assert.deepEqual(await listed.json(), [saved]);
  }
  assert.equal(calls.list.length, 3);
});

test("invalid detail IDs cannot fall back to a list and unavailable agents share one 404", async () => {
  const { calls, handlers } = fixture();
  for (const request of [getRequest(""), getRequest("  "), getRequest("not-a-uuid"), new Request(`http://localhost/api/agent?agentId=${saved.agentId}&agentId=${randomUUID()}`)]) {
    const response = await handlers.GET(request);
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(Object.keys(await response.json()), ["error"]);
  }
  assert.equal(calls.get.length, 0);
  assert.equal(calls.list.length, 0);
  const absent = fixture({ get: async () => null }).handlers;
  const first = await absent.GET(getRequest(saved.agentId));
  const second = await absent.GET(getRequest(randomUUID()));
  assert.equal(first.status, 404);
  assert.equal(second.status, 404);
  assert.deepEqual(await first.json(), await second.json());
});

test("PUT passes only canonical editable fields, the exact expected snapshot and version to the session owner", async () => {
  const { calls, handlers } = fixture();
  const response = await handlers.PUT(putRequest(updateDetails({
    agentId: ` ${saved.agentId.toUpperCase()} `,
    name: "  Research Assistant  ",
    description: "  Check every source.  ",
    agentImage: "https://api.dicebear.com/10.x/gaze/svg?seed=research-assistant&tags=animation",
    id: 999,
    userEmail: "attacker@example.test",
    email: "attacker@example.test",
    createdAt: "1900-01-01T00:00:00.000Z",
    version: "spoofed-version-must-not-be-written",
    credits: 999,
    responseStyle: "unsupported",
    expected: { ...snapshot(), name: ` ${saved.name} `, id: 123, userEmail: "attacker@example.test" },
  })));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(calls.update, [{
    email: "Owner@Example.test",
    input: {
      agentId: saved.agentId,
      name: "Research Assistant",
      description: "Check every source.",
      agentImage: getAgentAvatarUrl("research-assistant"),
      expected: { ...snapshot(), name: ` ${saved.name} ` },
      expectedVersion: saved.version,
    },
  }]);
  const body = await response.json();
  assert.deepEqual(Object.keys(body).sort(), ["agent", "message"]);
  assert.equal(body.agent.id, saved.id);
  assert.equal(body.agent.createdAt, saved.createdAt);
  assert.equal(body.agent.userEmail, saved.userEmail);
  assert.equal(body.agent.version, "124", "Return the persisted version, never the echoed client version.");
  assert.ok(!JSON.stringify(body).includes("attacker@example.test"));
  assert.ok(!JSON.stringify(body).includes("private-profile-image"));
});

test("PUT accepts exact persisted snapshots with nonanimated avatars, alternate query order and raw text values", async () => {
  for (const baseline of [
    { name: ` ${saved.name} `, description: null, agentImage: getAgentAvatarUrl("daily-briefer", false) },
    { name: saved.name, description: "", agentImage: "https://api.dicebear.com/10.x/gaze/svg?seed=daily-briefer&tags=animation" },
    { name: saved.name, description: "  Saved instructions.  ", agentImage: saved.agentImage },
  ]) {
    const persisted = { ...saved, ...baseline };
    let received;
    const { handlers } = fixture({
      get: async () => persisted,
      update: async (input, email) => {
        received = JSON.parse(JSON.stringify(input));
        assert.equal(email, "Owner@Example.test");
        if (input.expectedVersion !== persisted.version || ["name", "description", "agentImage"].some((field) => input.expected[field] !== persisted[field])) {
          throw new AgentUpdateConflictError();
        }
        return { ...persisted, name: input.name, description: input.description, agentImage: input.agentImage, version: "124" };
      },
    });
    const loaded = await (await handlers.GET(getRequest(saved.agentId))).json();
    const response = await handlers.PUT(putRequest(updateDetails({
      name: "  Updated agent  ",
      description: "  Updated instructions.  ",
      agentImage: getAgentAvatarUrl("updated-avatar", false),
      expected: snapshot(loaded),
      expectedVersion: loaded.version,
    })));
    assert.equal(response.status, 200, "A snapshot loaded from GET must match persistence without normalization conflicts.");
    assert.deepEqual(received.expected, baseline);
    assert.equal(received.expectedVersion, saved.version);
    const updated = (await response.json()).agent;
    assert.equal(updated.name, "Updated agent");
    assert.equal(updated.description, "Updated instructions.");
    assert.equal(updated.agentImage, getAgentAvatarUrl("updated-avatar"), "Desired avatars still use the canonical URL.");
    assert.equal(updated.version, "124");
  }
});

test("PUT requires its own canonical unsigned xid version and rejects spoofed or invalid version metadata", async () => {
  const { calls, handlers } = fixture();
  for (const expectedVersion of [undefined, null, 123, {}, [], "", " 123", "123 ", "+123", "-1", "1.5", "1e3", "00123", "4294967296", "99999999999", "123' OR TRUE --", "1".repeat(1000)]) {
    const response = await handlers.PUT(putRequest(updateDetails({ expectedVersion, version: saved.version })));
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(await response.json(), { error: "Reload this agent before saving changes." });
  }
  const nestedSpoof = await handlers.PUT(putRequest(updateDetails({
    expectedVersion: undefined,
    expected: { ...snapshot(), version: saved.version },
  })));
  assert.equal(nestedSpoof.status, 400, "Nested metadata cannot replace the explicit expectedVersion precondition.");
  assert.equal(calls.update.length, 0);

  for (const expectedVersion of ["0", "1", "123", "4294967295"]) {
    assert.equal(isAgentVersion(expectedVersion), true);
    const response = await handlers.PUT(putRequest(updateDetails({ expectedVersion })));
    assert.equal(response.status, 200);
    assert.equal(calls.update.at(-1).input.expectedVersion, expectedVersion, "Keep the version opaque without coercion or normalization.");
  }
});

test("PUT rejects malformed bodies and reports desired field failures without reaching persistence", async () => {
  const { calls, handlers } = fixture();
  const malformed = await handlers.PUT(new Request("http://localhost/api/agent", { method: "PUT", body: '{"private":"unterminated' }));
  assert.equal(malformed.status, 400);
  assert.deepEqual(Object.keys(await malformed.json()), ["error"]);
  for (const body of [null, [], "private input", 42]) {
    const response = await handlers.PUT(putRequest(body));
    assert.equal(response.status, 400);
    assert.ok(!JSON.stringify(await response.json()).includes("private input"));
  }
  for (const [override, field] of [
    [{ agentId: "not-a-uuid" }, "agentId"],
    [{ name: "  " }, "name"],
    [{ name: "N".repeat(MAX_AGENT_NAME_LENGTH + 1) }, "name"],
    [{ description: {} }, "description"],
    [{ description: "D".repeat(MAX_AGENT_DESCRIPTION_LENGTH + 1) }, "description"],
    [{ agentImage: "https://private.example.test/avatar.svg" }, "agentImage"],
    [{ agentImage: "https://api.dicebear.com/10.x/gaze/svg?seed=safe&seed=other" }, "agentImage"],
  ]) {
    const response = await handlers.PUT(putRequest(updateDetails(override)));
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    const result = await response.json();
    assert.equal(typeof result.fieldErrors[field], "string");
    assert.ok(!JSON.stringify(result).includes("private.example.test"));
  }
  assert.equal(calls.update.length, 0);
});

test("PUT requires a complete valid snapshot and accepts null instructions and boundary-length desired values", async () => {
  const { calls, handlers } = fixture();
  for (const expected of [undefined, null, [], "private snapshot", {}, { name: saved.name, agentImage: saved.agentImage }, { ...snapshot(), description: 42 }, { ...snapshot(), name: "" }, { ...snapshot(), agentImage: "https://private.example.test/avatar.svg" }]) {
    const response = await handlers.PUT(putRequest(updateDetails({ expected })));
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.deepEqual(Object.keys(body), ["error"]);
    assert.ok(!JSON.stringify(body).includes("private"));
  }
  assert.equal(calls.update.length, 0);
  const accepted = await handlers.PUT(putRequest(updateDetails({
    name: "N".repeat(MAX_AGENT_NAME_LENGTH),
    description: "D".repeat(MAX_AGENT_DESCRIPTION_LENGTH),
    expected: { ...snapshot(), description: null },
  })));
  assert.equal(accepted.status, 200);
  assert.equal(calls.update[0].input.expected.description, null);
  const blank = await handlers.PUT(putRequest(updateDetails({ description: " \n " })));
  assert.equal(blank.status, 200);
  assert.equal((await blank.json()).agent.description, null);
});

test("PUT maps missing ownership and stale snapshots to safe 404/409 responses", async () => {
  for (const [error, status] of [[new AgentNotFoundError(), 404], [new AgentUpdateConflictError(), 409]]) {
    const { handlers } = fixture({ update: async () => { throw error; } });
    const response = await handlers.PUT(putRequest(updateDetails()));
    assert.equal(response.status, status);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    const body = await response.json();
    assert.deepEqual(Object.keys(body), ["error"]);
    assert.ok(!JSON.stringify(body).includes(saved.userEmail));
    assert.ok(!JSON.stringify(body).includes(saved.name));
  }
});

test("detail, update and session failures return sanitized 500s and static logs", async (t) => {
  const secret = "postgresql://private-user:private-password@private-db/private-profile";
  const logged = [];
  t.mock.method(console, "error", (...args) => { logged.push(args.map(String).join(" ")); });
  const failing = fixture({
    get: async () => { throw new Error(secret); },
    update: async () => { throw new Error(secret); },
  }).handlers;
  const sessionFailure = fixture({ getSession: async () => { throw new Error(secret); } });
  const responses = [
    await failing.GET(getRequest(saved.agentId)),
    await failing.PUT(putRequest(updateDetails())),
    await sessionFailure.handlers.GET(getRequest(saved.agentId)),
    await sessionFailure.handlers.PUT(putRequest(updateDetails())),
  ];
  for (const response of responses) {
    assert.equal(response.status, 500);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    const body = await response.json();
    assert.deepEqual(Object.keys(body), ["error"]);
    assert.ok(!JSON.stringify(body).includes(secret));
    assert.ok(!JSON.stringify(body).includes("private-password"));
  }
  assert.equal(sessionFailure.calls.get.length, 0);
  assert.equal(sessionFailure.calls.update.length, 0);
  assert.equal(logged.length, 4);
  assert.ok(logged.every((message) => !message.includes(secret) && !message.includes("private-password")));
});
