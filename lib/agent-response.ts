import { randomUUID } from "node:crypto";
import { AgentChatError } from "./agent-chat-validation";
import { MAX_ASSISTANT_MESSAGE_LENGTH } from "./agent-preview";
import { formatInteractionPrompt, parseQuestionRequest, type AgentInteraction } from "./agent-interaction";

export type AgentReply = { response: string; interaction?: AgentInteraction };

/** Text remains text; only validated clarification envelopes become UI controls. */
export function parseAgentReply(text: string): AgentReply {
  let candidate: unknown;
  const source = text.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/, "$1");
  try { candidate = JSON.parse(source); } catch { /* Ordinary readable text. */ }
  if (candidate && typeof candidate === "object" && !Array.isArray(candidate) && "interaction" in candidate) {
    const envelope = candidate as Record<string, unknown>;
    const interaction = envelope.interaction;
    const parsed = parseQuestionRequest(interaction);
    const response = typeof envelope.response === "string" ? envelope.response.trim() : "";
    if (Object.keys(envelope).some((key) => key !== "response" && key !== "interaction") || !parsed || !response ||
      response.length + formatInteractionPrompt(parsed.questions).length + 2 > MAX_ASSISTANT_MESSAGE_LENGTH) {
      throw new AgentChatError("The agent returned unclear questions. Retry your message.", 502);
    }
    return { response, interaction: { id: randomUUID(), questions: parsed.questions } };
  }
  if (!text.trim() || text.length > MAX_ASSISTANT_MESSAGE_LENGTH) throw new AgentChatError("The model did not return a usable reply. Retry your message.", 502);
  return { response: text };
}
