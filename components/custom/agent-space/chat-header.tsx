"use client";
import { PanelRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { AgentDraft } from "@/lib/agent-preview";
import { AgentAvatar } from "./agent-avatar";
export function ChatHeader({
  agent,
  dirty,
  active,
  onToggle,
  onClear,
  onConfigure,
}: {
  agent: AgentDraft;
  dirty: boolean;
  active: boolean;
  onToggle: () => void;
  onClear: () => void;
  onConfigure: () => void;
}) {
  return (
    <header className="flex min-h-20 shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-7">
      <div className="flex min-w-0 items-center gap-3">
        <AgentAvatar src={agent.agentImage} />
        <div className="min-w-0">
          <h1
            className="truncate font-heading text-xl font-semibold tracking-[-0.02em] sm:text-[22px]"
            title={agent.name}
          >
            {agent.name}
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {dirty ? "Unsaved profile changes" : "Saved agent"}{" "}
            <span aria-hidden="true" className="mx-1">
              ·
            </span>{" "}
            Conversation
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <label className="hidden cursor-pointer items-center gap-2 px-2 text-xs text-muted-foreground sm:flex">
          <span>{active ? "Chat active" : "Chat paused"}</span>
          <Switch
            checked={active}
            onCheckedChange={onToggle}
            aria-label="Activate conversation"
            className="motion-reduce:transition-none"
          />
        </label>
        <Button
          variant="ghost"
          size="icon-lg"
          onClick={onClear}
          aria-label="New conversation"
          title="New conversation"
        >
          <Plus />
        </Button>
        <Button
          variant="outline"
          size="icon-lg"
          onClick={onConfigure}
          className="xl:hidden"
          aria-label="Open agent configuration"
        >
          <PanelRight />
        </Button>
      </div>
    </header>
  );
}
