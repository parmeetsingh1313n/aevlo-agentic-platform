"use client";
import { AlertCircle, Check, Loader2, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAgentConfig } from "@/context/agent-config-context";
import styles from "./agent-space.module.css";

const labels = {
  name: "Name",
  description: "Instructions",
  agentImage: "Avatar",
};
export function SaveConfigDock() {
  const {
    state,
    dirty,
    saving,
    changedFields,
    save,
    discard,
    useSavedVersion,
    keepDraft,
  } = useAgentConfig();
  const conflict = Boolean(state.remote);
  const confirmed = state.phase === "saved" && !dirty;
  const status = saving
    ? "Saving your changes…"
    : state.pending
      ? "Save not confirmed"
      : conflict
        ? "Newer saved changes found"
        : dirty
          ? changedFields.length
            ? `${changedFields.map((field) => labels[field]).join(" + ")} changed`
            : "Unsaved changes"
          : confirmed
            ? "Changes saved"
            : "Saved to your workspace";
  return (
    <footer className={styles.saveDock} data-save-state={state.phase}>
      {state.error && (
        <div
          role="alert"
          className="mb-3 rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-xs leading-5"
        >
          <p className="font-medium text-foreground">{state.error}</p>
          {conflict ? (
            <>
              <p className="mt-1 text-muted-foreground">
                Your edits are safe. Use the saved version, or keep your edited
                fields and save again.
              </p>
              {state.remote?.name !== state.saved.name && (
                <p className="mt-2 break-words text-muted-foreground">
                  Saved name:{" "}
                  <span className="font-medium text-foreground">
                    {state.remote?.name}
                  </span>
                </p>
              )}
              {state.remote?.description !== state.saved.description && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-muted-foreground">
                    Review saved instructions
                  </summary>
                  <p className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap break-words">
                    {state.remote?.description || "No instructions"}
                  </p>
                </details>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={useSavedVersion}
                  disabled={saving}
                  className="text-xs"
                >
                  Use saved version
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={keepDraft}
                  disabled={saving}
                  className="text-xs"
                >
                  Keep my edits
                </Button>
              </div>
            </>
          ) : (
            <p className="mt-1 text-muted-foreground">
              Your unsaved changes are still here.
            </p>
          )}
        </div>
      )}
      <div
        className="mb-3 flex items-center gap-2.5 text-xs"
        role="status"
        aria-live="polite"
      >
        <span
          className={
            confirmed
              ? styles.savedIcon
              : "flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
          }
        >
          {saving ? (
            <Loader2
              size={13}
              className="animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : state.error ? (
            <AlertCircle size={13} aria-hidden="true" />
          ) : dirty ? (
            <span
              className="size-1.5 rounded-full bg-primary"
              aria-hidden="true"
            />
          ) : (
            <Check size={13} aria-hidden="true" />
          )}
        </span>
        <span className={confirmed ? "text-success" : "text-muted-foreground"}>
          {status}
        </span>
      </div>
      <div className="flex gap-2">
        <Button
          onClick={() => void save()}
          disabled={!dirty || saving || conflict}
          className="h-11 min-w-0 flex-1 gap-2 text-[13px] motion-reduce:transition-none"
        >
          {saving ? (
            <Loader2
              size={15}
              className="animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : confirmed ? (
            <Check size={15} aria-hidden="true" />
          ) : (
            <Save size={15} aria-hidden="true" />
          )}
          {saving
            ? "Saving…"
            : state.phase === "error"
              ? "Retry save"
              : "Save changes"}
        </Button>
        <Button
          variant="outline"
          className="size-11 shrink-0"
          disabled={!dirty || saving || Boolean(state.pending)}
          aria-label="Discard unsaved changes"
          title="Discard unsaved changes"
          onClick={discard}
        >
          <RotateCcw size={16} />
        </Button>
      </div>
      <p className="mt-2.5 text-[11px] leading-4 text-muted-foreground">
        {dirty
          ? "Save to keep these changes across visits."
          : "Profile changes are saved. Chat is still a preview."}
        <span className="ml-1.5 hidden 2xl:inline">Ctrl / ⌘ + S</span>
      </p>
    </footer>
  );
}
