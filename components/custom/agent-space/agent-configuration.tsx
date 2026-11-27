"use client";
import { useEffect, useRef } from "react";
import { Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAgentConfig } from "@/context/agent-config-context";
import { getAgentAvatarUrl } from "@/lib/workspace-ui";
import { AgentAvatar } from "./agent-avatar";
import { ConfigurationTabs } from "./configuration-tabs";
import { SaveConfigDock } from "./save-config-dock";
import styles from "./agent-space.module.css";

export function AgentConfiguration({
  prefix,
  active,
  onToggle,
}: {
  prefix: string;
  active: boolean;
  onToggle: () => void;
}) {
  const { draft, edit, errors, dirty } = useAgentConfig();
  const nameInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (errors.name && nameInput.current?.offsetParent !== null)
      nameInput.current?.focus();
  }, [errors.name]);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex min-h-20 shrink-0 flex-col justify-center border-b border-border px-5 py-4">
        <h2 className="text-[15px] font-semibold">Agent configuration</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          A name, a purpose, a little personality.
        </p>
      </header>
      <div className={styles.configScroll}>
        <div className="flex items-center gap-4">
          <AgentAvatar
            src={draft.agentImage}
            size={72}
            className="rounded-2xl"
          />
          <div className="min-w-0">
            <p className="text-[13px] font-medium">Give it a familiar face</p>
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
              {dirty ? "Previewing your edits" : "Your saved profile"}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 h-8 gap-1.5 text-xs"
              onClick={() =>
                edit({ agentImage: getAgentAvatarUrl(crypto.randomUUID()) })
              }
            >
              <Shuffle size={13} aria-hidden="true" />
              Shuffle avatar
            </Button>
          </div>
        </div>
        {errors.agentImage && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {errors.agentImage}
          </p>
        )}
        <div className="mt-6 mb-5">
          <Label htmlFor={`${prefix}-name`} className="text-[13px]">
            Agent name
          </Label>
          <Input
            ref={nameInput}
            id={`${prefix}-name`}
            name="name"
            data-agent-field="name"
            value={draft.name}
            maxLength={80}
            onChange={(event) => edit({ name: event.target.value })}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={`${prefix}-name-help${errors.name ? ` ${prefix}-name-error` : ""}`}
            className="mt-2 h-11 bg-background text-sm"
          />
          <p
            id={`${prefix}-name-help`}
            className="mt-2 text-[11px] leading-5 text-muted-foreground"
          >
            Shown in your workspace and conversations.
          </p>
          {errors.name && (
            <p
              role="alert"
              id={`${prefix}-name-error`}
              className="mt-2 text-xs text-destructive"
            >
              {errors.name}
            </p>
          )}
        </div>
        <ConfigurationTabs
          active={active}
          onToggle={onToggle}
          prefix={prefix}
        />
      </div>
      <SaveConfigDock />
    </div>
  );
}
