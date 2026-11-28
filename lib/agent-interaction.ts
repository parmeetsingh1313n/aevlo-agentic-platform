import { z } from "zod";

export const MAX_AGENT_QUESTIONS = 3;
export const MAX_AGENT_QUESTION_OPTIONS = 5;
export const MAX_AGENT_QUESTION_PROMPT_LENGTH = 300;
export const MAX_AGENT_OPTION_LABEL_LENGTH = 80;
export const MAX_AGENT_OPTION_DESCRIPTION_LENGTH = 200;
export const MAX_AGENT_ANSWER_CUSTOM_LENGTH = 500;
export const MAX_AGENT_INTERACTION_ANSWER_LENGTH = 4000;

export type AgentQuestion = {
  id: string;
  prompt: string;
  mode: "single" | "multiple";
  options: { id: string; label: string; description?: string }[];
};
export type AgentInteraction = { id: string; questions: AgentQuestion[] };
export type AgentInteractionAnswer = {
  questionId: string;
  optionIds: string[];
  customText: string;
};

const identifierSchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/);
const optionSchema = z.object({
  id: identifierSchema,
  label: z.string().min(1).max(MAX_AGENT_OPTION_LABEL_LENGTH),
  description: z.string().max(MAX_AGENT_OPTION_DESCRIPTION_LENGTH).optional(),
}).strict();
const questionSchema = z.object({
  id: identifierSchema,
  prompt: z.string().min(1).max(MAX_AGENT_QUESTION_PROMPT_LENGTH),
  mode: z.enum(["single", "multiple"]),
  options: z.array(optionSchema).min(2).max(MAX_AGENT_QUESTION_OPTIONS),
}).strict();

/** Model-authored questions contain no trusted interaction identifier. */
export const questionToolInputSchema = z.object({
  questions: z.array(questionSchema).min(1).max(MAX_AGENT_QUESTIONS),
}).strict();

function normalizeQuestions(questions: z.infer<typeof questionToolInputSchema>["questions"]): AgentQuestion[] | null {
  const questionIds = new Set<string>();
  const normalized: AgentQuestion[] = [];
  for (const question of questions) {
    if (questionIds.has(question.id) || !question.prompt.trim()) return null;
    questionIds.add(question.id);
    const optionIds = new Set<string>();
    const labels = new Set<string>();
    const options: AgentQuestion["options"] = [];
    for (const option of question.options) {
      const label = option.label.trim();
      if (optionIds.has(option.id) || !label || labels.has(label.toLowerCase())) return null;
      optionIds.add(option.id);
      labels.add(label.toLowerCase());
      const description = option.description?.trim();
      options.push({ id: option.id, label, ...(description ? { description } : {}) });
    }
    normalized.push({ id: question.id, prompt: question.prompt.trim(), mode: question.mode, options });
  }
  return normalized;
}

export function parseQuestionRequest(value: unknown): { questions: AgentQuestion[] } | null {
  const parsed = questionToolInputSchema.safeParse(value);
  if (!parsed.success) return null;
  const questions = normalizeQuestions(parsed.data.questions);
  return questions ? { questions } : null;
}

export function parseAgentInteraction(value: unknown): AgentInteraction | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => key !== "id" && key !== "questions")) return null;
  const id = identifierSchema.safeParse(input.id);
  const request = parseQuestionRequest({ questions: input.questions });
  return id.success && request ? { id: id.data, questions: request.questions } : null;
}

/** Include question context in ordinary assistant history, independently of UI metadata. */
export function formatInteractionPrompt(questions: AgentQuestion[]): string {
  const parsed = parseQuestionRequest({ questions });
  if (!parsed) throw new Error("Invalid agent questions.");
  return parsed.questions.map((question, index) => {
    const instruction = question.mode === "multiple" ? "Choose any that apply, or write your own answer." : "Choose one, or write your own answer.";
    const options = question.options.map((option) => `- ${option.label}${option.description ? `: ${option.description}` : ""}`).join("\n");
    return `${index + 1}. ${question.prompt}\n${instruction}\n${options}`;
  }).join("\n\n");
}

/** UI selections become a bounded user turn; opaque IDs never substitute for answer text. */
export function formatInteractionAnswers(interaction: AgentInteraction, answers: unknown): string | null {
  const parsed = parseAgentInteraction(interaction);
  if (!parsed || !Array.isArray(answers) || answers.length !== parsed.questions.length) return null;
  const byQuestion = new Map<string, AgentInteractionAnswer>();
  for (const value of answers) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const answer = value as Record<string, unknown>;
    if (Object.keys(answer).some((key) => !["questionId", "optionIds", "customText"].includes(key)) ||
      typeof answer.questionId !== "string" || byQuestion.has(answer.questionId) ||
      !Array.isArray(answer.optionIds) || answer.optionIds.length > MAX_AGENT_QUESTION_OPTIONS ||
      answer.optionIds.some((id) => typeof id !== "string") ||
      new Set(answer.optionIds).size !== answer.optionIds.length ||
      typeof answer.customText !== "string" || answer.customText.length > MAX_AGENT_ANSWER_CUSTOM_LENGTH) return null;
    byQuestion.set(answer.questionId, {
      questionId: answer.questionId,
      optionIds: answer.optionIds as string[],
      customText: answer.customText.trim(),
    });
  }
  const sections: string[] = [];
  for (const [index, question] of parsed.questions.entries()) {
    const answer = byQuestion.get(question.id);
    if (!answer || (question.mode === "single" && answer.optionIds.length > 1) ||
      (!answer.optionIds.length && !answer.customText)) return null;
    const options = new Map(question.options.map((option) => [option.id, option.label]));
    if (answer.optionIds.some((id) => !options.has(id))) return null;
    const labels = question.options.filter((option) => answer.optionIds.includes(option.id)).map((option) => option.label);
    const content = [
      labels.length ? `Selected: ${labels.join("; ")}` : "",
      answer.customText ? `My answer: ${answer.customText}` : "",
    ].filter(Boolean).join("\n");
    sections.push(`${index + 1}. ${question.prompt}\n${content}`);
  }
  const text = `Answers to your questions:\n\n${sections.join("\n\n")}`;
  return text.length <= MAX_AGENT_INTERACTION_ANSWER_LENGTH ? text : null;
}
