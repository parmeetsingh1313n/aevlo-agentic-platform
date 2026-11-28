import { getServerSession } from "next-auth";
import { getAgentForUser } from "@/db/agents";
import { createAgentChatHandler } from "@/lib/agent-chat-api";
import { executeAgentChat } from "@/lib/agent-sdk";
import { authOptions } from "@/lib/auth";
import { getAgentToolsForUser, listToolCatalog } from "@/db/tools";
import { adaptSessionTools, ComposioError, getAgentToolSession } from "@/lib/composio";
import { AgentChatError } from "@/lib/agent-chat-validation";

export const runtime = "nodejs";
export const maxDuration = 180;
export const POST = createAgentChatHandler({
  getSession: () => getServerSession(authOptions),
  get: getAgentForUser,
  execute: executeAgentChat,
  getTools: async (email, agentId, signal) => {
    const agent = await getAgentToolsForUser(email, agentId);
    if (!agent) throw new AgentChatError("This agent is unavailable.", 404);
    if (!agent.tools.length) return [];
    const catalog = await listToolCatalog();
    if (agent.tools.some((slug) => !catalog.some((tool) => tool.slug === slug && tool.isActive))) {
      throw new AgentChatError("One of this agent’s tools is unavailable. Disable it in Tools before continuing.", 503);
    }
    try {
      const session = await getAgentToolSession(agent, email, signal);
      return await adaptSessionTools(session, signal);
    } catch (error) {
      if (error instanceof ComposioError) throw new AgentChatError(error.message, error.status);
      throw error;
    }
  },
});
