import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as composioCore from "@composio/core";
import { RunContext } from "@openai/agents";
import { loadModule } from "./helpers/load-ts-module.mjs";

const filename = resolve("lib/composio.ts");
const nativeRequire = createRequire(import.meta.url);
const targetModule = { exports: {} };
const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  fileName: filename,
});
// The ESM-only Composio package is imported as shipped; database writes are
// injected so policy and execution tests never touch a user's live records.
runInNewContext(compiled.outputText, {
  module: targetModule, exports: targetModule.exports, process, AbortSignal,
  require: (name) => {
    if (name === "server-only") return {};
    if (name === "@composio/core") return composioCore;
    if (name === "@/db/tools") return { saveAgentToolSession: () => assert.fail("Inject the database save callback.") };
    return nativeRequire(name);
  },
}, { filename });
const { composioUserId, getComposioClient, getAgentToolSession, adaptSessionTools, ComposioError, MAX_TOOL_OUTPUT_LENGTH } = targetModule.exports;
const agent = { agentId: "fixture-agent", tools: ["github"], composioSessionId: null };
const email = "fixture@example.test";
const signal = () => new AbortController().signal;
const clone = (value) => JSON.parse(JSON.stringify(value));

function session(overrides = {}) {
  return {
    sessionId: "session_fixture",
    config: { user_id: composioUserId(email), toolkits: { enabled: ["github"] }, manage_connections: { enabled: false }, instant: false, workbench: { enable: false } },
    sandbox: { enable: false },
    tools: async () => [{ type: "function", function: { name: "COMPOSIO_SEARCH_TOOLS", description: "Search connected toolkit tools.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false } } }],
    execute: async () => ({ resultType: "completed", data: { found: true }, error: null, logId: "log-fixture" }),
    ...overrides,
  };
}

function fixture(value = session()) {
  const calls = [];
  return {
    calls,
    client: {
      create: async (...args) => { calls.push(["create", ...args]); return value; },
      use: async (...args) => { calls.push(["use", ...args]); return value; },
    },
    save: async (...args) => { calls.push(["save", ...args]); return true; },
  };
}

async function safeFailure(run, status, forbidden = []) {
  await assert.rejects(run, (error) => {
    assert.ok(error instanceof ComposioError);
    assert.equal(error.status, status);
    for (const text of forbidden) assert.ok(!error.message.includes(text));
    return true;
  });
}

test("Composio user identities are stable, normalized, private, and never use a shared default", () => {
  const id = composioUserId(email);
  assert.equal(id, composioUserId("  FIXTURE@EXAMPLE.TEST "));
  assert.match(id, /^aevlo_[a-f0-9]{64}$/);
  assert.ok(!id.includes(email));
  assert.notEqual(id, composioUserId("another@example.test"));
  assert.throws(() => composioUserId("  "), (error) => error instanceof ComposioError && error.status === 401);
});

test("client creation is lazy and missing keys fail without initializing tracking or making requests", () => {
  const original = process.env.COMPOSIO_API_KEY;
  try {
    for (const key of [undefined, "", "  "]) {
      if (key === undefined) delete process.env.COMPOSIO_API_KEY;
      else process.env.COMPOSIO_API_KEY = key;
      assert.throws(() => getComposioClient(), (error) => error instanceof ComposioError && error.status === 503);
    }
    process.env.COMPOSIO_API_KEY = "fixture-composio-key";
    const configured = getComposioClient();
    assert.equal(getComposioClient(), configured);
    const config = configured.getConfig();
    assert.equal(config.allowTracking, false);
    assert.equal(config.disableVersionCheck, true);
    assert.equal(config.logLevel, "silent");
    assert.equal(config.dangerouslyAllowAutoUploadDownloadFiles, false);
  } finally {
    if (original === undefined) delete process.env.COMPOSIO_API_KEY;
    else process.env.COMPOSIO_API_KEY = original;
  }
});

test("a new session restricts selected services and stores its ID only after validating the returned owner and policy", async () => {
  const f = fixture();
  const incoming = signal();
  const result = await getAgentToolSession(agent, email, incoming, f.save, f.client);
  assert.equal(result.sessionId, "session_fixture");
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[0][0], "create");
  assert.equal(f.calls[0][1], composioUserId(email));
  assert.deepEqual(clone(f.calls[0][2]), { toolkits: ["github"], manageConnections: false, sandbox: { enable: false }, instant: false });
  assert.ok(f.calls[0][3].signal instanceof AbortSignal);
  assert.deepEqual(clone(f.calls[1]), ["save", email, agent.agentId, ["github"], "session_fixture"]);
});

test("a saved session is reused and validated without creating or saving another session", async () => {
  const f = fixture();
  await getAgentToolSession({ ...agent, composioSessionId: "saved-session" }, email, signal(), f.save, f.client);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0][0], "use");
  assert.equal(f.calls[0][1], "saved-session");
  assert.equal(f.calls[0][2], undefined);
  assert.ok(f.calls[0][3].signal instanceof AbortSignal);
});

