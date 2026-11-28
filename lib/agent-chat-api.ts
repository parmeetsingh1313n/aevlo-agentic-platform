import type { Session } from "next-auth";
import type { getAgentForUser } from "@/db/agents";
import type { ExecutableAgent } from "./agent-sdk";
import type { Tool } from "@openai/agents";
import type { AgentReply } from "./agent-response";
import { AgentChatError, readAgentChatBody, validateAgentChatInput, type ChatMessage } from "./agent-chat-validation";

type Dependencies = {
  getSession: () => Promise<Session | null>;
  get: typeof getAgentForUser;
  execute: (agent: ExecutableAgent, messages: ChatMessage[], signal: AbortSignal, tools?: Tool[]) => Promise<AgentReply | string>;
  getTools?: (email: string, agentId: string, signal: AbortSignal) => Promise<Tool[]>;
};
const headers = { "Cache-Control": "no-store" };

export function createAgentChatHandler(dependencies: Dependencies) {
  return async function POST(request: Request) {
    try {
      const session = await dependencies.getSession();
      const email = session?.user?.email?.trim().toLowerCase();
      if (!email) return Response.json({ error: "Sign in to chat with your agent." }, { status: 401, headers });
      const input = validateAgentChatInput(await readAgentChatBody(request));
      if (!input) return Response.json({ error: "Send a valid conversation ending with your message." }, { status: 400, headers });
      const savedAgent = await dependencies.get(email, input.agentId);
      if (!savedAgent) return Response.json({ error: "This agent is unavailable." }, { status: 404, headers });
      const tools = dependencies.getTools ? await dependencies.getTools(email, input.agentId, request.signal) : [];
      const result = await dependencies.execute({ name: savedAgent.name, description: savedAgent.description }, input.messages, request.signal, tools);
      return Response.json(typeof result === "string" ? { response: result } : result, { headers });
    } catch (error) {
      if (error instanceof AgentChatError) return Response.json({ error: error.message, ...(!error.retryable ? { retryable: false } : {}) }, { status: error.status, headers });
      console.error("[agent-chat] Could not complete the chat request.");
      return Response.json({ error: "We couldn’t complete this request. Please try again." }, { status: 500, headers });
    }
  };
}
