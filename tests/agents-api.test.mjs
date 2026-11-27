import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { loadModule } from "./helpers/load-ts-module.mjs";

const { createAgentHandlers } = loadModule("lib/agent-api.ts");
const { AgentConflictError, MAX_AGENT_NAME_LENGTH, MAX_AGENT_DESCRIPTION_LENGTH } = loadModule("lib/agent-validation.ts");
const { getAgentAvatarUrl } = loadModule("lib/workspace-ui.ts");

const session = { user: { email: "owner@example.test", name: "Workspace Owner" } };
const plain = (value) => JSON.parse(JSON.stringify(value));

function details(overrides = {}) {
  return {
    agentId: randomUUID(),
    name: "Research Assistant",
    description: "Check the sources before answering.",
    agentImage: getAgentAvatarUrl("research-assistant"),
    ...overrides,
  };
}

function request(body) {
  return new Request("http://localhost/api/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function workspace(initialSession = session) {
  let currentSession = initialSession;
  const saved = new Map();
  const calls = { create: [], list: [] };
  const handlers = createAgentHandlers({
    getSession: async () => currentSession,
    create: async (input, owner) => {
      calls.create.push({ input: plain(input), owner: plain(owner) });
      const email = owner.email.toLowerCase();
      const existing = saved.get(input.agentId);
      if (existing) {
        if (existing.userEmail !== email || existing.name !== input.name || existing.description !== input.description || existing.agentImage !== input.agentImage) {
          throw new AgentConflictError();
        }
        return { agent: existing, created: false };
      }
      const agent = { ...plain(input), id: saved.size + 1, userEmail: email, createdAt: "2026-11-26T00:00:00.000Z" };
      saved.set(input.agentId, agent);
      return { agent, created: true };
    },
    list: async (email) => {
      calls.list.push(email);
      return [...saved.values()].filter((agent) => agent.userEmail === email.toLowerCase());
    },
  });
  return { handlers, calls, saved, setSession: (value) => { currentSession = value; } };
}

test("anonymous and email-less sessions cannot list, parse, or save agents", async (t) => {
  for (const anonymous of [null, { user: {} }, { user: { email: "   " } }]) {
    const { handlers, calls } = workspace(anonymous);
    const incoming = request(details());
    const parse = t.mock.method(incoming, "json", async () => { throw new Error("An anonymous body must never be parsed."); });
    const read = await handlers.GET();
    const write = await handlers.POST(incoming);
    assert.equal(read.status, 401);
    assert.equal(write.status, 401);
    assert.equal(read.headers.get("Cache-Control"), "no-store");
    assert.equal(write.headers.get("Cache-Control"), "no-store");
    assert.equal(parse.mock.callCount(), 0);
    assert.equal(calls.create.length, 0);
    assert.equal(calls.list.length, 0);
    assert.deepEqual(Object.keys(await read.json()), ["error"]);
    assert.deepEqual(Object.keys(await write.json()), ["error"]);
  }
});

test("creation uses the session owner and validated fields, then safely replays or conflicts", async () => {
  const store = workspace({ user: { email: " Owner@Example.test ", name: "Workspace Owner", image: "private-profile-image" } });
  const agentId = randomUUID();
  const incoming = details({
    agentId: ` ${agentId.toUpperCase()} `,
    name: "  Research Assistant  ",
    description: "  Check the sources before answering.  ",
    userEmail: "attacker@example.test",
    email: "attacker@example.test",
    id: 999,
    createdAt: "1900-01-01T00:00:00.000Z",
    credits: 999,
  });

  const first = await store.handlers.POST(request(incoming));
  assert.equal(first.status, 201);
  assert.equal(first.headers.get("Cache-Control"), "no-store");
  const result = await first.json();
  assert.deepEqual(Object.keys(result).sort(), ["agent", "message"]);
  assert.equal(result.agent.agentId, agentId);
  assert.equal(result.agent.name, "Research Assistant");
  assert.equal(result.agent.description, "Check the sources before answering.");
  assert.equal(result.agent.userEmail, "owner@example.test");
  assert.equal(result.agent.id, 1);
  assert.equal(result.agent.createdAt, "2026-11-26T00:00:00.000Z");
  assert.deepEqual(store.calls.create[0], {
    input: { agentId, name: "Research Assistant", description: "Check the sources before answering.", agentImage: getAgentAvatarUrl("research-assistant") },
    owner: { email: "Owner@Example.test", name: "Workspace Owner" },
  });
  assert.ok(!JSON.stringify(result).includes("private-profile-image"));
  assert.ok(!JSON.stringify(result).includes("attacker@example.test"));

  const replay = await store.handlers.POST(request(incoming));
  assert.equal(replay.status, 200);
  assert.deepEqual((await replay.json()).agent, result.agent);
  assert.equal(store.saved.size, 1);

  const conflict = await store.handlers.POST(request({ ...incoming, name: "Different Agent" }));
  assert.equal(conflict.status, 409);
  assert.deepEqual(Object.keys(await conflict.json()), ["error"]);
  assert.equal(store.saved.get(agentId).name, "Research Assistant", "Conflicts must not overwrite an existing record.");

  store.setSession({ user: { email: "different-owner@example.test" } });
  const otherOwner = await store.handlers.POST(request(incoming));
  assert.equal(otherOwner.status, 409);
  assert.ok(!JSON.stringify(await otherOwner.json()).includes("owner@example.test"));
});

test("the authenticated list returns a direct no-store array for the session email", async () => {
  const store = workspace();
  const first = await store.handlers.POST(request(details()));
  const saved = (await first.json()).agent;
  const response = await store.handlers.GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), [saved]);
  assert.deepEqual(store.calls.list, [session.user.email]);

  store.setSession({ user: { email: "someone-else@example.test" } });
  assert.deepEqual(await (await store.handlers.GET()).json(), []);
});

