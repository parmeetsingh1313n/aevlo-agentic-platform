import { getServerSession } from "next-auth";
import { createAgent, listAgentsForUser } from "@/db/agents";
import { createAgentHandlers } from "@/lib/agent-api";
import { authOptions } from "@/lib/auth";

const handlers = createAgentHandlers({
  getSession: () => getServerSession(authOptions),
  create: createAgent,
  list: listAgentsForUser,
});

export const GET = handlers.GET;
export const POST = handlers.POST;
