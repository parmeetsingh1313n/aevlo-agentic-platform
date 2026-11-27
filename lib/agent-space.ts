import { isAgentId } from "./agent-validation";

/**
 * Client-safe helpers for the agent space.
 *
 * This module must never import the database layer: the create-agent form is a
 * Client Component, and a server-only import here would pull the SQL driver
 * into the browser bundle.
 */

export type AgentSpaceAgent = {
  id: number;
  agentId: string;
  name: string;
  description: string | null;
  agentImage: string;
  createdAt: Date;
  userEmail: string;
};

export type AgentSpaceState =
  | { kind: "ready"; agent: AgentSpaceAgent }
  | { kind: "missing" };

export type CreateAgentRequest = {
  agentId: string;
  name: string;
  description: string;
  agentImage: string;
};

/** Shape the client form's draft into the agent API's request body. */
export function buildCreateAgentRequest(draft: {
  agentId: string;
  name: string;
  description: string;
  agentImage: string;
}): CreateAgentRequest {
  return {
    agentId: draft.agentId.trim().toLowerCase(),
    name: draft.name.trim(),
    description: draft.description.trim(),
    agentImage: draft.agentImage,
  };
}

/**
 * Build the agent space path for a saved agent. Only a validated agent id may
 * become a path segment, so a crafted id cannot escape the workspace route.
 */
export function agentSpacePath(agentId: string): string | null {
  const candidate = agentId.trim().toLowerCase();
  if (!isAgentId(candidate)) return null;
  return `/workspace/${candidate}`;
}

type AgentSpaceOptions = {
  email: string | null | undefined;
  agentId: string;
  find: (email: string, agentId: string) => Promise<AgentSpaceAgent | null>;
};

/**
 * Resolve the agent space for one signed-in owner.
 *
 * The owner comes from the server session, never from the URL. An anonymous
 * visitor, a malformed id, or another owner's agent all resolve to the same
 * "missing" state so the route never reveals that a record exists.
 */
export async function loadAgentSpace(options: AgentSpaceOptions): Promise<AgentSpaceState> {
  const email = options.email?.trim().toLowerCase();
  if (!email) return { kind: "missing" };
  if (!isAgentId(options.agentId)) return { kind: "missing" };

  const agent = await options.find(email, options.agentId.toLowerCase());
  if (!agent) return { kind: "missing" };
  return { kind: "ready", agent };
}