test("an expired saved session is replaced with the same restricted policy; other retrieval failures cannot create another session", async () => {
  for (const error of [404, 410].flatMap((status) => [
    Object.assign(new Error("expired-private-detail"), { status }),
    new composioCore.ComposioError("expired-private-detail", { statusCode: status }),
  ])) {
    const f = fixture();
    f.client.use = async (...args) => { f.calls.push(["use", ...args]); throw error; };
    await getAgentToolSession({ ...agent, composioSessionId: "expired-session" }, email, signal(), f.save, f.client);
    assert.deepEqual(f.calls.map((call) => call[0]), ["use", "create", "save"]);
    assert.deepEqual(clone(f.calls[1][2]), { toolkits: ["github"], manageConnections: false, sandbox: { enable: false }, instant: false });
  }
  for (const error of [Object.assign(new Error("private-detail"), { status: 500 }), new composioCore.ComposioError("private-detail", { statusCode: 500 })]) {
    const f = fixture();
    f.client.use = async (...args) => { f.calls.push(["use", ...args]); throw error; };
    await safeFailure(() => getAgentToolSession({ ...agent, composioSessionId: "saved-session" }, email, signal(), f.save, f.client), 502, ["private-detail"]);
    assert.equal(f.calls.length, 1);
  }
});

test("empty, malformed, unowned, changed, or unrestricted sessions cannot become executable", async () => {
  for (const selected of [[], ["not a slug"]]) {
    const f = fixture();
    await safeFailure(() => getAgentToolSession({ ...agent, tools: selected }, email, signal(), f.save, f.client), 409);
    assert.equal(f.calls.length, 0);
  }
  const base = session();
  const variants = [
    [session({ config: { ...base.config, user_id: composioUserId("different@example.test") } }), 403],
    [session({ config: { ...base.config, toolkits: { enabled: ["github", "gmail"] } } }), 409],
    [session({ config: { ...base.config, toolkits: { disabled: [] } } }), 409],
    [session({ config: { ...base.config, manage_connections: { enabled: true } } }), 409],
    [session({ config: { ...base.config, instant: {} } }), 409],
    [session({ sandbox: { enable: true } }), 409],
  ];
  for (const [value, status] of variants) {
    const f = fixture(value);
    await safeFailure(() => getAgentToolSession(agent, email, signal(), f.save, f.client), status);
    assert.equal(f.calls.length, 1, "An invalid returned session cannot be stored.");
  }
});

test("a concurrent toolkit change rejects the session instead of inheriting an outdated access policy", async () => {
  const f = fixture();
  await safeFailure(() => getAgentToolSession(agent, email, signal(), async () => false, f.client), 409);
  assert.equal(f.calls.length, 1);
});

test("session cancellation, provider rejection, and quota failures are bounded and sanitized", async () => {
  const before = new AbortController();
  before.abort();
  const f = fixture();
  await safeFailure(() => getAgentToolSession(agent, email, before.signal, f.save, f.client), 499);
  assert.equal(f.calls.length, 0);
  for (const [status, expected] of [[401, 503], [403, 503], [429, 429], [500, 502]]) {
    for (const error of [Object.assign(new Error("private-api-key private-prompt"), { status }),
      new composioCore.ComposioError("private-api-key private-prompt", { statusCode: status })]) {
      const broken = { create: async () => { throw error; } };
      await safeFailure(() => getAgentToolSession(agent, email, signal(), f.save, broken), expected, ["private-api-key", "private-prompt"]);
    }
  }
});

test("the real Agents SDK adapter uses only returned schemas and executes exactly the called function once", async () => {
  const calls = [];
  const value = session({
    execute: async (...args) => { calls.push(args); return { resultType: "completed", data: { records: 2, nested: { successful: false, reason: "App call failed" }, access_token: "fixture-secret", note: "Bearer fixture-secret" }, error: null }; },
  });
  const [executable] = await adaptSessionTools(value, signal());
  assert.equal(executable.name, "COMPOSIO_SEARCH_TOOLS");
  assert.equal(executable.strict, false);
  assert.deepEqual(clone(executable.parameters), { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false });
  const result = JSON.parse(await executable.invoke(new RunContext(), JSON.stringify({ query: "Find open issues" })));
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "COMPOSIO_SEARCH_TOOLS");
  assert.deepEqual(calls[0][1], { query: "Find open issues" });
  assert.equal(calls[0][2], undefined);
  assert.ok(calls[0][3].signal instanceof AbortSignal);
  assert.equal(result.resultType, "completed");
  assert.equal(result.data.nested.successful, false);
  assert.equal(result.data.access_token, "[redacted]");
  assert.equal(result.data.note, "Bearer [redacted]");
  assert.ok(!JSON.stringify(result).includes("fixture-secret"));
});

