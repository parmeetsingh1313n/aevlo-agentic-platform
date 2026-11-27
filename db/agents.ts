import { and, desc, eq } from "drizzle-orm";
import { db, agentConfig, users } from "@/db";
import { AgentConflictError, isAgentId, type CreateAgentInput } from "@/lib/agent-validation";

type AgentDatabase = Pick<typeof db, "insert" | "select">;
export type AgentOwner = { email: string; name?: string | null };

export async function listAgentsForUser(email: string, database: AgentDatabase = db) {
  return database.select().from(agentConfig)
    .where(eq(agentConfig.userEmail, email.trim().toLowerCase()))
    .orderBy(desc(agentConfig.createdAt), desc(agentConfig.id));
}

export async function getAgentForUser(email: string, agentId: string, database: AgentDatabase = db) {
  if (!isAgentId(agentId)) return null;
  const [agent] = await database.select().from(agentConfig)
    .where(and(eq(agentConfig.userEmail, email.trim().toLowerCase()), eq(agentConfig.agentId, agentId.toLowerCase())))
    .limit(1);
  return agent || null;
}

export async function createAgent(input: CreateAgentInput, owner: AgentOwner, database: AgentDatabase = db) {
  const userEmail = owner.email.trim().toLowerCase();
  // Older authenticated sessions may predate user persistence. Preserve any
  // existing profile, credits and creation time while satisfying the owner FK.
  await database.insert(users).values({ email: userEmail, name: owner.name?.trim() || null })
    .onConflictDoNothing({ target: users.email });
  const [created] = await database.insert(agentConfig).values({ ...input, userEmail })
    .onConflictDoNothing({ target: agentConfig.agentId }).returning();
  if (created) return { agent: created, created: true };

  const existing = await getAgentForUser(userEmail, input.agentId, database);
  if (existing && existing.name === input.name && existing.description === input.description && existing.agentImage === input.agentImage) {
    return { agent: existing, created: false };
  }
  throw new AgentConflictError();
}
