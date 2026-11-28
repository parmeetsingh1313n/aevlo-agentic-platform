"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  agentPreviewReducer,
  createAgentPreview,
  getPreviewMessageContent,
  MAX_ASSISTANT_MESSAGE_LENGTH,
  type AgentPreviewAction,
} from "@/lib/agent-preview";
import { parseAgentInteraction } from "@/lib/agent-interaction";

const replyError = "We couldn’t get a reply. Retry your message or start a new conversation.";
const unconfirmedResult = "We couldn’t confirm the result. Check any connected service before repeating this task; start a new conversation to continue.";

/** An immediate request lock also protects two sends before React has rendered pending state. */
export function createAgentChatSession(agentId: string, fetcher: typeof fetch = (...args) => fetch(...args)) {
  let state = createAgentPreview();
  let request: AbortController | null = null;
  const listeners = new Set<() => void>();
  function update(action: AgentPreviewAction) {
    const next = agentPreviewReducer(state, action);
    if (next === state) return false;
    state = next;
    listeners.forEach((listener) => listener());
    return true;
  }
  async function execute(controller: AbortController) {
    // Example text is display-only and never forms part of the actual prompt.
    const messages = state.messages.filter((message) => !message.example)
      .map((message) => ({ role: message.role, content: getPreviewMessageContent(message) }));
    try {
      const response = await fetcher("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, messages }),
        cache: "no-store",
        signal: controller.signal,
      });
      const body: unknown = await response.json();
      if (request !== controller) return;
      const result = body && typeof body === "object" ? body as Record<string, unknown> : {};
      if (!response.ok) {
        update({ type: "fail", error: typeof result.error === "string" && result.error.trim() && result.error.length <= 240 ? result.error.trim() : replyError, retryable: result.retryable !== false });
      } else if (typeof result.response === "string") {
        const interaction = result.interaction === undefined ? undefined : parseAgentInteraction(result.interaction);
        if (interaction === null || !result.response.trim() || getPreviewMessageContent({ role: "assistant", text: result.response, ...(interaction ? { interaction } : {}) }).length > MAX_ASSISTANT_MESSAGE_LENGTH)
          update({ type: "fail", error: unconfirmedResult, retryable: false });
        else update({ type: "reply", text: result.response, ...(interaction ? { interaction } : {}) });
      } else {
        update({ type: "fail", error: unconfirmedResult, retryable: false });
      }
    } catch {
      if (request === controller) update({ type: "fail", error: unconfirmedResult, retryable: false });
    } finally {
      if (request === controller) request = null;
    }
  }
  function begin(action: Extract<AgentPreviewAction, { type: "send" }> | { type: "retry" }) {
    if (request) return false;
    const next = agentPreviewReducer(state, action);
    if (!next.pending) {
      if (next !== state) update(action);
      return false;
    }
    const controller = new AbortController();
    request = controller;
    update(action);
    if (request === controller) void execute(controller);
    return true;
  }
  function cancel() {
    const current = request;
    request = null;
    current?.abort();
    if (state.pending) update({ type: "fail", error: unconfirmedResult, retryable: false });
  }
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    send: (text: string) => begin({ type: "send", text }),
    retry: () => begin({ type: "retry" }),
    toggle: () => { update({ type: "toggle" }); },
    example: () => { update({ type: "example" }); },
    clear: () => { cancel(); update({ type: "clear" }); },
    cancel,
  };
}

export function useAgentChat(agentId: string) {
  const [session] = useState(() => createAgentChatSession(agentId));
  const conversation = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  useEffect(() => () => session.cancel(), [session]);
  return { conversation, ...session };
}