test("malformed JSON and non-object bodies return controlled 400s without writing", async () => {
  const { handlers, calls } = workspace();
  const malformed = new Request("http://localhost/api/agent", { method: "POST", body: '{"private":"unterminated' });
  const response = await handlers.POST(malformed);
  assert.equal(response.status, 400);
  assert.deepEqual(Object.keys(await response.json()), ["error"]);
  for (const body of [null, [], "private input", 42]) {
    const rejected = await handlers.POST(request(body));
    assert.equal(rejected.status, 400);
    const data = await rejected.json();
    assert.deepEqual(Object.keys(data).sort(), ["error", "fieldErrors"]);
    assert.ok(!JSON.stringify(data).includes("private input"));
  }
  assert.equal(calls.create.length, 0);
});

test("invalid IDs, empty or oversize names, and invalid instructions never reach the store", async () => {
  const { handlers, calls } = workspace();
  const cases = [
    [{ agentId: "not-a-uuid" }, "agentId"],
    [{ agentId: randomUUID().replace(/-/g, "") }, "agentId"],
    [{ name: " \t\n " }, "name"],
    [{ name: "N".repeat(MAX_AGENT_NAME_LENGTH + 1) }, "name"],
    [{ name: { private: "value" } }, "name"],
    [{ description: "D".repeat(MAX_AGENT_DESCRIPTION_LENGTH + 1) }, "description"],
    [{ description: { private: "value" } }, "description"],
  ];
  for (const [override, field] of cases) {
    const response = await handlers.POST(request(details(override)));
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    const body = await response.json();
    assert.equal(typeof body.fieldErrors[field], "string");
    assert.ok(!JSON.stringify(body).includes("private"));
    assert.ok(!JSON.stringify(body).includes("N".repeat(81)));
    assert.ok(!JSON.stringify(body).includes("D".repeat(1001)));
  }
  assert.equal(calls.create.length, 0);
});

