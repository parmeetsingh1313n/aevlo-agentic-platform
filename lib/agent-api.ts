import type { Session } from "next-auth";
import type { createAgent, listAgentsForUser } from "@/db/agents";
import { AgentConflictError, validateCreateAgentInput } from "./agent-validation";

type Dependencies = {
  getSession: () => Promise<Session | null>;
  create: typeof createAgent;
  list: typeof listAgentsForUser;
};
const headers = { "Cache-Control": "no-store" };

export function createAgentHandlers(dependencies: Dependencies) {
  return {
    async GET() {
      try {
        const session = await dependencies.getSession();
        const email = session?.user?.email?.trim();
        if (!email) return Response.json({ error: "Sign in to see your agents." }, { status: 401, headers });
        return Response.json(await dependencies.list(email), { headers });
      } catch {
        console.error("[agents] Could not load the agent list.");
        return Response.json({ error: "We couldn’t load your agents. Please try again." }, { status: 500, headers });
      }
    },
    async POST(request: Request) {
      try {
        const session = await dependencies.getSession();
        const email = session?.user?.email?.trim();
        if (!email) return Response.json({ error: "Sign in to create an agent." }, { status: 401, headers });
        let body: unknown;
        try { body = await request.json(); }
        catch { return Response.json({ error: "Send valid agent details." }, { status: 400, headers }); }
        const result = validateCreateAgentInput(body);
        if (!result.ok) return Response.json({ error: "Check your agent details.", fieldErrors: result.fieldErrors }, { status: 400, headers });
        const saved = await dependencies.create(result.value, { email, name: session?.user?.name });
        return Response.json({ message: "Agent saved to your workspace.", agent: saved.agent }, { status: saved.created ? 201 : 200, headers });
      } catch (error) {
        if (error instanceof AgentConflictError) return Response.json({ error: "This creation request is already in use. Refresh the form and try again." }, { status: 409, headers });
        console.error("[agents] Could not save the agent.");
        return Response.json({ error: "We couldn’t save your agent. Please try again." }, { status: 500, headers });
      }
    },
  };
}
