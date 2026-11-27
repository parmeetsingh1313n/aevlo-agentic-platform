"use client";
import { useEffect, useReducer, useState } from "react";
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
import {
  agentPreviewReducer,
  createAgentPreview,
  MAX_PREVIEW_MESSAGES,
  type PreviewAgent,
} from "@/lib/agent-preview";
import { AgentConfiguration } from "./agent-configuration";
import { ChatHeader } from "./chat-header";
import { ChatPanel } from "./chat-panel";
import styles from "./agent-space.module.css";

function AgentSpaceContent() {
  const config = useAgentConfig();
  const [conversation, dispatch] = useReducer(
    agentPreviewReducer,
    undefined,
    createAgentPreview,
  );
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
          onToggle={() => dispatch({ type: "toggle" })}
          onClear={() => {
            dispatch({ type: "clear" });
            setMessageDraft("");
          }}
          onConfigure={() => setConfigOpen(true)}
        />
        <ChatPanel
          agent={displayedAgent}
          active={conversation.active}
          messages={conversation.messages}
          example={conversation.example}
          draft={messageDraft}
          onDraft={setMessageDraft}
          onSend={(text) => {
            const accepted =
              conversation.active &&
              (conversation.example ||
                conversation.messages.length < MAX_PREVIEW_MESSAGES);
            dispatch({ type: "send", text });
            return accepted;
          }}
          onExample={() => dispatch({ type: "example" })}
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
          onToggle={() => dispatch({ type: "toggle" })}
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
            onToggle={() => dispatch({ type: "toggle" })}
          />
        </SheetContent>
      </Sheet>
    </section>
  );
}
export function AgentSpace({ agent }: { agent: PreviewAgent }) {
  return (
    <AgentConfigProvider agent={agent}>
      <AgentSpaceContent />
    </AgentConfigProvider>
  );
}