test("avatars accept only the expected DiceBear Gaze URL and safe parameters", async () => {
  const { handlers, calls } = workspace();
  const invalidUrls = [
    "https://example.test/avatar.svg",
    "http://api.dicebear.com/10.x/gaze/svg?seed=safe",
    "https://api.dicebear.com/9.x/gaze/svg?seed=safe",
    "https://api.dicebear.com/10.x/bottts/svg?seed=safe",
    "https://api.dicebear.com/10.x/gaze/svg?seed=safe&backgroundColor=fff",
    "https://api.dicebear.com/10.x/gaze/svg?seed=safe&seed=other",
    "https://api.dicebear.com/10.x/gaze/svg?seed=safe&tags=private",
    "https://api.dicebear.com/10.x/gaze/svg?seed=safe&tags=animation&tags=animation",
    "https://user:password@api.dicebear.com/10.x/gaze/svg?seed=safe",
    "https://api.dicebear.com:444/10.x/gaze/svg?seed=safe",
    "https://api.dicebear.com/10.x/gaze/svg?seed=safe#private",
    "https://api.dicebear.com/10.x/gaze/svg?seed=%20",
    "data:image/svg+xml,<svg/>",
  ];
  for (const agentImage of invalidUrls) {
    const response = await handlers.POST(request(details({ agentImage })));
    assert.equal(response.status, 400, agentImage);
    const body = await response.json();
    assert.equal(typeof body.fieldErrors.agentImage, "string");
    assert.ok(!JSON.stringify(body).includes(agentImage));
  }
  assert.equal(calls.create.length, 0);

  const accepted = await handlers.POST(request(details({ agentImage: "https://api.dicebear.com/10.x/gaze/svg?seed=Safe_seed-1&tags=animation" })));
  assert.equal(accepted.status, 201);
  assert.equal((await accepted.json()).agent.agentImage, getAgentAvatarUrl("Safe_seed-1"));
});

test("boundary-length names and instructions are accepted and blank instructions become null", async () => {
  const { handlers, calls } = workspace();
  const accepted = await handlers.POST(request(details({ name: "N".repeat(MAX_AGENT_NAME_LENGTH), description: "D".repeat(MAX_AGENT_DESCRIPTION_LENGTH) })));
  assert.equal(accepted.status, 201);
  const blank = await handlers.POST(request(details({ description: " \n " })));
  assert.equal(blank.status, 201);
  assert.equal((await blank.json()).agent.description, null);
  const omitted = details();
  delete omitted.description;
  assert.equal((await handlers.POST(request(omitted))).status, 201);
  assert.equal(calls.create[2].input.description, null);
});

test("database and session failures produce sanitized 500 responses and static logs", async (t) => {
  const privateDetail = "postgresql://private-user:private-password@private-db/secret-profile";
  const logged = [];
  t.mock.method(console, "error", (...args) => { logged.push(args.map(String).join(" ")); });
  const failing = createAgentHandlers({
    getSession: async () => session,
    create: async () => { throw new Error(privateDetail); },
    list: async () => { throw new Error(privateDetail); },
  });
  const responses = [await failing.GET(), await failing.POST(request(details()))];
  const sessionFailure = createAgentHandlers({
    getSession: async () => { throw new Error(privateDetail); },
    create: async () => { assert.fail("A failed session must stop writes."); },
    list: async () => { assert.fail("A failed session must stop reads."); },
  });
  responses.push(await sessionFailure.GET(), await sessionFailure.POST(request(details())));
  for (const response of responses) {
    assert.equal(response.status, 500);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    const body = await response.json();
    assert.deepEqual(Object.keys(body), ["error"]);
    assert.ok(!JSON.stringify(body).includes(privateDetail));
    assert.ok(!JSON.stringify(body).includes("private-password"));
    assert.ok(!JSON.stringify(body).includes(session.user.email));
  }
  assert.equal(logged.length, 4);
  assert.ok(logged.every((message) => !message.includes(privateDetail) && !message.includes("private-password")));
});
