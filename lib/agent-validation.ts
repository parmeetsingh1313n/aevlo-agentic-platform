import { getAgentAvatarUrl } from "./workspace-ui";

export const MAX_AGENT_NAME_LENGTH = 80;
export const MAX_AGENT_DESCRIPTION_LENGTH = 1000;

export type CreateAgentInput = {
  agentId: string;
  name: string;
  description: string | null;
  agentImage: string;
};
export type AgentEditableFields = Pick<CreateAgentInput, "name" | "description" | "agentImage">;
export type UpdateAgentInput = CreateAgentInput & { expected: AgentEditableFields; expectedVersion: string };
export type AgentFieldErrors = Partial<Record<keyof CreateAgentInput, string>>;
export type AgentSummary = CreateAgentInput & { id: number; createdAt: string; userEmail: string; version: string };

export function isAgentId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/** Accept only PostgreSQL's canonical unsigned 32-bit xid text. */
export function isAgentVersion(value: unknown): value is string {
  return typeof value === "string" && /^(0|[1-9][0-9]{0,9})$/.test(value) && Number(value) <= 4294967295;
}

export function validateCreateAgentInput(body: unknown):
  | { ok: true; value: CreateAgentInput }
  | { ok: false; fieldErrors: AgentFieldErrors } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, fieldErrors: { name: "Enter your agent details." } };
  }
  const input = body as Record<string, unknown>;
  const fieldErrors: AgentFieldErrors = {};
  const agentId = typeof input.agentId === "string" ? input.agentId.trim().toLowerCase() : "";
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const description = input.description == null ? "" : input.description;
  if (!isAgentId(agentId)) fieldErrors.agentId = "The creation request is invalid. Please try again.";
  if (!name || name.length > MAX_AGENT_NAME_LENGTH) fieldErrors.name = "Use an agent name between 1 and 80 characters.";
  if (typeof description !== "string" || description.length > MAX_AGENT_DESCRIPTION_LENGTH) {
    fieldErrors.description = "Keep instructions within 1000 characters.";
  }

  let agentImage = "";
  try {
    if (typeof input.agentImage !== "string" || input.agentImage.length > 512) throw new Error();
    const image = new URL(input.agentImage);
    const seed = image.searchParams.get("seed") || "";
    const parameters = [...image.searchParams.keys()];
    if (image.protocol !== "https:" || image.hostname !== "api.dicebear.com" || image.port || image.username || image.password || image.hash || image.pathname !== "/10.x/gaze/svg" || !/^[a-z0-9._-]{1,128}$/i.test(seed) || parameters.some((key) => key !== "seed" && key !== "tags") || image.searchParams.getAll("seed").length !== 1 || image.searchParams.getAll("tags").length > 1 || (image.searchParams.has("tags") && image.searchParams.get("tags") !== "animation")) throw new Error();
    agentImage = getAgentAvatarUrl(seed);
  } catch {
    fieldErrors.agentImage = "Choose an avatar with the shuffle control.";
  }
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };
  return { ok: true, value: { agentId, name, description: (description as string).trim() || null, agentImage } };
}

export function validateUpdateAgentInput(body: unknown):
  | { ok: true; value: UpdateAgentInput }
  | { ok: false; fieldErrors: AgentFieldErrors }
  | { ok: false; error: string } {
  const desired = validateCreateAgentInput(body);
  if (!desired.ok) return desired;

  const input = body as Record<string, unknown>;
  const expected = input.expected;
  const snapshotError = { ok: false as const, error: "Reload this agent before saving changes." };
  if (!Object.hasOwn(input, "expectedVersion") || !isAgentVersion(input.expectedVersion)) return snapshotError;
  if (!expected || typeof expected !== "object" || Array.isArray(expected)) return snapshotError;
  const snapshot = expected as Record<string, unknown>;
  if (!Object.hasOwn(snapshot, "name") || !Object.hasOwn(snapshot, "description") || !Object.hasOwn(snapshot, "agentImage") || typeof snapshot.name !== "string" || typeof snapshot.agentImage !== "string" || (snapshot.description !== null && typeof snapshot.description !== "string")) {
    return snapshotError;
  }
  const baseline = validateCreateAgentInput({
    agentId: desired.value.agentId,
    name: snapshot.name,
    description: snapshot.description,
    agentImage: snapshot.agentImage,
  });
  if (!baseline.ok) return snapshotError;

  // Expected values compare against the persisted row. Validate them without
  // trimming text, changing null/empty values, or rebuilding the avatar URL.
  return {
    ok: true,
    value: {
      ...desired.value,
      expectedVersion: input.expectedVersion,
      expected: {
        name: snapshot.name,
        description: snapshot.description,
        agentImage: snapshot.agentImage,
      },
    },
  };
}

export class AgentConflictError extends Error {
  constructor() {
    super("A different agent already uses this creation request.");
    this.name = "AgentConflictError";
  }
}

export class AgentUpdateConflictError extends Error {
  constructor() {
    super("The saved agent has changed since it was loaded.");
    this.name = "AgentUpdateConflictError";
  }
}

export class AgentNotFoundError extends Error {
  constructor() {
    super("The agent is unavailable.");
    this.name = "AgentNotFoundError";
  }
}
