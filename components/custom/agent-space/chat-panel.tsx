"use client";
import { useEffect, useRef } from "react";
import {
  ArrowUpRight,
  FileText,
  ListTodo,
  Lightbulb,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AgentDraft, PreviewMessage } from "@/lib/agent-preview";
import { AgentAvatar } from "./agent-avatar";
import { ChatComposer } from "./chat-composer";
import styles from "./agent-space.module.css";
const starters = [
  {
    icon: ListTodo,
    title: "Plan my day",
    prompt: "Help me turn today’s priorities into a practical plan.",
  },
  {
    icon: FileText,
    title: "Make a clear brief",
    prompt: "Help me turn these notes into a concise brief:\n\n",
  },
  {
    icon: Lightbulb,
    title: "Explore an idea",
    prompt: "Help me explore an idea and identify the best next step.",
  },
];
export function ChatPanel({
  agent,
  active,
  messages,
  example,
  draft,
  onDraft,
  onSend,
  onExample,
}: {
  agent: AgentDraft;
  active: boolean;
  messages: PreviewMessage[];
  example: boolean;
  draft: string;
  onDraft: (text: string) => void;
  onSend: (text: string) => boolean;
  onExample: () => void;
}) {
  const scrollRegion = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const region = scrollRegion.current;
    if (region && !example)
      region.scrollTo({ top: region.scrollHeight, behavior: "instant" });
  }, [messages, example]);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRegion}
        className={styles.conversation}
        aria-label="Conversation messages"
        tabIndex={0}
      >
        {messages.length === 0 ? (
          <div className="m-auto w-full max-w-lg px-5 py-8 sm:px-8">
            <AgentAvatar
              src={agent.agentImage}
              size={64}
              className="mb-6 rounded-2xl"
            />
            <h2 className="font-heading text-[28px] font-medium leading-tight tracking-[-0.025em]">
              What would you like
              <br />
              to work on?
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
              Start with a thought, a task, or a few rough notes.
            </p>
            <div className="mt-7 flex flex-col gap-1.5">
              {starters.map(({ icon: Icon, title, prompt }) => (
                <button
                  key={title}
                  type="button"
                  disabled={!active}
                  onClick={() => onDraft(prompt)}
                  className="group flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
                >
                  <Icon
                    size={17}
                    className="text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="flex-1">{title}</span>
                  <ArrowUpRight
                    size={15}
                    className="text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transform-none"
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onExample}
              className="mt-5 gap-2 text-xs text-muted-foreground"
            >
              <RotateCcw size={13} />
              View an example conversation
            </Button>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-3xl px-5 py-5 sm:px-7 sm:py-7">
            <div className="mb-7 flex items-center justify-center gap-3 text-[11px] text-muted-foreground">
              <span className="h-px w-9 bg-border" aria-hidden="true" />
              <span>
                {example ? "Example conversation" : "Conversation preview"}
              </span>
              <span className="h-px w-9 bg-border" aria-hidden="true" />
            </div>
            <ol
              className="space-y-6"
              aria-label={
                example ? "Illustrative messages" : "Your preview messages"
              }
            >
              {messages.map((message) => (
                <li
                  key={message.id}
                  className={
                    message.role === "user"
                      ? "flex justify-end"
                      : "flex items-start gap-3"
                  }
                >
                  {message.role === "assistant" && (
                    <AgentAvatar
                      src={agent.agentImage}
                      size={30}
                      className="mt-1 rounded-lg"
                    />
                  )}
                  <div
                    className={
                      message.role === "user"
                        ? "max-w-[88%] sm:max-w-[82%]"
                        : "min-w-0 max-w-[88%]"
                    }
                  >
                    {message.role === "assistant" && (
                      <div className="mb-2 flex min-w-0 items-center gap-2 text-xs">
                        <span className="truncate font-semibold">
                          {agent.name}
                        </span>
                        <span className="shrink-0 text-muted-foreground">
                          Example
                        </span>
                      </div>
                    )}
                    {message.role === "user" && (
                      <span className="sr-only">You: </span>
                    )}
                    <div
                      className={
                        message.role === "user"
                          ? styles.userMessage
                          : styles.assistantMessage
                      }
                    >
                      {message.text}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            {example && (
              <p className="mt-7 text-center text-[11px] leading-5 text-muted-foreground">
                Illustrative messages. Sending starts a fresh local preview.
              </p>
            )}
            {!example && (
              <div className="mt-7 flex items-start gap-3 text-sm text-muted-foreground">
                <AgentAvatar
                  src={agent.agentImage}
                  size={30}
                  className="rounded-lg"
                />
                <p className="pt-1 leading-6">
                  Your message is in the preview. Live responses are not
                  connected yet.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      <ChatComposer
        active={active}
        draft={draft}
        onDraft={onDraft}
        onSend={onSend}
      />
    </div>
  );
}
