export type PreviewAgent = {
  agentId: string;
  name: string;
  description: string | null;
  agentImage: string;
  createdAt: string;
  version?: string;
};
import { formatInteractionPrompt, type AgentInteraction } from "./agent-interaction";

export type AgentDraft = {
  name: string;
  description: string;
  agentImage: string;
};
export type PreviewMessage = {
  id: number;
  role: "user" | "assistant";
  text: string;
  example: boolean;
  interaction?: AgentInteraction;
};
export type AgentPreviewState = {
  active: boolean;
  messages: PreviewMessage[];
  example: boolean;
  notice: string;
  pending: boolean;
  error: string;
  retryable: boolean;
  capacityReached: boolean;
};
export type AgentPreviewAction =
  | { type: "toggle" | "clear" | "example" | "retry" }
  | { type: "send"; text: string }
  | { type: "reply"; text: string; interaction?: AgentInteraction }
  | { type: "fail"; error: string; retryable?: boolean };
export const MAX_PREVIEW_MESSAGE_LENGTH = 4000;
export const MAX_PREVIEW_MESSAGES = 100;
export const MAX_ASSISTANT_MESSAGE_LENGTH = 16000;
export const MAX_CHAT_HISTORY_LENGTH = 64000;

/** Questions remain part of model history while the interface renders their controls separately. */
export function getPreviewMessageContent(message: Pick<PreviewMessage, "role" | "text" | "interaction">): string {
  return message.role === "assistant" && message.interaction
    ? `${message.text}\n\n${formatInteractionPrompt(message.interaction.questions)}`
    : message.text;
}
export const exampleMessages: PreviewMessage[] = [
  {
    id: 1,
    role: "user",
    text: "Help me turn tomorrow’s planning notes into a short brief.",
    example: true,
  },
  {
    id: 2,
    role: "assistant",
    text: "Let’s make the meeting easier to prepare for. A useful brief starts with three things: what needs a decision, what’s blocking progress, and who owns the next step.",
    example: true,
  },
  {
    id: 3,
    role: "user",
    text: "The focus is onboarding improvements and the next product launch. Keep it practical.",
    example: true,
  },
  {
    id: 4,
    role: "assistant",
    text: "Here’s a simple structure to work from:\n\n1. Onboarding — friction points and proposed improvements\n2. Launch — milestones, owners, and open risks\n3. Decisions — what the team needs to agree on\n\nShare your notes when you’re ready, and we can fill in the details.",
    example: true,
  },
];
export function createAgentPreview(): AgentPreviewState {
  return {
    active: true,
    messages: exampleMessages.map((message) => ({ ...message })),
    example: true,
    notice: "",
    pending: false,
    error: "",
    retryable: true,
    capacityReached: false,
  };
}
/** Browser conversation state; only completed replies from the server become assistant messages. */
export function agentPreviewReducer(
  state: AgentPreviewState,
  action: AgentPreviewAction,
): AgentPreviewState {
  switch (action.type) {
    case "toggle":
      return {
        ...state,
        active: !state.active,
        notice: state.active
          ? "Message entry paused."
          : "Message entry resumed.",
      };
    case "clear":
      return {
        ...state,
        messages: [],
        example: false,
        pending: false,
        error: "",
        retryable: true,
        capacityReached: false,
        notice: "New conversation. Messages are not saved.",
      };
    case "example":
      if (state.pending) return state;
      return {
        ...state,
        messages: exampleMessages.map((message) => ({ ...message })),
        example: true,
        error: "",
        retryable: true,
        capacityReached: false,
        notice: "Showing illustrative messages, not live AI responses.",
      };
    case "send": {
      const text = action.text.trim();
      if (!state.active || state.pending || state.error || state.capacityReached || !text || text.length > MAX_PREVIEW_MESSAGE_LENGTH)
        return state;
      const messages = state.example ? [] : state.messages;
      if (messages.at(-1)?.role === "user") return state;
      // Reserve space for the assistant response so a completed turn remains bounded.
      if (messages.length > MAX_PREVIEW_MESSAGES - 2 ||
        messages.reduce((total, message) => total + getPreviewMessageContent(message).length, 0) + text.length + MAX_ASSISTANT_MESSAGE_LENGTH > MAX_CHAT_HISTORY_LENGTH)
        return {
          ...state,
          capacityReached: true,
          notice: "This conversation is full. Start a new conversation to continue.",
        };
      return {
        ...state,
        example: false,
        pending: true,
        error: "",
        retryable: true,
        messages: [
          ...messages,
          {
            id: (messages.at(-1)?.id || 0) + 1,
            role: "user",
            text,
            example: false,
          },
        ],
        notice: "Your agent is thinking.",
      };
    }
    case "reply": {
      if (!state.pending) return state;
      const text = action.text.trim();
      if (!text || getPreviewMessageContent({ role: "assistant", text, interaction: action.interaction }).length > MAX_ASSISTANT_MESSAGE_LENGTH)
        return agentPreviewReducer(state, { type: "fail", error: "We couldn’t read the reply. Please retry your message." });
      return {
        ...state,
        pending: false,
        error: "",
        retryable: true,
        messages: [...state.messages, {
          id: (state.messages.at(-1)?.id || 0) + 1,
          role: "assistant",
          text,
          example: false,
          ...(action.interaction ? { interaction: action.interaction } : {}),
        }],
        notice: "Your agent replied.",
      };
    }
    case "fail":
      if (!state.pending) return state;
      return { ...state, pending: false, error: action.error, retryable: action.retryable !== false, notice: action.error };
    case "retry":
      if (!state.active || state.pending || !state.error || !state.retryable || state.messages.at(-1)?.role !== "user") return state;
      return { ...state, pending: true, error: "", notice: "Retrying your message." };
  }
}
