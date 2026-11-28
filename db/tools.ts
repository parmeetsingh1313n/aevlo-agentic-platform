import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db, agentConfig, tools } from "@/db";
import { INITIAL_TOOL_CATALOG } from "@/lib/tool-catalog";

export async function seedToolCatalog() {
  await db.insert(tools).values([...INITIAL_TOOL_CATALOG]).onConflictDoNothing({ target: tools.slug });
}
export async function listToolCatalog() {
  return db.select({ name: tools.name, slug: tools.slug, description: tools.description, category: tools.category, isActive: tools.isActive })
    .from(tools).orderBy(asc(tools.name));
}
export async function getAgentToolsForUser(email: string, agentId: string) {
  const [agent] = await db.select({ agentId: agentConfig.agentId, tools: agentConfig.tools, composioSessionId: agentConfig.composioSessionId })
    .from(agentConfig).where(and(eq(agentConfig.userEmail, email), eq(agentConfig.agentId, agentId))).limit(1);
  return agent ?? null;
}
/** A per-tool atomic update avoids losing another tab's independent selection. */
export async function setAgentToolkit(email: string, agentId: string, slug: string, enabled: boolean) {
  const [tool] = await db.select({ slug: tools.slug }).from(tools).where(and(eq(tools.slug, slug), ...(enabled ? [eq(tools.isActive, true)] : []))).limit(1);
  if (!tool) return null;
  const [agent] = await db.update(agentConfig).set({
    tools: enabled
      ? sql`CASE WHEN ${agentConfig.tools} @> ${JSON.stringify([slug])}::jsonb THEN ${agentConfig.tools} ELSE ${agentConfig.tools} || ${JSON.stringify([slug])}::jsonb END`
      : sql`COALESCE((SELECT jsonb_agg(value) FROM jsonb_array_elements(${agentConfig.tools}) WHERE value <> ${JSON.stringify(slug)}::jsonb), '[]'::jsonb)`,
    composioSessionId: null,
  }).where(and(eq(agentConfig.userEmail, email), eq(agentConfig.agentId, agentId),
    enabled ? sql`NOT (${agentConfig.tools} @> ${JSON.stringify([slug])}::jsonb)` : sql`${agentConfig.tools} @> ${JSON.stringify([slug])}::jsonb`))
    .returning({ agentId: agentConfig.agentId, tools: agentConfig.tools, composioSessionId: agentConfig.composioSessionId });
  return agent ?? await getAgentToolsForUser(email, agentId);
}
/** Do not let a concurrent toolkit change inherit an old session policy. */
export async function saveAgentToolSession(email: string, agentId: string, expectedTools: string[], sessionId: string) {
  const [saved] = await db.update(agentConfig).set({ composioSessionId: sessionId })
    .where(and(eq(agentConfig.userEmail, email), eq(agentConfig.agentId, agentId), sql`${agentConfig.tools} = ${JSON.stringify(expectedTools)}::jsonb`))
    .returning({ agentId: agentConfig.agentId });
  return Boolean(saved);
}
