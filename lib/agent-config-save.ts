import {
  editableConfigSignature,
  readAgentConfigResponse,
  savedConfiguration,
  type SavedAgentConfig,
} from "./agent-config-state";

type SavePreparation =
  | { kind: "ready" | "conflict"; value: SavedAgentConfig }
  | { kind: "unavailable"; error: string }
  | { kind: "aborted" };

/** Read the full profile before using a refreshed opaque database token. */
export async function prepareAgentConfigSave(
  agentId: string,
  baseline: SavedAgentConfig,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<SavePreparation> {
  if (signal.aborted) return { kind: "aborted" };
  try {
    const response = await fetcher(`/api/agent?agentId=${encodeURIComponent(agentId)}`, {
      cache: "no-store", signal,
    });
    if (signal.aborted) return { kind: "aborted" };
    if (!response.ok) return { kind: "unavailable", error: response.status === 401
      ? "Your session expired. Sign in again to save."
      : "Couldn’t check the saved details. Your draft is still here; try saving again." };
    const decoded = readAgentConfigResponse(await response.json(), agentId);
    if (signal.aborted) return { kind: "aborted" };
    if (decoded) {
      const value = savedConfiguration(decoded);
      return { kind: editableConfigSignature(value) === editableConfigSignature(baseline) ? "ready" : "conflict", value };
    }
  } catch {
    if (signal.aborted) return { kind: "aborted" };
  }
  return { kind: "unavailable", error: "Couldn’t verify the saved details. Your draft is still here; try saving again." };
}
