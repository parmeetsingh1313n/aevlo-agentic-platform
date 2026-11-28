import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { loadModule } from "./helpers/load-ts-module.mjs";

const require = createRequire(import.meta.url);
const { setTraceProcessors, getGlobalTraceProvider, tool } = require("@openai/agents");
const { z } = require("zod");
const { createAgentExecutor } = loadModule("lib/agent-sdk.ts");
const { buildAgentInstructions } = loadModule("lib/agent-behavior.ts");
const { AgentChatError } = loadModule("lib/agent-chat-validation.ts");
const { MAX_ASSISTANT_MESSAGE_LENGTH } = loadModule("lib/agent-preview.ts");
const saved = { name: "Persisted Researcher", description: "Use these persisted instructions. Preserve source distinctions." };
const messages = [{ role: "user", content: "Explain quantum entanglement." }];
const signal = () => new AbortController().signal;
const traces = [];
setTraceProcessors([{
  onTraceStart: async () => { traces.push("trace-start"); },
  onTraceEnd: async () => { traces.push("trace-end"); },
  onSpanStart: async () => { traces.push("span-start"); },
  onSpanEnd: async () => { traces.push("span-end"); },
  shutdown: async () => {}, forceFlush: async () => {},
}]);

function completion(content = "The usable provider reply.", overrides = {}) {
  return { id: "chatcmpl-fixture", object: "chat.completion", created: 1, model: "MiniMax-M3.1-Flash", choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }], usage: { prompt_tokens: 20, completion_tokens: 7, total_tokens: 27 }, ...overrides };
}

function functionCompletion(name, input, callId = "call-fixture") {
  return completion(null, { choices: [{ index: 0, message: { role: "assistant", content: null,
    tool_calls: [{ id: callId, type: "function", function: { name, arguments: JSON.stringify(input) } }],
  }, finish_reason: "tool_calls" }] });
}

function expectTextReply(reply, expected = "The usable provider reply.") {
  assert.equal(reply.response, expected);
  assert.deepEqual(Object.keys(reply), ["response"]);
}

function fixture(respond = async () => Response.json(completion()), options = {}) {
  const requests = [];
  const execute = createAgentExecutor({
    getApiKey: () => " fixture-server-key ",
    fetch: async (input, init) => {
      const incoming = new Request(input, init);
      requests.push({ url: incoming.url, method: incoming.method, headers: incoming.headers, body: JSON.parse(await incoming.text()), signal: init.signal });
      return respond(input, init);
    },
    ...options,
  });
  return { execute, requests };
}

async function expectSafeError(run, status, forbidden = []) {
  await assert.rejects(run, (error) => {
    assert.ok(error instanceof AgentChatError);
    assert.equal(error.status, status);
    for (const detail of forbidden) assert.ok(!error.message.includes(detail), `Error must not expose ${detail}`);
    return true;
  });
}

