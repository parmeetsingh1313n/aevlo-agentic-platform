import type { Session } from "next-auth";
import { isAgentId } from "./agent-validation";
import { AgentChatError, readAgentChatBody } from "./agent-chat-validation";
import type { ToolCatalogItem } from "./tool-catalog";

type ToolAgent = { agentId: string; tools: string[]; composioSessionId: string | null };
type Dependencies = {
  getSession: () => Promise<Session | null>;
  get: (email: string, agentId: string) => Promise<ToolAgent | null>;
  list: () => Promise<ToolCatalogItem[]>;
  update: (email: string, agentId: string, slug: string, enabled: boolean) => Promise<ToolAgent | null>;
  configured: () => boolean;
  status: (agent: ToolAgent, email: string, signal: AbortSignal) => Promise<{ slug: string; connected: boolean; status: string }[]>;
  connect: (agent: ToolAgent, email: string, slug: string, signal: AbortSignal) => Promise<string>;
};
const headers = { "Cache-Control": "no-store" };

export function createAgentToolsHandlers(deps: Dependencies) {
  async function handle(request: Request, method: "GET" | "PUT" | "POST") {
    try {
      const email = (await deps.getSession())?.user?.email?.trim().toLowerCase();
      if (!email) return Response.json({ error: "Sign in to manage tools." }, { status: 401, headers });
      const body: unknown = method === "GET" ? { agentId: new URL(request.url).searchParams.get("agentId") } : await readAgentChatBody(request);
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new AgentChatError("Choose a valid agent and tool.", 400);
      const input = body as Record<string, unknown>;
      const agentId = typeof input.agentId === "string" ? input.agentId.trim().toLowerCase() : "";
      if (!isAgentId(agentId)) throw new AgentChatError("Choose a valid agent.", 400);
      const agent = await deps.get(email, agentId);
      if (!agent) throw new AgentChatError("This agent is unavailable.", 404);
      const signal = AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]);
      if (method === "GET") {
        const catalog = await deps.list();
        let states: Awaited<ReturnType<Dependencies["status"]>> = [];
        let connectionError = "";
        if (deps.configured() && agent.tools.length) {
          try { states = await deps.status(agent, email, signal); }
          catch { connectionError = "Connection status is unavailable. Refresh to check again."; }
        }
        return Response.json({ configured: deps.configured(), connectionError, tools: catalog.map((tool) => {
          const state = states.find((item) => item.slug === tool.slug);
          return { ...tool, enabled: agent.tools.includes(tool.slug), connected: state?.connected ?? false,
            connectionStatus: state?.status ?? (connectionError ? "UNKNOWN" : "NOT_CONNECTED") };
        }) }, { headers });
      }
      const slug = typeof input.slug === "string" ? input.slug.trim() : "";
      const catalog = await deps.list();
      if (!catalog.some((tool) => tool.slug === slug && (tool.isActive || (method === "PUT" && input.enabled === false)))) throw new AgentChatError("Choose an available tool.", 400);
      if (method === "PUT") {
        if (typeof input.enabled !== "boolean") throw new AgentChatError("Choose whether this tool is enabled.", 400);
        const updated = await deps.update(email, agentId, slug, input.enabled);
        if (!updated) throw new AgentChatError("This agent or tool is unavailable.", 404);
        return Response.json({ tools: updated.tools }, { headers });
      }
      if (!agent.tools.includes(slug)) throw new AgentChatError("Enable this tool for your agent before connecting it.", 400);
      if (!deps.configured()) throw new AgentChatError("Add COMPOSIO_API_KEY on the server and restart the app to connect tools.", 503);
      const redirectUrl = await deps.connect(agent, email, slug, signal);
      const url = new URL(redirectUrl);
      if (url.protocol !== "https:" || url.username || url.password) throw new AgentChatError("The service did not return a usable connection link.", 502);
      return Response.json({ redirectUrl: url.href }, { headers });
    } catch (error) {
      if (error instanceof AgentChatError) return Response.json({ error: error.message }, { status: error.status, headers });
      return Response.json({ error: "We couldn’t complete the tool request. Try again." }, { status: 502, headers });
    }
  }
  return { GET: (request: Request) => handle(request, "GET"), PUT: (request: Request) => handle(request, "PUT"), POST: (request: Request) => handle(request, "POST") };
}
