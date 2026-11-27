"use client";
import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { AgentNavigationGuard } from "@/components/custom/agent-space/agent-navigation-guard";
import {
  agentConfigReducer,
  changedConfigFields,
  configSignature,
  createAgentConfigState,
  editableConfigSignature,
  readAgentConfigResponse,
  savedConfiguration,
  validateConfigDraft,
  type AgentConfigDraft,
  type AgentConfigErrors,
  type AgentConfigState,
  type SavedAgentConfig,
} from "@/lib/agent-config-state";
import type { PreviewAgent } from "@/lib/agent-preview";

type AgentConfigContextValue = {
  agentId: string;
  state: AgentConfigState;
  draft: AgentConfigDraft;
  errors: AgentConfigErrors;
  dirty: boolean;
  saving: boolean;
  changedFields: (keyof AgentConfigDraft)[];
  edit: (patch: Partial<AgentConfigDraft>) => void;
  discard: () => void;
  save: () => Promise<void>;
  useSavedVersion: () => void;
  keepDraft: () => void;
};
const AgentConfigContext = createContext<AgentConfigContextValue | null>(null);
export function useAgentConfig() {
  const value = useContext(AgentConfigContext);
  if (!value) throw new Error("Agent configuration requires its provider.");
  return value;
}

export function AgentConfigProvider({
  agent,
  children,
}: {
  agent: PreviewAgent;
  children: ReactNode;
}) {
  const router = useRouter();
  const [state, dispatch] = useReducer(
    agentConfigReducer,
    agent,
    createAgentConfigState,
  );
  const inFlight = useRef(false);
  const request = useRef<AbortController | null>(null);
  const signature = configSignature(agent);
  const source = useRef(signature);
  const changedFields = changedConfigFields(state);
  const dirty =
    changedFields.length > 0 ||
    Boolean(state.pending) ||
    Boolean(state.remote && state.intentFields.length);
  const saving = state.phase === "saving";
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (source.current !== signature) {
      source.current = signature;
      dispatch({ type: "incoming", value: savedConfiguration(agent) });
    }
  }, [agent, signature]);

  async function save() {
    if (inFlight.current || !dirty || state.remote) return;
    const errors = validateConfigDraft(state.draft);
    if (Object.keys(errors).length) {
      dispatch({ type: "validate", errors });
      window.dispatchEvent(new Event("aevlo:config-invalid"));
      return;
    }
    const snapshot = { ...state.draft };
    const expected = {
      name: state.saved.name,
      description: state.saved.description,
      agentImage: state.saved.agentImage,
    };
    const expectedVersion = state.saved.version;
    const controller = new AbortController();
    request.current = controller;
    inFlight.current = true;
    dispatch({ type: "start", snapshot });
    const latestSaved = async (): Promise<SavedAgentConfig | null> => {
      try {
        const latest = await fetch(
          `/api/agent?agentId=${encodeURIComponent(agent.agentId)}`,
          { cache: "no-store", signal: controller.signal },
        );
        const value = latest.ok
          ? readAgentConfigResponse(await latest.json(), agent.agentId)
          : null;
        return value ? savedConfiguration(value) : null;
      } catch {
        return null;
      }
    };
    const confirm = (updated: SavedAgentConfig, verified = false) => {
      // A fresh refresh must not be skipped merely because this version arrived
      // before the save response. Anchor the source on the acknowledged version.
      source.current = configSignature(updated);
      dispatch({ type: "success", value: updated, verified });
      router.refresh();
    };
    const recover = async (error: string, transportFailure: boolean) => {
      const latest = await latestSaved();
      if (controller.signal.aborted) return;
      const desired = {
        name: snapshot.name.trim(),
        description: snapshot.description.trim() || null,
        agentImage: snapshot.agentImage,
      };
      if (
        latest &&
        latest.version !== expectedVersion &&
        editableConfigSignature(latest) === editableConfigSignature(desired)
      ) {
        confirm(latest, true);
        return;
      }
      const unchanged =
        latest && configSignature(latest) === configSignature(state.saved);
      dispatch({
        type: "failure",
        error,
        uncertain: !latest || Boolean(transportFailure && unchanged),
        ...(latest ? { remote: unchanged ? null : latest } : {}),
      });
    };
    try {
      const response = await fetch("/api/agent", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: agent.agentId,
          ...snapshot,
          expected,
          expectedVersion,
        }),
        signal: controller.signal,
      });
      const result = await response.json().catch(() => null);
      if (controller.signal.aborted) return;
      if (!response.ok) {
        const error =
          response.status === 401
            ? "Your session expired. Sign in again to save."
            : typeof result?.error === "string"
              ? result.error
              : "Couldn’t save your changes. Try again.";
        if (response.status >= 500) {
          await recover(error, false);
          return;
        }
        let remote: SavedAgentConfig | null | undefined;
        let uncertain = false;
        if (response.status === 409) {
          const latest = await latestSaved();
          if (controller.signal.aborted) return;
          remote = latest || undefined;
          uncertain = !latest;
        }
        const fieldErrors: AgentConfigErrors = {};
        for (const key of ["name", "description", "agentImage"] as const)
          if (typeof result?.fieldErrors?.[key] === "string")
            fieldErrors[key] = result.fieldErrors[key];
        dispatch({
          type: "failure",
          error,
          errors: fieldErrors,
          remote,
          uncertain,
        });
        if (Object.keys(fieldErrors).length)
          window.dispatchEvent(new Event("aevlo:config-invalid"));
        return;
      }
      const updated = readAgentConfigResponse(result?.agent, agent.agentId);
      if (!updated) {
        await recover(
          "The save response could not be verified. Your draft is still here.",
          true,
        );
        return;
      }
      confirm(savedConfiguration(updated));
    } catch {
      if (!controller.signal.aborted)
        await recover(
          "Couldn’t verify the save. Your edits are still here; retry to confirm them.",
          true,
        );
    } finally {
      inFlight.current = false;
      if (request.current === controller) request.current = null;
    }
  }
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "s" &&
        !event.isComposing
      ) {
        event.preventDefault();
        void save();
      }
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  });
  const value: AgentConfigContextValue = {
    agentId: agent.agentId,
    state,
    draft: state.draft,
    errors: state.errors,
    dirty,
    saving,
    changedFields,
    edit: (patch) => dispatch({ type: "edit", patch }),
    discard: () => {
      if (saving || state.pending) return;
      dispatch({ type: "discard" });
      if (state.remote) router.refresh();
    },
    save,
    useSavedVersion: () => {
      if (saving) return;
      dispatch({ type: "use-remote" });
      router.refresh();
    },
    keepDraft: () => {
      if (!saving) dispatch({ type: "keep-draft" });
    },
  };
  return (
    <AgentConfigContext.Provider value={value}>
      {children}
      <AgentNavigationGuard />
    </AgentConfigContext.Provider>
  );
}
