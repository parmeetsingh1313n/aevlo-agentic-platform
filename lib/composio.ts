import "server-only";
import { createHash } from "node:crypto";
import { Composio, OpenAIProvider } from "@composio/core";
import { tool, type FunctionTool } from "@openai/agents";
import { saveAgentToolSession } from "@/db/tools";

export const COMPOSIO_TIMEOUT_MS = 60_000;
export const MAX_TOOL_OUTPUT_LENGTH = 48_000;
type BaseSession = Awaited<ReturnType<Composio<OpenAIProvider>["use"]>>;
// The installed Session interface omits the trailing cancellation arguments
// supported by ToolRouterSession's implementation. Keep that runtime contract.
export type ComposioSession = Omit<BaseSession, "tools" | "execute" | "toolkits" | "authorize"> & {
  tools(modifiers?: Parameters<BaseSession["tools"]>[0], requestOptions?: { signal?: AbortSignal }): ReturnType<BaseSession["tools"]>;
  execute(slug: string, arguments_?: Record<string, unknown>, options?: Parameters<BaseSession["execute"]>[2], requestOptions?: { signal?: AbortSignal }): ReturnType<BaseSession["execute"]>;
  toolkits(options?: Parameters<BaseSession["toolkits"]>[0], requestOptions?: { signal?: AbortSignal }): ReturnType<BaseSession["toolkits"]>;
  authorize(toolkit: string, options?: Parameters<BaseSession["authorize"]>[1], requestOptions?: { signal?: AbortSignal }): ReturnType<BaseSession["authorize"]>;
};
export type AgentToolConfiguration = { agentId: string; tools: string[]; composioSessionId: string | null };
type SaveSession = (email: string, agentId: string, expectedTools: string[], sessionId: string) => Promise<boolean>;
type SessionClient = Pick<Composio<OpenAIProvider>, "create" | "use">;
type ToolSchema = { type: "object"; properties: Record<string, Record<string, unknown>>; required: string[]; additionalProperties: true };
export type ComposioFunctionTool = FunctionTool<unknown, ToolSchema, unknown>;

export class ComposioError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ComposioError";
  }
}

let client: Composio<OpenAIProvider> | undefined;
let configuredKey: string | undefined;

/** Builds/imports without a key; credentials are used only inside server requests. */
export function getComposioClient(): Composio<OpenAIProvider> {
  const apiKey = process.env.COMPOSIO_API_KEY?.trim();
  if (!apiKey) throw new ComposioError("Tool connections are not configured. Add COMPOSIO_API_KEY on the server and restart the app.", 503);
  if (!client || configuredKey !== apiKey) {
    client = new Composio({
      apiKey,
      provider: new OpenAIProvider(),
      allowTracking: false,
      disableVersionCheck: true,
      logLevel: "silent",
      dangerouslyAllowAutoUploadDownloadFiles: false,
    });
    configuredKey = apiKey;
  }
  return client;
}

/** The user scope is stable across agents and never exposes an email to Composio. */
export function composioUserId(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new ComposioError("Sign in to use connected tools.", 401);
  return `aevlo_${createHash("sha256").update(normalized).digest("hex")}`;
}

function stopped(signal: AbortSignal) {
  if (signal.aborted) throw new ComposioError("The tool request was stopped.", 499);
}

function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  // Core wraps transport errors with statusCode; raw API errors use status.
  if ("statusCode" in error && typeof error.statusCode === "number") return error.statusCode;
  if ("status" in error && typeof error.status === "number") return error.status;
  return undefined;
}

function safeError(error: unknown, signal: AbortSignal): ComposioError {
  if (error instanceof ComposioError) return error;
  if (signal.aborted) return new ComposioError("The tool request was stopped or took too long. Retry when ready.", 504);
  const status = errorStatus(error);
  if (status === 401 || status === 403) return new ComposioError("The tool provider rejected the server configuration. Check COMPOSIO_API_KEY.", 503);
  if (status === 429) return new ComposioError("The tool provider is busy or its quota is reached. Try again shortly.", 429);
  return new ComposioError("The tool provider could not complete this request. Try again shortly.", 502);
}

function assertSessionPolicy(session: ComposioSession, userId: string, selected: string[]) {
  if (session.config.user_id !== userId) throw new ComposioError("This tool connection does not belong to your account. Reconnect the selected tools.", 403);
  const policy = session.config.toolkits;
  const enabled = policy && "enabled" in policy ? policy.enabled : undefined;
  if (!enabled || enabled.length !== selected.length || selected.some((slug) => !enabled.includes(slug)) ||
    session.config.manage_connections?.enabled !== false ||
    (session.sandbox ?? session.config.workbench)?.enable !== false || session.config.instant !== false) {
    throw new ComposioError("Your tool selection changed. Refresh the Tools tab before continuing.", 409);
  }
}

