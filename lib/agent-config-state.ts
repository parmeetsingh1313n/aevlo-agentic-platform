import type { PreviewAgent } from "./agent-preview";
export type SavedAgentConfig = {
  name: string;
  description: string | null;
  agentImage: string;
  version?: string;
};
export type AgentConfigDraft = {
  name: string;
  description: string;
  agentImage: string;
};
export type AgentConfigErrors = Partial<Record<keyof AgentConfigDraft, string>>;
export type AgentConfigState = {
  saved: SavedAgentConfig;
  draft: AgentConfigDraft;
  pending: AgentConfigDraft | null;
  phase: "idle" | "saving" | "saved" | "error" | "conflict";
  error: string | null;
  errors: AgentConfigErrors;
  remote: SavedAgentConfig | null;
  intentFields: (keyof AgentConfigDraft)[];
};
export type AgentConfigAction =
  | { type: "edit"; patch: Partial<AgentConfigDraft> }
  | { type: "start"; snapshot: AgentConfigDraft }
  | { type: "success"; value: SavedAgentConfig; verified?: boolean }
  | {
      type: "failure";
      error: string;
      errors?: AgentConfigErrors;
      remote?: SavedAgentConfig | null;
      uncertain?: boolean;
    }
  | { type: "incoming"; value: SavedAgentConfig }
  | { type: "validate"; errors: AgentConfigErrors }
  | { type: "discard" | "use-remote" | "keep-draft" };
