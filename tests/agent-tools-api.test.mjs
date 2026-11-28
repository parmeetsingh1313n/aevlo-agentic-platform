import assert from "node:assert/strict";
import test from "node:test";
import { loadModule } from "./helpers/load-ts-module.mjs";
const { createAgentToolsHandlers } = loadModule("lib/agent-tools-api.ts");
const id = "11111111-1111-4111-8111-111111111111";
const agent = { agentId: id, tools: ["github"], composioSessionId: "private-session" };
const catalog = [{ name: "GitHub", slug: "github", description: "Work with code", category: "Development", isActive: true }];
const req = (method = "GET", body = {}) => new Request("http://localhost/api/agent/tools?agentId=" + id, { method, ...(method === "GET" ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify({ agentId: id, slug: "github", ...body }) }) });
function fixture(overrides = {}) {
  const calls = [];
  const handlers = createAgentToolsHandlers({
    getSession: async () => ({ user: { email: " Owner@Example.test " } }),
    get: async (...args) => { calls.push(["get", ...args]); return agent; }, list: async () => catalog,
    update: async (...args) => { calls.push(["update", ...args]); return { ...agent, tools: [] }; }, configured: () => true,
    status: async (...args) => { calls.push(["status", ...args]); return [{ slug: "github", connected: true, status: "ACTIVE" }]; },
    connect: async (...args) => { calls.push(["connect", ...args]); return "https://backend.composio.dev/connect/fixture"; },
    ...overrides,
  });
  return { handlers, calls };
}
test("tool routes authorize before reading bodies or accessing database/provider", async () => {
  const { handlers, calls } = fixture({ getSession: async () => null });
  for (const method of ["GET", "PUT", "POST"]) assert.equal((await handlers[method](req(method))).status, 401);
  assert.deepEqual(calls, []);
});
test("tool status projects catalog and verified state without private session/config fields", async () => {
  const { handlers, calls } = fixture();
  const response = await handlers.GET(req());
  const body = await response.json();
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(body.tools[0].enabled, true); assert.equal(body.tools[0].connected, true);
  assert.deepEqual(calls[0], ["get", "owner@example.test", id]);
  assert.ok(!JSON.stringify(body).includes("private-session"));
});
test("unknown owners never reach any provider or mutation", async () => {
  const { handlers, calls } = fixture({ get: async () => null });
  for (const method of ["GET", "PUT", "POST"]) assert.equal((await handlers[method](req(method, { enabled: true }))).status, 404);
  assert.deepEqual(calls, []);
});
test("tool updates require a catalog slug and boolean, ignoring forged session/owner", async () => {
  const { handlers, calls } = fixture();
  for (const body of [{ slug: "invented", enabled: true }, { enabled: "true" }]) assert.equal((await handlers.PUT(req("PUT", body))).status, 400);
  const response = await handlers.PUT(req("PUT", { enabled: false, userEmail: "attacker", composioSessionId: "forged" }));
  assert.equal(response.status, 200);
  assert.deepEqual(calls.find((call) => call[0] === "update"), ["update", "owner@example.test", id, "github", false]);
});
test("connections require enabled toolkit and configured key; unsafe links never reach UI", async () => {
  for (const overrides of [{ get: async () => ({ ...agent, tools: [] }) }, { configured: () => false }]) {
    const { handlers, calls } = fixture(overrides);
    assert.ok((await handlers.POST(req("POST"))).status >= 400);
    assert.ok(!calls.some((call) => call[0] === "connect"));
  }
  for (const url of ["javascript:alert(1)", "http://example.test", "https://user:secret@example.test/"]) {
    const { handlers } = fixture({ connect: async () => url });
    const response = await handlers.POST(req("POST"));
    assert.equal(response.status, 502);
    assert.ok(!(await response.text()).includes(url));
  }
});
test("provider status failures are honest and preserve editable tool catalog", async () => {
  const { handlers } = fixture({ status: async () => { throw new Error("private provider credential"); } });
  const body = await (await handlers.GET(req())).json();
  assert.equal(body.tools[0].connectionStatus, "UNKNOWN"); assert.equal(body.tools[0].connected, false);
  assert.match(body.connectionError, /unavailable/); assert.ok(!JSON.stringify(body).includes("credential"));
});
