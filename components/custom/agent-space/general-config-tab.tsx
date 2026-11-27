"use client";

import { Check, Plus } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAgentConfig } from "@/context/agent-config-context";

const instructionLimit = 1000;
const guidance = [
  {
    label: "Be concise",
    text: "Keep responses clear and concise; use bullets when they improve readability.",
  },
  {
    label: "Explain steps",
    text: "Break complex tasks into clear, actionable steps.",
  },
  {
    label: "Ask first",
    text: "Ask a clarifying question when essential information is missing.",
  },
];

function appendGuidance(description: string, text: string) {
  const separator = description.length
    ? description.endsWith("\n")
      ? "\n"
      : "\n\n"
    : "";
  return `${description}${separator}${text}`;
}

export function GeneralConfigTab({ prefix }: { prefix: string }) {
  const { draft, edit, errors } = useAgentConfig();
  const instructionsInput = useRef<HTMLTextAreaElement>(null);
  const fieldId = `${prefix}-instructions`;
  const helpId = `${prefix}-instructions-help`;
  const errorId = `${prefix}-instructions-error`;
  const error = errors.description;
  const remainingGuidance = guidance.filter(
    ({ text }) => !draft.description.includes(text),
  );
  const guidanceDoesNotFit =
    remainingGuidance.length > 0 &&
    remainingGuidance.every(
      ({ text }) =>
        appendGuidance(draft.description, text).length > instructionLimit,
    );

  useEffect(() => {
    if (
      error &&
      !errors.name &&
      instructionsInput.current?.offsetParent !== null
    ) {
      instructionsInput.current?.focus();
    }
  }, [error, errors.name]);

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={fieldId} className="text-xs">
          Instructions / Description
        </Label>
        <span
          className="shrink-0 text-[11px] text-muted-foreground tabular-nums"
          aria-label={`${draft.description.length} of ${instructionLimit} characters`}
        >
          {draft.description.length} / {instructionLimit}
        </span>
      </div>
      <Textarea
        ref={instructionsInput}
        id={fieldId}
        name="description"
        data-agent-field="description"
        value={draft.description}
        onChange={(event) => edit({ description: event.target.value })}
        maxLength={instructionLimit}
        rows={8}
        aria-invalid={Boolean(error)}
        aria-describedby={`${helpId}${error ? ` ${errorId}` : ""}`}
        placeholder="Describe the work your agent should do, the tone to use, and any boundaries to follow."
        className="mt-2 min-h-52 max-h-80 resize-y overflow-y-auto bg-background text-[13px] leading-6 caret-ring"
      />
      <p
        id={helpId}
        className="mt-2 text-[11px] leading-5 text-muted-foreground"
      >
        Give your agent a clear goal, tone, and boundaries.
      </p>
      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-2 text-xs leading-5 text-destructive"
        >
          {error}
        </p>
      )}
      <div className="mt-5 border-t border-border pt-4">
        <p className="text-xs font-medium">Add guidance</p>
        <p
          id={`${prefix}-guidance-help`}
          className="mt-1 text-[11px] leading-5 text-muted-foreground"
        >
          {remainingGuidance.length === 0
            ? "All three starting points are in your instructions."
            : guidanceDoesNotFit
              ? "Shorten your instructions to add more guidance."
              : "Add a starting point to your instructions."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {guidance.map(({ label, text }) => {
            const added = draft.description.includes(text);
            const nextDescription = appendGuidance(draft.description, text);
            const exceedsLimit = nextDescription.length > instructionLimit;
            const Icon = added ? Check : Plus;

            return (
              <Button
                key={label}
                type="button"
                variant="outline"
                size="sm"
                className="min-h-9 gap-1.5 px-2 text-[11px]"
                disabled={added || exceedsLimit}
                aria-label={`${added ? "Guidance added" : "Add guidance"}: ${label}`}
                aria-describedby={`${prefix}-guidance-help`}
                title={
                  added
                    ? "This guidance is already in your instructions."
                    : exceedsLimit
                      ? "Shorten your instructions to add this guidance."
                      : text
                }
                onClick={() => {
                  if (!added && !exceedsLimit) {
                    edit({ description: nextDescription });
                  }
                }}
              >
                <Icon className="size-3" aria-hidden="true" />
                {label}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
