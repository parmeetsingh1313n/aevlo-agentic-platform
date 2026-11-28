"use client";

import { Copy, Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAgentConfig } from "@/context/agent-config-context";

export function SettingsTab({
  active,
  onToggle,
  prefix,
}: {
  active: boolean;
  onToggle: () => void;
  prefix: string;
}) {
  const { discard, dirty, saving } = useAgentConfig();

  return (
    <div>
      <h3 className="text-sm font-semibold">Agent settings</h3>
      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
        Manage this conversation and your configuration draft.
      </p>
      <div className="mt-4 divide-y divide-border">
        <section className="py-4">
          <div className="flex items-center justify-between gap-3">
            <h4 className="flex items-center gap-2 font-sans text-[13px] font-medium">
              {active ? (
                <Pause className="size-4" aria-hidden="true" />
              ) : (
                <Play className="size-4" aria-hidden="true" />
              )}
              Conversation
            </h4>
            <span className="text-[11px] text-muted-foreground">
              {active ? "Active" : "Paused"}
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            Control message entry for this visit. A reply already in progress can finish.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 min-h-9 text-xs"
            onClick={onToggle}
          >
            {active ? "Pause conversation" : "Resume conversation"}
          </Button>
        </section>
        <section className="py-4">
          <h4 className="flex items-center gap-2 font-sans text-[13px] font-medium">
            <RotateCcw className="size-4" aria-hidden="true" />
            Unsaved changes
          </h4>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            {dirty
              ? "Restore your last saved name, avatar, and instructions."
              : "Your configuration matches the saved version."}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 min-h-9 text-xs"
            disabled={!dirty || saving}
            onClick={discard}
          >
            Discard changes
          </Button>
        </section>
        <section className="py-4">
          <h4 className="flex items-center gap-2 font-sans text-[13px] font-medium">
            <Copy className="size-4" aria-hidden="true" />
            Duplicate agent
          </h4>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            Create a separate copy with the same starting details.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-9 text-xs"
              disabled
              aria-describedby={`${prefix}-duplicate-help`}
            >
              Duplicate agent
            </Button>
            <span
              id={`${prefix}-duplicate-help`}
              className="text-[11px] text-muted-foreground"
            >
              Coming later
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
