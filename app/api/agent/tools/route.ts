import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAgentToolsForUser, listToolCatalog, setAgentToolkit } from "@/db/tools";
import { createAgentToolsHandlers } from "@/lib/agent-tools-api";
import { getAgentToolSession, ComposioError } from "@/lib/composio";
import { AgentChatError } from "@/lib/agent-chat-validation";

export const runtime = "nodejs";
export const maxDuration = 60;
const handlers = createAgentToolsHandlers({
  getSession: () => getServerSession(authOptions), get: getAgentToolsForUser, list: listToolCatalog, update: setAgentToolkit,
  configured: () => Boolean(process.env.COMPOSIO_API_KEY?.trim()),
  status: async (agent, email, signal) => {
    const session = await getAgentToolSession(agent, email, signal);
    const states = await session.toolkits({ toolkits: agent.tools, limit: 100 }, { signal });
    return states.items.map((item) => ({ slug: item.slug, connected: item.isNoAuth || Boolean(item.connection?.isActive),
      status: item.isNoAuth ? "NO_AUTH" : item.connection?.connectedAccount?.status ?? "NOT_CONNECTED" }));
  },
  connect: async (agent, email, slug, signal) => {
    try {
      const session = await getAgentToolSession(agent, email, signal);
      const connection = await session.authorize(slug, undefined, { signal });
      if (!connection.redirectUrl) throw new AgentChatError("This service did not provide an authorization link. Check its Composio authentication setup.", 502);
      return connection.redirectUrl;
    } catch (error) {
      if (error instanceof ComposioError) throw new AgentChatError(error.message, error.status);
      throw error;
    }
  },
});
export const GET = handlers.GET;
export const PUT = handlers.PUT;
export const POST = handlers.POST;
