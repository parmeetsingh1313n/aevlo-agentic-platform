import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, agentConfig, users } from "@/db";
import { AgentConflictError, AgentNotFoundError, AgentUpdateConflictError, isAgentId, type CreateAgentInput, type UpdateAgentInput } from "@/lib/agent-validation";

type AgentDatabase = Pick<typeof db, "insert" | "select" | "update">;
export type AgentOwner = { email: string; name?: string | null };

// xmin identifies the transaction that created the current PostgreSQL row
// version. Keep it as opaque text: it is an edit-session token, not a durable
// revision number, and multiple writes in one transaction can share it.
const agentVersion = sql<string>`${agentConfig}.${sql.identifier("xmin")}::text`;
const agentSelection = {
  id: agentConfig.id, agentId: agentConfig.agentId, name: agentConfig.name,
  description: agentConfig.description, agentImage: agentConfig.agentImage,
  createdAt: agentConfig.createdAt, userEmail: agentConfig.userEmail, tools: agentConfig.tools,
  version: agentVersion.as("version"),
};

export async function listAgentsForUser(email: string, database: AgentDatabase = db) {
  return database.select(agentSelection).from(agentConfig)
    .where(eq(agentConfig.userEmail, email.trim().toLowerCase()))
    .orderBy(desc(agentConfig.createdAt), desc(agentConfig.id));
}

export async function getAgentForUser(email: string, agentId: string, database: AgentDatabase = db) {
  const normalizedId = agentId.trim().toLowerCase();
  if (!isAgentId(normalizedId)) return null;
  const [agent] = await database.select(agentSelection).from(agentConfig)
    .where(and(eq(agentConfig.userEmail, email.trim().toLowerCase()), eq(agentConfig.agentId, normalizedId)))
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
    .onConflictDoNothing({ target: agentConfig.agentId }).returning(agentSelection);
  if (created) return { agent: created, created: true };

  const existing = await getAgentForUser(userEmail, input.agentId, database);
  if (existing && existing.name === input.name && existing.description === input.description && existing.agentImage === input.agentImage) {
    return { agent: existing, created: false };
  }
  throw new AgentConflictError();
}

export async function updateAgentForUser(input: UpdateAgentInput, email: string, database: AgentDatabase = db) {
  const userEmail = email.trim().toLowerCase();
  const agentId = input.agentId.trim().toLowerCase();
  const [updated] = await database.update(agentConfig)
    .set({ name: input.name, description: input.description, agentImage: input.agentImage })
    .where(and(
      eq(agentConfig.userEmail, userEmail),
      eq(agentConfig.agentId, agentId),
      eq(agentVersion, input.expectedVersion),
      eq(agentConfig.name, input.expected.name),
      input.expected.description === null
        ? isNull(agentConfig.description)
        : eq(agentConfig.description, input.expected.description),
      eq(agentConfig.agentImage, input.expected.agentImage),
    ))
    .returning(agentSelection);
  if (updated) return updated;

  const existing = await getAgentForUser(userEmail, agentId, database);
  if (!existing) throw new AgentNotFoundError();
  // A response may have been lost after an earlier successful PUT. Replaying
  // its desired values is safe, while a stale different draft must not write.
  if (existing.name === input.name && existing.description === input.description && existing.agentImage === input.agentImage) {
    return existing;
  }
  throw new AgentUpdateConflictError();
}