/** Call only with an owner-checked database record, never a client-supplied session ID. */
export async function getAgentToolSession(
  agent: AgentToolConfiguration,
  email: string,
  signal: AbortSignal,
  save: SaveSession = saveAgentToolSession,
  sessionClient?: SessionClient,
): Promise<ComposioSession> {
  stopped(signal);
  const selected = [...new Set(agent.tools)];
  // Selection writes validate the active database catalog. Validate only its
  // slug shape here so an administrator can extend that catalog independently.
  if (!selected.length || selected.some((slug) => typeof slug !== "string" || !/^[a-z][a-z0-9_]{1,63}$/.test(slug))) {
    throw new ComposioError("Choose available tools in the Tools tab before connecting.", 409);
  }
  const userId = composioUserId(email);
  const timeout = AbortSignal.timeout(COMPOSIO_TIMEOUT_MS);
  const requestSignal = AbortSignal.any([signal, timeout]);
  try {
    const composio = sessionClient ?? getComposioClient();
    const createSession = () => composio.create(userId, {
        toolkits: selected,
        manageConnections: false,
        sandbox: { enable: false },
        instant: false,
      }, { signal: requestSignal });
    let mustSave = !agent.composioSessionId;
    let session: ComposioSession;
    if (agent.composioSessionId) {
      try { session = await composio.use(agent.composioSessionId, undefined, { signal: requestSignal }); }
      catch (error) {
        const status = errorStatus(error);
        // Replacing an expired policy session is safe; failed app actions are
        // never retried here or by the execution adapter.
        if (status !== 404 && status !== 410) throw error;
        stopped(signal);
        mustSave = true;
        session = await createSession();
      }
    } else session = await createSession();
    assertSessionPolicy(session, userId, selected);
    stopped(signal);
    if (mustSave && !await save(email, agent.agentId, agent.tools, session.sessionId)) {
      throw new ComposioError("Your tool selection changed. Refresh the Tools tab before continuing.", 409);
    }
    return session;
  } catch (error) {
    if (signal.aborted) throw new ComposioError("The tool request was stopped.", 499);
    throw safeError(error, requestSignal);
  }
}

const credentialField = /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|oauth[_-]?token|auth[_-]?token|authorization|password|client[_-]?secret|private[_-]?key|credentials)|^(?:token|secret)$/i;

function redactText(value: string): string {
  let text = value.replace(/\bBearer\s+[^\s"'<>]+/gi, "Bearer [redacted]");
  for (const name of ["COMPOSIO_API_KEY", "AGENT_API_KEY", "NEW_API_KEY"]) {
    const secret = process.env[name]?.trim();
    if (secret && secret.length >= 8) text = text.split(secret).join("[redacted]");
  }
  return text;
}

function sanitizeData(value: unknown, depth = 0): unknown {
  if (depth > 30) return "[content omitted: nesting limit]";
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeData(item, depth + 1));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key, credentialField.test(key) ? "[redacted]" : sanitizeData(item, depth + 1),
  ]));
  return value;
}

/** Keep explicit provider outcomes; a completed meta tool can contain failed nested app calls. */
function serializeResult(result: Awaited<ReturnType<ComposioSession["execute"]>>): string {
  const resultType = result.resultType;
  if (!["completed", "failed", "blocked"].includes(resultType)) {
    throw new ComposioError("The provider returned an unrecognized execution outcome.", 502);
  }
  const data = sanitizeData(result.data);
  const error = resultType === "completed" ? sanitizeData(result.error) ?? null : resultType === "blocked"
    ? "The provider blocked this tool call. No successful action is confirmed."
    : "The provider did not complete this tool call. No successful action is confirmed.";
  const serialized = JSON.stringify({ resultType, data, error });
  if (serialized.length <= MAX_TOOL_OUTPUT_LENGTH) return serialized;
  const partial = {
    resultType,
    error,
    truncated: true,
    note: "The provider output exceeded the conversation limit. This is a partial preview; narrow the next tool query.",
    preview: JSON.stringify(data).slice(0, Math.floor(MAX_TOOL_OUTPUT_LENGTH / 2)),
  };
  // JSON escaping can multiply preview length (for example repeated newlines).
  let bounded = JSON.stringify(partial);
  while (bounded.length > MAX_TOOL_OUTPUT_LENGTH) {
    partial.preview = partial.preview.slice(0, Math.floor(partial.preview.length / 2));
    bounded = JSON.stringify(partial);
  }
  return bounded;
}

/** Convert only server-returned OpenAI schemas; the adapter never invents executable tools. */
export async function adaptSessionTools(session: ComposioSession, signal: AbortSignal): Promise<ComposioFunctionTool[]> {
  stopped(signal);
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(COMPOSIO_TIMEOUT_MS)]);
  let definitions: Awaited<ReturnType<ComposioSession["tools"]>>;
  try { definitions = await session.tools(undefined, { signal: requestSignal }); }
  catch (error) {
    if (signal.aborted) throw new ComposioError("The tool request was stopped.", 499);
    throw safeError(error, requestSignal);
  }
  const names = new Set<string>();
  return definitions.map((definition) => {
    if (definition.type !== "function") throw new ComposioError("The provider returned an unsupported tool definition.", 502);
    const schema = definition.function.parameters;
    const name = definition.function.name;
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(name) || names.has(name) || !schema || schema.type !== "object" ||
      !schema.properties || typeof schema.properties !== "object" || Array.isArray(schema.properties)) {
      throw new ComposioError("The provider returned an invalid tool definition.", 502);
    }
    names.add(name);
    return tool({
      name,
      description: definition.function.description ?? `Execute ${name} through the connected service.`,
      parameters: schema as ToolSchema,
      strict: false,
      errorFunction: null,
      execute: async (arguments_, _context, details) => {
        stopped(signal);
        if (details?.signal) stopped(details.signal);
        if (!arguments_ || typeof arguments_ !== "object" || Array.isArray(arguments_)) {
          return JSON.stringify({ resultType: "failed", error: "Send a valid object of tool arguments." });
        }
        const executionSignal = AbortSignal.any([signal, ...(details?.signal ? [details.signal] : []), AbortSignal.timeout(COMPOSIO_TIMEOUT_MS)]);
        try {
          const result = await session.execute(name, arguments_ as Record<string, unknown>, undefined, { signal: executionSignal });
          return serializeResult(result);
        } catch (error) {
          if (signal.aborted) throw new ComposioError("The tool request was stopped.", 499);
          // A lost response may follow a completed app action. Stop the run so
          // the model cannot repeat that action while trying to recover.
          throw safeError(error, executionSignal);
        }
      },
    });
  });
}
