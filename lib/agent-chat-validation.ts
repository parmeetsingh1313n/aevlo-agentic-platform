import { isAgentId } from "./agent-validation";
import { MAX_ASSISTANT_MESSAGE_LENGTH, MAX_CHAT_HISTORY_LENGTH, MAX_PREVIEW_MESSAGE_LENGTH, MAX_PREVIEW_MESSAGES } from "./agent-preview";

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type AgentChatInput = { agentId: string; messages: ChatMessage[] };
export const MAX_CHAT_REQUEST_BYTES = 400_000;

export class AgentChatError extends Error {
  constructor(message: string, readonly status: number, readonly retryable = true) {
    super(message);
    this.name = "AgentChatError";
  }
}

export function validateAgentChatInput(body: unknown): AgentChatInput | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const input = body as Record<string, unknown>;
  const agentId = typeof input.agentId === "string" ? input.agentId.trim().toLowerCase() : "";
  if (!isAgentId(agentId) || !Array.isArray(input.messages)) return null;
  const history = input.messages;
  // Completed alternating turns, followed by exactly one unanswered user message.
  if (!history.length || history.length >= MAX_PREVIEW_MESSAGES || history.length % 2 !== 1) return null;
  const messages: ChatMessage[] = [];
  let length = 0;
  for (const [index, value] of history.entries()) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const message = value as Record<string, unknown>;
    const role = index % 2 === 0 ? "user" : "assistant";
    const limit = role === "user" ? MAX_PREVIEW_MESSAGE_LENGTH : MAX_ASSISTANT_MESSAGE_LENGTH;
    if (message.role !== role || typeof message.content !== "string" || !message.content.trim() || message.content.length > limit) return null;
    length += message.content.length;
    if (length > MAX_CHAT_HISTORY_LENGTH - MAX_ASSISTANT_MESSAGE_LENGTH) return null;
    messages.push({ role, content: message.content });
  }
  return { agentId, messages };
}

/** Enforce a real body limit even when Content-Length is missing or inaccurate. */
export async function readAgentChatBody(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (declaredLength > MAX_CHAT_REQUEST_BYTES) throw new AgentChatError("This conversation is too large. Start a new conversation.", 413);
  if (!request.body) throw new AgentChatError("Send a valid conversation.", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_CHAT_REQUEST_BYTES) {
        await reader.cancel();
        throw new AgentChatError("This conversation is too large. Start a new conversation.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new AgentChatError("Send a valid conversation.", 400); }
}
