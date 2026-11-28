"use client";
import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AgentConfigProvider,
  useAgentConfig,
} from "@/context/agent-config-context";
import type { PreviewAgent } from "@/lib/agent-preview";
import { useAgentChat } from "@/hooks/use-agent-chat";
import { AgentConfiguration } from "./agent-configuration";
import { ChatHeader } from "./chat-header";
import { ChatPanel } from "./chat-panel";
import styles from "./agent-space.module.css";

function AgentSpaceContent() {
  const config = useAgentConfig();
  const chat = useAgentChat(config.agentId);
  const { conversation } = chat;
  const [configOpen, setConfigOpen] = useState(false);
  const [messageDraft, setMessageDraft] = useState("");
  const displayedAgent = { ...config.draft, name: config.draft.name.trim() || config.state.saved.name };
  useEffect(() => {
    const reveal = () => {
      if (!window.matchMedia("(min-width: 1280px)").matches)
        setConfigOpen(true);
    };
    window.addEventListener("aevlo:config-invalid", reveal);
    return () => window.removeEventListener("aevlo:config-invalid", reveal);
  }, []);
  return (
    <section className={styles.workspace} aria-label="Agent space">
      <div className="flex min-h-0 min-w-0 flex-col">
        <ChatHeader
          agent={displayedAgent}
          dirty={config.dirty}
          active={conversation.active}
          onToggle={chat.toggle}
          onClear={() => {
            chat.clear();
            setMessageDraft("");
          }}
          onConfigure={() => setConfigOpen(true)}
        />
        <ChatPanel
          agent={displayedAgent}
          active={conversation.active}
          messages={conversation.messages}
          example={conversation.example}
          pending={conversation.pending}
          error={conversation.error}
          retryable={conversation.retryable}
          dirty={config.dirty}
          capacityReached={conversation.capacityReached}
          draft={messageDraft}
          onDraft={setMessageDraft}
          onSend={chat.send}
          onRetry={chat.retry}
          onExample={chat.example}
          onNewConversation={() => {
            chat.clear();
            setMessageDraft("");
          }}
        />
        <p role="status" aria-live="polite" className="sr-only">
          {conversation.notice}
        </p>
      </div>
      <aside
        aria-label="Agent configuration"
        className="hidden min-h-0 border-l border-border bg-card xl:block"
      >
        <AgentConfiguration
          prefix="desktop-agent"
          active={conversation.active}
          onToggle={chat.toggle}
        />
      </aside>
      <Sheet open={configOpen} onOpenChange={setConfigOpen}>
        <SheetContent
          side="right"
          className="w-full! max-w-[390px]! gap-0 motion-reduce:transition-none"
          showCloseButton
        >
          <SheetTitle className="sr-only">Agent configuration</SheetTitle>
          <SheetDescription className="sr-only">
            Edit your agent’s profile and instructions. Save changes to keep
            them in your workspace.
          </SheetDescription>
          <AgentConfiguration
            prefix="drawer-agent"
            active={conversation.active}
            onToggle={chat.toggle}
          />
        </SheetContent>
      </Sheet>
    </section>
  );
}
export function AgentSpace({ agent }: { agent: PreviewAgent }) {
  return (
    <AgentConfigProvider key={agent.agentId} agent={agent}>
      <AgentSpaceContent />
    </AgentConfigProvider>
  );
}