async function withApiKeyEnvironment(values, run) {
  const names = ["AGENT_API_KEY", "NEW_API_KEY"];
  const original = new Map(names.map((name) => [name, process.env[name]]));
  try {
    for (const name of names) {
      if (values[name] === undefined) delete process.env[name];
      else process.env[name] = values[name];
    }
    return await run();
  } finally {
    for (const name of names) {
      const value = original.get(name);
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

test("real Agents SDK sends full saved-system conversation to only the supplied MiniMax chat endpoint without tracing", async (t) => {
  const fallback = t.mock.method(globalThis, "fetch", () => assert.fail("The SDK must not call a default provider or tracing endpoint."));
  const { execute, requests } = fixture();
  const history = [
    { role: "user", content: "First question." }, { role: "assistant", content: "Previous answer." }, { role: "user", content: " Follow-up with exact whitespace. " },
  ];
  expectTextReply(await execute(saved, history, signal()));
  assert.equal(requests.length, 1);
  const sent = requests[0];
  assert.equal(sent.url, "https://api.hcnsec.cn/v1/chat/completions");
  assert.equal(sent.method, "POST");
  assert.equal(sent.headers.get("authorization"), "Bearer fixture-server-key");
  assert.match(sent.headers.get("content-type"), /application\/json/);
  assert.deepEqual(sent.body.messages, [{ role: "system", content: buildAgentInstructions(saved, { availableTools: [], nativeQuestionTool: true }) },
    ...history.map(({ role, content }) => ({ role, content: [{ type: "text", text: content }] }))]);
  assert.equal(sent.body.model, "MiniMax-M3.1-Flash");
  assert.equal(sent.body.temperature, 0.7);
  assert.equal(sent.body.stream, false);
  assert.equal(sent.body.tools.length, 1);
  assert.equal(sent.body.tools[0].type, "function");
  assert.equal(sent.body.tools[0].function.name, "request_user_input");
  assert.equal(sent.body.tools[0].function.parameters.type, "object");
  assert.ok(sent.body.tools[0].function.parameters.properties.questions);
  for (const unsupported of ["response_format", "reasoning_effort", "verbosity", "conversation", "previous_response_id"]) assert.ok(!(unsupported in sent.body));
  await getGlobalTraceProvider().forceFlush();
  assert.deepEqual(traces, []);
  assert.equal(fallback.mock.callCount(), 0);
});

test("agents without saved instructions retain behavior rules and valid model output retains its exact text", async () => {
  const output = "  A reply with\nintentional formatting.  ";
  const { execute, requests } = fixture(async () => Response.json(completion(output)));
  const unspecialized = { ...saved, description: null };
  expectTextReply(await execute(unspecialized, messages, signal()), output);
  assert.deepEqual(requests[0].body.messages, [{ role: "system", content: buildAgentInstructions(unspecialized, { availableTools: [], nativeQuestionTool: true }) },
    ...messages.map(({ role, content }) => ({ role, content: [{ type: "text", text: content }] }))]);
  assert.match(requests[0].body.messages[0].content, /No specific assignment has been saved/);
});

test("executor construction is key-independent and missing or blank keys fail safely before fetching", async () => {
  for (const key of [undefined, "", " \n\t "]) {
    let keyReads = 0;
    const { execute, requests } = fixture(undefined, { getApiKey: () => { keyReads++; return key; } });
    assert.equal(keyReads, 0, "Importing or building must not require provider configuration.");
    await expectSafeError(() => execute(saved, messages, signal()), 503);
    assert.equal(keyReads, 1);
    assert.equal(requests.length, 0);
  }
  let key;
  const { execute, requests } = fixture(undefined, { getApiKey: () => key });
  await expectSafeError(() => execute(saved, messages, signal()), 503);
  key = "configured-fixture-key";
  expectTextReply(await execute(saved, messages, signal()));
  assert.equal(requests[0].headers.get("authorization"), "Bearer configured-fixture-key");
});

test("default executor prefers the trimmed AGENT_API_KEY over the legacy server key", async () => {
  await withApiKeyEnvironment({ AGENT_API_KEY: " fixture-primary-key ", NEW_API_KEY: "fixture-legacy-key" }, async () => {
    const { execute, requests } = fixture(undefined, { getApiKey: undefined });
    expectTextReply(await execute(saved, messages, signal()));
    assert.equal(requests.length, 1);
    assert.equal(requests[0].headers.get("authorization"), "Bearer fixture-primary-key");
  });
});

test("default executor supports NEW_API_KEY when AGENT_API_KEY is unset or blank", async () => {
  for (const primary of [undefined, "", " \n\t "]) {
    await withApiKeyEnvironment({ AGENT_API_KEY: primary, NEW_API_KEY: " fixture-legacy-key " }, async () => {
      const { execute, requests } = fixture(undefined, { getApiKey: undefined });
      expectTextReply(await execute(saved, messages, signal()));
      assert.equal(requests.length, 1);
      assert.equal(requests[0].headers.get("authorization"), "Bearer fixture-legacy-key");
    });
  }
});

test("default executor rejects absent or blank environment keys before any network request", async () => {
  for (const keys of [{}, { AGENT_API_KEY: " \n\t ", NEW_API_KEY: " " }]) {
    await withApiKeyEnvironment(keys, async () => {
      const { execute, requests } = fixture(undefined, { getApiKey: undefined });
      await expectSafeError(() => execute(saved, messages, signal()), 503);
      assert.equal(requests.length, 0);
    });
  }
});

test("an explicit key getter remains authoritative and never falls back to environment keys", async () => {
  await withApiKeyEnvironment({ AGENT_API_KEY: "fixture-primary-key", NEW_API_KEY: "fixture-legacy-key" }, async () => {
    for (const key of [undefined, "", " \n\t "]) {
      const { execute, requests } = fixture(undefined, { getApiKey: () => key });
      await expectSafeError(() => execute(saved, messages, signal()), 503);
      assert.equal(requests.length, 0);
    }
    const { execute, requests } = fixture(undefined, { getApiKey: () => " fixture-override-key " });
    expectTextReply(await execute(saved, messages, signal()));
    assert.equal(requests.length, 1);
    assert.equal(requests[0].headers.get("authorization"), "Bearer fixture-override-key");
  });
});

test("upstream auth, quota, and server errors are sanitized and never retried or redirected", async (t) => {
  const fallback = t.mock.method(globalThis, "fetch", () => assert.fail("A provider failure cannot fall back to another endpoint."));
  const logged = [];
  t.mock.method(console, "error", (...args) => { logged.push(args.map(String).join(" ")); });
  const privateDetail = "fixture-private-prompt Bearer fixture-private-key";
  for (const [status, expected] of [[401, 503], [403, 503], [429, 429], [400, 502], [500, 502], [503, 502]]) {
    const { execute, requests } = fixture(async () => Response.json({ error: { message: privateDetail, type: "fixture_error", code: "private-code" } }, { status }));
    await expectSafeError(() => execute(saved, messages, signal()), expected, [privateDetail, "fixture-private-key", "fixture-private-prompt", "private-code"]);
    assert.equal(requests.length, 1, "Provider errors must not be retried.");
    assert.equal(requests[0].url, "https://api.hcnsec.cn/v1/chat/completions");
  }
  assert.equal(fallback.mock.callCount(), 0);
  assert.ok(logged.every((line) => !line.includes("fixture-private")));
  assert.deepEqual(traces, []);
});

test("malformed, blank, nontext, and excessive model output fails safely; the output length boundary is accepted", async () => {
  for (const response of [completion(""), completion(" \n\t "), completion(null), completion({ private: "fixture-secret" }), completion(17), completion(["fixture-secret"]), completion("A".repeat(MAX_ASSISTANT_MESSAGE_LENGTH + 1)), completion("unused", { choices: [] }), { private: "fixture-secret" }]) {
    const { execute, requests } = fixture(async () => Response.json(response));
    await expectSafeError(() => execute(saved, messages, signal()), 502, ["fixture-secret"]);
    assert.equal(requests.length, 1);
  }
  const boundary = "A".repeat(MAX_ASSISTANT_MESSAGE_LENGTH);
  const { execute } = fixture(async () => Response.json(completion(boundary)));
  expectTextReply(await execute(saved, messages, signal()), boundary);
});

const questions = [{
  id: "audience", prompt: "Who will read the brief?", mode: "single",
  options: [{ id: "team", label: "My team", description: "Include implementation details." }, { id: "customer", label: "A customer", description: "Use a concise explanation." }],
}];

test("native guided question calls stop the SDK after one model request and return server-identified controls", async () => {
  const { execute, requests } = fixture(async () => Response.json(functionCompletion("request_user_input", { questions })));
  const reply = await execute(saved, [{ role: "user", content: "Prepare a brief from these notes." }], signal());
  assert.equal(requests.length, 1, "A question tool must wait for the user rather than asking the model to continue.");
  assert.equal(reply.response, "A few details will help me continue.");
  assert.match(reply.interaction.id, /^[a-f0-9-]{36}$/);
  assert.deepEqual(JSON.parse(JSON.stringify(reply.interaction.questions)), questions);
  assert.deepEqual(traces, []);
});

test("validated text-envelope questions work without a native function call and malformed questions fail safely", async () => {
  const envelope = { response: "The audience changes the detail level.", interaction: { questions } };
  const { execute, requests } = fixture(async () => Response.json(completion(JSON.stringify(envelope))));
  const reply = await execute(saved, messages, signal());
  assert.equal(requests.length, 1);
  assert.equal(reply.response, envelope.response);
  assert.match(reply.interaction.id, /^[a-f0-9-]{36}$/);
  assert.deepEqual(JSON.parse(JSON.stringify(reply.interaction.questions)), questions);
  for (const invalid of [{ ...envelope, interaction: { id: "model-invented-id", questions } }, { ...envelope, interaction: { questions: [] } }]) {
    const broken = fixture(async () => Response.json(completion(JSON.stringify(invalid))));
    await expectSafeError(() => broken.execute(saved, messages, signal()), 502, ["model-invented-id"]);
    assert.equal(broken.requests.length, 1);
  }
});

test("external function results enter the SDK conversation before the model produces its final answer", async () => {
  const calls = [];
  const lookup = tool({
    name: "lookup_fixture", description: "Read a harmless fixture status.", parameters: z.object({ item: z.string() }),
    execute: async ({ item }) => { calls.push(item); return "AEVLO_FIXTURE_STATUS_READY"; },
  });
  let turn = 0;
  const { execute, requests } = fixture(async () => Response.json(turn++ === 0
    ? functionCompletion(lookup.name, { item: "brief" }, "call-lookup")
    : completion("The brief is ready, according to the lookup.")));
  expectTextReply(await execute(saved, messages, signal(), [lookup]), "The brief is ready, according to the lookup.");
  assert.deepEqual(calls, ["brief"]);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0].body.tools.map(({ function: definition }) => definition.name), [lookup.name, "request_user_input"]);
  assert.match(requests[0].body.messages[0].content, /Server-verified executable tools available/);
  assert.match(requests[0].body.messages[0].content, /lookup_fixture/);
  const toolResult = requests[1].body.messages.find((message) => message.role === "tool");
  assert.equal(toolResult.tool_call_id, "call-lookup");
  assert.match(JSON.stringify(toolResult.content), /AEVLO_FIXTURE_STATUS_READY/);
});

test("a model that repeatedly calls an external tool stops after the bounded eight-turn run", async () => {
  let calls = 0;
  const lookup = tool({
    name: "bounded_lookup", description: "Read a harmless fixture status.", parameters: z.object({ item: z.string() }),
    execute: async () => { calls++; return "Fixture read complete."; },
  });
  const { execute, requests } = fixture(async () => Response.json(functionCompletion(lookup.name, { item: "brief" }, `call-${calls}`)));
  await expectSafeError(() => execute(saved, messages, signal(), [lookup]), 502);
  assert.equal(requests.length, 8, "A tool loop cannot incur unbounded model requests.");
  assert.equal(calls, 8);
});

test("request cancellation reaches the real OpenAI transport and returns the stopped status without a retry", async () => {
  const controller = new AbortController();
  let transportSignal;
  const { execute, requests } = fixture(async (_input, init) => {
    transportSignal = init.signal;
    controller.abort();
    assert.equal(transportSignal.aborted, true);
    throw new DOMException("fixture-private-abort-detail", "AbortError");
  });
  await expectSafeError(() => execute(saved, messages, controller.signal), 499, ["fixture-private-abort-detail"]);
  assert.equal(requests.length, 1);
  assert.equal(transportSignal.aborted, true);
  const preAborted = new AbortController();
  preAborted.abort();
  const untouched = fixture();
  await expectSafeError(() => untouched.execute(saved, messages, preAborted.signal), 499);
  assert.equal(untouched.requests.length, 0);
});

test("provider transport timeout receives a safe timeout response without leaking its cause", async () => {
  const OpenAI = require("openai").default;
  const { execute, requests } = fixture(async () => { throw new OpenAI.APIConnectionTimeoutError({ message: "fixture-private-timeout-detail" }); });
  await expectSafeError(() => execute(saved, messages, signal()), 504, ["fixture-private-timeout-detail"]);
  assert.equal(requests.length, 1);
});
