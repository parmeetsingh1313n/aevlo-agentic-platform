import { getServerSession } from "next-auth";
import { createAgent, getAgentForUser, listAgentsForUser, updateAgentForUser } from "@/db/agents";
import { createAgentHandlers } from "@/lib/agent-api";
import { authOptions } from "@/lib/auth";

const handlers = createAgentHandlers({
  getSession: () => getServerSession(authOptions),
  create: createAgent,
  list: listAgentsForUser,
  get: getAgentForUser,
  update: updateAgentForUser,
});

export const GET = handlers.GET;
export const POST = handlers.POST;
export const PUT = handlers.PUT;