const fields: (keyof AgentConfigDraft)[] = [
  "name",
  "description",
  "agentImage",
];
export function savedConfiguration(value: SavedAgentConfig): SavedAgentConfig {
  return {
    name: value.name,
    description: value.description,
    agentImage: value.agentImage,
    version: value.version,
  };
}
export function draftConfiguration(value: SavedAgentConfig): AgentConfigDraft {
  return {
    name: value.name,
    description: value.description || "",
    agentImage: value.agentImage,
  };
}
export function createAgentConfigState(
  agent: SavedAgentConfig,
): AgentConfigState {
  const saved = savedConfiguration(agent);
  return {
    saved,
    draft: draftConfiguration(saved),
    pending: null,
    phase: "idle",
    error: null,
    errors: {},
    remote: null,
    intentFields: [],
  };
}
export function changedConfigFields(
  state: Pick<AgentConfigState, "saved" | "draft">,
): (keyof AgentConfigDraft)[] {
  const saved = draftConfiguration(state.saved);
  return fields.filter((key) => saved[key] !== state.draft[key]);
}
export function editableConfigSignature(value: SavedAgentConfig): string {
  return JSON.stringify([
    value.name,
    value.description,
    value.agentImage,
  ]);
}
export function configSignature(value: SavedAgentConfig): string {
  return JSON.stringify([
    editableConfigSignature(value),
    value.version || null,
  ]);
}
function intendedFields(state: AgentConfigState): (keyof AgentConfigDraft)[] {
  const saved = draftConfiguration(state.saved);
  return fields.filter(
    (key) =>
      state.intentFields.includes(key) ||
      state.draft[key] !== saved[key] ||
      Boolean(
        state.pending &&
          (state.pending[key] !== saved[key] ||
            state.draft[key] !== state.pending[key]),
      ),
  );
}
export function validateConfigDraft(
  draft: AgentConfigDraft,
): AgentConfigErrors {
  const errors: AgentConfigErrors = {};
  if (!draft.name.trim() || draft.name.trim().length > 80)
    errors.name = "Enter a name of 1–80 characters.";
  if (draft.description.length > 1000)
    errors.description = "Keep instructions within 1,000 characters.";
  return errors;
}
export function readAgentConfigResponse(
  value: unknown,
  agentId: string,
): PreviewAgent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const agent = value as Record<string, unknown>;
  if (
    agent.agentId !== agentId ||
    typeof agent.name !== "string" ||
    typeof agent.agentImage !== "string" ||
    (agent.description !== null && typeof agent.description !== "string") ||
    typeof agent.createdAt !== "string" ||
    typeof agent.version !== "string" ||
    !/^\d{1,10}$/.test(agent.version)
  )
    return null;
  return {
    agentId,
    name: agent.name,
    description: agent.description,
    agentImage: agent.agentImage,
    createdAt: agent.createdAt,
    version: agent.version,
  };
}
/** Preserve user intent across delayed responses, including edits reverted during a save. */
export function agentConfigReducer(
  state: AgentConfigState,
  action: AgentConfigAction,
): AgentConfigState {
  switch (action.type) {
    case "edit":
      return {
        ...state,
        draft: { ...state.draft, ...action.patch },
        errors: {},
        phase:
          state.phase === "saving" ||
          state.phase === "conflict" ||
          state.pending
            ? state.phase
            : "idle",
        error: state.phase === "conflict" || state.pending ? state.error : null,
      };
    case "start":
      return state.phase === "saving" || state.remote
        ? state
        : {
            ...state,
            pending: { ...action.snapshot },
            phase: "saving",
            error: null,
            errors: {},
            intentFields: state.pending ? intendedFields(state) : [],
          };
    case "success": {
      const saved = savedConfiguration(action.value);
      const canonical = draftConfiguration(saved);
      const intent = intendedFields(state);
      const draft = { ...state.draft };
      for (const key of fields)
        if (state.pending && draft[key] === state.pending[key])
          draft[key] = canonical[key];
      const remote =
        state.remote &&
        configSignature(state.remote) !== configSignature(saved)
          ? state.remote
          : null;
      return {
        ...state,
        saved,
        draft,
        pending: null,
        phase: remote ? "conflict" : "saved",
        error: remote
          ? "Newer saved changes arrived while saving. Review them before continuing."
          : null,
        errors: {},
        remote,
        intentFields: remote ? intent : [],
      };
    }
    case "failure": {
      const remote = action.remote === undefined ? state.remote : action.remote;
      return {
        ...state,
        pending: action.uncertain && !remote ? state.pending : null,
        phase: remote ? "conflict" : "error",
        error: action.error,
        errors: action.errors || {},
        remote,
        intentFields: remote || action.uncertain ? intendedFields(state) : [],
      };
    }
    case "validate":
      return {
        ...state,
        errors: action.errors,
        phase: "error",
        error: "Check the highlighted fields.",
      };
    case "discard":
      return state.phase === "saving" || state.pending
        ? state
        : state.remote
          ? createAgentConfigState(state.remote)
          : {
              ...state,
              draft: draftConfiguration(state.saved),
              phase: "idle",
              error: null,
              errors: {},
              remote: null,
              intentFields: [],
            };
    case "use-remote":
      return !state.remote || state.phase === "saving"
        ? state
        : createAgentConfigState(state.remote);
    case "keep-draft": {
      if (!state.remote || state.phase === "saving") return state;
      const next = createAgentConfigState(state.remote);
      const changed = intendedFields(state);
      for (const key of changed) next.draft[key] = state.draft[key];
      return next;
    }
    case "incoming": {
      const next = savedConfiguration(action.value);
      if (configSignature(next) === configSignature(state.saved)) {
        return state.remote && !state.pending
          ? {
              ...state,
              remote: null,
              intentFields: [],
              error: null,
              phase: changedConfigFields(state).length ? "idle" : "saved",
            }
          : state;
      }
      // A version-only refresh can arrive during save preparation or a PUT.
      // Preserve the clicked/newly typed draft and any real profile conflict;
      // the request still compares the independently captured expected token.
      if (editableConfigSignature(next) === editableConfigSignature(state.saved)) {
        return state.remote ? state : { ...state, saved: next };
      }
      if (
        changedConfigFields(state).length ||
        state.phase === "saving" ||
        state.pending ||
        state.remote ||
        state.intentFields.length
      )
        return {
          ...state,
          remote: next,
          phase: state.phase === "saving" ? "saving" : "conflict",
          error:
            state.phase === "saving"
              ? null
              : "This agent has newer saved details. Your draft is still here.",
          intentFields: intendedFields(state),
        };
      return createAgentConfigState(next);
    }
  }
}
