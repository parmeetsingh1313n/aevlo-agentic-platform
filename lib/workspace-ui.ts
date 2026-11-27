/** DiceBear 10.x Gaze avatar with an opaque, non-personal seed. */
export function getAgentAvatarUrl(seed: string, animated = true): string {
  const parameters = new URLSearchParams();
  if (animated) parameters.set("tags", "animation");
  parameters.set("seed", seed);
  return `https://api.dicebear.com/10.x/gaze/svg?${parameters}`;
}

export type AgentListEntry = {
  agentId: string;
  name: string;
  agentImage: string;
  createdAt: string;
};

/**
 * Shape database agents for the sidebar. The owner's email never crosses the
 * server/client boundary with the list.
 */
export function toAgentListEntries(
  agents: { agentId: string; name: string; agentImage: string; createdAt: Date | string }[],
): AgentListEntry[] {
  return agents.map((agent) => ({
    agentId: agent.agentId,
    name: agent.name,
    agentImage: agent.agentImage,
    createdAt: typeof agent.createdAt === "string" ? agent.createdAt : agent.createdAt.toISOString(),
  }));
}

export function getProfileInitials(name?: string | null, email?: string | null): string {
  const label = name?.trim() || email?.split("@")[0] || "You";
  return label.split(/\s+/).slice(0, 2).map((part) => Array.from(part)[0]).join("").toUpperCase();
}