test("returned failed and blocked outcomes with empty errors remain failures; thrown provider details stay private", async () => {
  for (const outcome of ["failed", "blocked"]) {
    const [executable] = await adaptSessionTools(session({ execute: async () => ({ resultType: outcome, data: null, error: "" }) }), signal());
    const result = JSON.parse(await executable.invoke(new RunContext(), '{"query":"test"}'));
    assert.equal(result.resultType, outcome);
    assert.match(result.error, /No successful action is confirmed/);
  }
  const [broken] = await adaptSessionTools(session({ execute: async () => { throw new Error("private-provider-credential"); } }), signal());
  await safeFailure(() => broken.invoke(new RunContext(), '{"query":"test"}'), 502, ["private-provider-credential"]);
  const [withWarning] = await adaptSessionTools(session({ execute: async () => ({ resultType: "completed", data: null, error: "The app returned no records." }) }), signal());
  assert.equal(JSON.parse(await withWarning.invoke(new RunContext(), '{"query":"test"}')).error, "The app returned no records.");
});

test("cancellation during tool discovery stops the request and does not expose provider errors", async () => {
  const controller = new AbortController();
  await safeFailure(() => adaptSessionTools(session({ tools: async (_modifiers, requestOptions) => {
    controller.abort();
    assert.equal(requestOptions.signal.aborted, true);
    throw new Error("private-provider-abort-detail");
  } }), controller.signal), 499, ["private-provider-abort-detail"]);
});

test("the Agents invocation deadline reaches the external request in addition to the HTTP signal", async () => {
  const controller = new AbortController();
  let requestSignal;
  const [executable] = await adaptSessionTools(session({ execute: async (_name, _args, _options, requestOptions) => {
    requestSignal = requestOptions.signal;
    controller.abort();
    assert.equal(requestSignal.aborted, true);
    throw new Error("private-deadline-detail");
  } }), signal());
  await safeFailure(() => executable.invoke(new RunContext(), '{"query":"test"}', { signal: controller.signal }), 504, ["private-deadline-detail"]);
  assert.equal(requestSignal.aborted, true);
});

test("unknown external outcomes stop the real SDK before another model request or duplicate action", async () => {
  const { createAgentExecutor } = loadModule("lib/agent-sdk.ts");
  const { AgentChatError } = loadModule("lib/agent-chat-validation.ts");
  for (const outcome of ["lost-response", "unrecognized-outcome"]) {
    let executions = 0;
    let requests = 0;
    const tools = await adaptSessionTools(session({ execute: async () => {
      executions++;
      if (outcome === "lost-response") throw new Error("private-provider-credential");
      return { resultType: "unknown", data: null, error: "private-provider-credential" };
    } }), signal());
    const execute = createAgentExecutor({
      getApiKey: () => "fixture-server-key",
      fetch: async () => {
        requests++;
        return Response.json({ id: "chatcmpl-fixture", object: "chat.completion", created: 1, model: "MiniMax-M3.1-Flash",
          choices: [{ index: 0, message: { role: "assistant", content: null, tool_calls: [{ id: `call-${requests}`, type: "function",
            function: { name: "COMPOSIO_SEARCH_TOOLS", arguments: '{"query":"test"}' } }] }, finish_reason: "tool_calls" }] });
      },
    });
    await assert.rejects(() => execute({ name: "Fixture agent", description: null }, [{ role: "user", content: "Run the fixture action." }], signal(), tools), (error) => {
      assert.ok(error instanceof AgentChatError);
      assert.equal(error.status, 502);
      assert.equal(error.retryable, false);
      assert.match(error.message, /Check its result before repeating/);
      assert.ok(!error.message.includes("private-provider-credential"));
      return true;
    });
    assert.equal(requests, 1, "An uncertain external outcome must not return to the model for recovery.");
    assert.equal(executions, 1, "The model cannot repeat an action whose result was lost or unrecognized.");
  }
});

test("oversized tool output stays valid bounded JSON and clearly identifies a partial preview", async () => {
  for (const text of ["x".repeat(120_000), "\n\u0001\"".repeat(60_000)]) {
    const [executable] = await adaptSessionTools(session({ execute: async () => ({ resultType: "completed", data: { content: text }, error: null }) }), signal());
    const result = await executable.invoke(new RunContext(), '{"query":"test"}');
    assert.ok(result.length <= MAX_TOOL_OUTPUT_LENGTH);
    assert.equal(JSON.parse(result).truncated, true);
    assert.match(JSON.parse(result).note, /partial preview/);
  }
});

test("unsupported, duplicate, or malformed tool definitions fail before any execution", async () => {
  const original = (await session().tools())[0];
  for (const definitions of [
    [{ type: "custom", name: "unknown" }],
    [original, original],
    [{ ...original, function: { ...original.function, name: "x".repeat(65) } }],
    [{ ...original, function: { ...original.function, parameters: { type: "array" } } }],
  ]) {
    await safeFailure(() => adaptSessionTools(session({ tools: async () => definitions }), signal()), 502);
  }
});
