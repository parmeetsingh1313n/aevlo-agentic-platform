import "server-only";
import OpenAI from "openai";
import { Agent, OpenAIChatCompletionsModel, Runner, assistant, user, tool, type Tool } from "@openai/agents";
import { AgentChatError, type ChatMessage } from "./agent-chat-validation";
import { MAX_ASSISTANT_MESSAGE_LENGTH } from "./agent-preview";
import { buildAgentInstructions } from "./agent-behavior";
import { parseQuestionRequest, questionToolInputSchema } from "./agent-interaction";
import { parseAgentReply, type AgentReply } from "./agent-response";

export const AGENT_MODEL = "MiniMax-M3.1-Flash";
export const AGENT_BASE_URL = "https://api.hcnsec.cn/v1";
export const AGENT_TIMEOUT_MS = 120_000;
export type ExecutableAgent = { name: string; description: string | null };

type Options = {
  getApiKey?: () => string | undefined;
  fetch?: typeof fetch;
};

/** Empty/malformed provider replies must fail once instead of starting another model turn. */
class CheckedChatModel extends OpenAIChatCompletionsModel {
  async getResponse(request: Parameters<OpenAIChatCompletionsModel["getResponse"]>[0]) {
    const result = await super.getResponse(request);
    let useful = false;
    for (const item of result.output) {
      if (item.type === "function_call") useful = true;
      if (item.type !== "message" || !Array.isArray(item.content)) continue;
      for (const part of item.content) {
        if (!part || typeof part !== "object") continue;
        if (part.type !== "output_text") continue;
        if (typeof part.text !== "string" || !part.text.trim() || part.text.length > MAX_ASSISTANT_MESSAGE_LENGTH) {
          throw new AgentChatError("The model did not return a usable reply. Retry your message.", 502);
        }
        useful = true;
      }
    }
    if (!useful) throw new AgentChatError("The model did not return a usable reply. Retry your message.", 502);
    return result;
  }
}

/** Client/key creation is lazy: the application can build before a key is configured. */
export function createAgentExecutor(options: Options = {}) {
  const runner = new Runner({ tracingDisabled: true, traceIncludeSensitiveData: false });
  return async (savedAgent: ExecutableAgent, messages: ChatMessage[], signal: AbortSignal, externalTools: Tool[] = []): Promise<AgentReply> => {
    const apiKey = options.getApiKey
      ? options.getApiKey()?.trim()
      : process.env.AGENT_API_KEY?.trim() || process.env.NEW_API_KEY?.trim();
    if (!apiKey) throw new AgentChatError("Chat is not configured yet. Add AGENT_API_KEY on the server and restart the app.", 503);
    const timeout = AbortSignal.timeout(AGENT_TIMEOUT_MS);
    const combinedSignal = AbortSignal.any([signal, timeout]);
    let externalInvoked = false;
    try {
      const client = new OpenAI({
        baseURL: AGENT_BASE_URL,
        apiKey,
        timeout: AGENT_TIMEOUT_MS,
        maxRetries: 0,
        ...(options.fetch ? { fetch: options.fetch } : {}),
      });
      let askedQuestions = false;
      const questions = tool({
        name: "request_user_input", description: "Ask focused questions only when a missing detail materially changes the result. Stop and wait for the user's selectable or custom answers.",
        parameters: questionToolInputSchema,
        execute: async (input) => {
          const parsed = parseQuestionRequest(input);
          if (!parsed) throw new AgentChatError("The agent returned unclear questions. Retry your message.", 502);
          askedQuestions = true;
          return JSON.stringify({ response: "A few details will help me continue.", interaction: parsed });
        },
      });
      const agent = new Agent({
        name: savedAgent.name,
        instructions: buildAgentInstructions(savedAgent, { availableTools: externalTools.flatMap((tool) => tool.type === "function" ? [tool.name] : []), nativeQuestionTool: true }),
        tools: [...externalTools.map((external) => external.type === "function" ? { ...external, invoke: async (...args: Parameters<typeof external.invoke>) => {
          externalInvoked = true;
          return external.invoke(...args);
        } } : external), questions],
        toolUseBehavior: { stopAtToolNames: [questions.name] },
        model: new CheckedChatModel(client, AGENT_MODEL, { strictFeatureValidation: true }),
        modelSettings: { temperature: 0.7, retry: { maxRetries: 0 } },
      });
      const input = messages.map((message) => message.role === "user" ? user(message.content) : assistant(message.content));
      const result = await runner.run(agent, input, { signal: combinedSignal, maxTurns: 8 });
      const response = result.finalOutput;
      // The SDK can stringify malformed upstream content into "[object Object]".
      let hasText = false;
      let invalidText = false;
      for (const item of result.output) {
        if (item.type !== "message" || !Array.isArray(item.content)) continue;
        for (const part of item.content) {
          if (part.type !== "output_text") continue;
          hasText = true;
          if (typeof part.text !== "string") invalidText = true;
        }
      }
      if ((!hasText && !askedQuestions) || invalidText ||
        typeof response !== "string" || !response.trim() || response.length > MAX_ASSISTANT_MESSAGE_LENGTH) {
        throw new AgentChatError("The model did not return a usable reply. Retry your message.", 502);
      }
      return parseAgentReply(response);
    } catch (error) {
      if (externalInvoked) throw new AgentChatError("A connected tool may have run before this reply stopped. Check its result before repeating the task, then start a new conversation.", 502, false);
      if (error instanceof AgentChatError) throw error;
      if (timeout.aborted || error instanceof OpenAI.APIConnectionTimeoutError) throw new AgentChatError("The reply took too long. Retry your message.", 504);
      if (signal.aborted) throw new AgentChatError("The reply was stopped.", 499);
      if (error instanceof OpenAI.APIError) {
        if (error.status === 401 || error.status === 403) throw new AgentChatError("The model provider rejected the server API key. Check AGENT_API_KEY and restart the app.", 503);
        if (error.status === 429) throw new AgentChatError("The model provider is busy or its quota is reached. Try again shortly.", 429);
      }
      // Upstream error bodies can contain prompts/credentials. Never return or log them.
      throw new AgentChatError("We couldn’t get a reply from the model provider. Retry your message.", 502);
    }
  };
}

export const executeAgentChat = createAgentExecutor();
