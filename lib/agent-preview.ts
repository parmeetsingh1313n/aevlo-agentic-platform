export type PreviewAgent = {
  agentId: string;
  name: string;
  description: string | null;
  agentImage: string;
  createdAt: string;
  version?: string;
};
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
};
export type AgentPreviewState = {
  active: boolean;
  messages: PreviewMessage[];
  example: boolean;
  notice: string;
};
export type AgentPreviewAction =
  | { type: "toggle" | "clear" | "example" }
  | { type: "send"; text: string };
export const MAX_PREVIEW_MESSAGE_LENGTH = 4000;
export const MAX_PREVIEW_MESSAGES = 100;
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
  };
}
/** Conversation previews are local; they never create AI responses or database writes. */
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
          ? "Conversation preview paused."
          : "Conversation preview resumed.",
      };
    case "clear":
      return {
        ...state,
        messages: [],
        example: false,
        notice: "New conversation preview. Messages are not saved.",
      };
    case "example":
      return {
        ...state,
        messages: exampleMessages.map((message) => ({ ...message })),
        example: true,
        notice: "Showing illustrative messages, not live AI responses.",
      };
    case "send": {
      const text = action.text.trim();
      if (!state.active || !text || text.length > MAX_PREVIEW_MESSAGE_LENGTH)
        return state;
      const messages = state.example ? [] : state.messages;
      if (messages.length >= MAX_PREVIEW_MESSAGES)
        return {
          ...state,
          notice: "This preview is full. Start a new conversation to continue.",
        };
      return {
        ...state,
        example: false,
        messages: [
          ...messages,
          {
            id: (messages.at(-1)?.id || 0) + 1,
            role: "user",
            text,
            example: false,
          },
        ],
        notice:
          "Message added to this preview. Live AI replies are not available yet.",
      };
    }
  }
}
