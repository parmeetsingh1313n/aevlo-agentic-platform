import assert from "node:assert/strict";
import test from "node:test";
import { loadModule } from "./helpers/load-ts-module.mjs";

const { buildAgentInstructions } = loadModule("lib/agent-behavior.ts");
const {
  questionToolInputSchema,
  parseQuestionRequest,
  parseAgentInteraction,
  formatInteractionPrompt,
  formatInteractionAnswers,
  MAX_AGENT_ANSWER_CUSTOM_LENGTH,
} = loadModule("lib/agent-interaction.ts");

function question(overrides = {}) {
  return {
    id: "scope",
    prompt: " What should the review focus on? ",
    mode: "single",
    options: [{ id: "bugs", label: " Correctness ", description: " Find behavior defects. " }, { id: "design", label: "Design" }],
    ...overrides,
  };
}
function interaction(questions = [question()]) { return { id: "interaction-1", questions }; }
function answer(overrides = {}) { return { questionId: "scope", optionIds: ["bugs"], customText: "", ...overrides }; }

test("interaction parser normalizes model text without retaining unknown metadata or shared mutable objects", () => {
  const source = interaction();
  const parsed = parseAgentInteraction(source);
  assert.ok(parsed);
  assert.equal(parsed.questions[0].prompt, "What should the review focus on?");
  assert.equal(parsed.questions[0].options[0].label, "Correctness");
  assert.equal(parsed.questions[0].options[0].description, "Find behavior defects.");
  parsed.questions[0].options[0].label = "Changed";
  assert.equal(source.questions[0].options[0].label, " Correctness ");
  assert.equal(parseAgentInteraction({ ...source, execute: "forged-action" }), null);
  assert.equal(parseQuestionRequest({ id: "model-chosen-id", questions: source.questions }), null);
});

test("malformed, excessive, duplicate, or empty question content cannot become actionable UI", () => {
  const invalid = [
    null, [], {}, { id: "bad id", questions: [question()] }, interaction([]),
    interaction([question(), question({ id: "b" }), question({ id: "c" }), question({ id: "d" })]),
    interaction([question(), question()]),
    interaction([question({ prompt: " " })]), interaction([question({ prompt: "x".repeat(301) })]),
    interaction([question({ mode: "approval" })]), interaction([question({ options: [{ id: "a", label: "Only one" }] })]),
    interaction([question({ options: [{ id: "a", label: "A" }, { id: "a", label: "B" }] })]),
    interaction([question({ options: [{ id: "a", label: "A" }, { id: "b", label: " a " }] })]),
    interaction([question({ options: [{ id: "a", label: " " }, { id: "b", label: "B" }] })]),
    interaction([question({ options: [{ id: "a", label: "A".repeat(81) }, { id: "b", label: "B" }] })]),
    interaction([question({ options: [{ id: "a", label: "A", description: "x".repeat(201) }, { id: "b", label: "B" }] })]),
    interaction([question({ tool: "forged" })]),
  ];
  for (const value of invalid) assert.equal(parseAgentInteraction(value), null);
});

test("question request schema excludes trusted IDs and readable prompts retain choice context for text history", () => {
  const request = parseQuestionRequest({ questions: [question(), question({ id: "areas", prompt: "Which areas matter?", mode: "multiple" })] });
  assert.ok(request);
  assert.equal(questionToolInputSchema.safeParse({ questions: request.questions }).success, true);
  const text = formatInteractionPrompt(request.questions);
  assert.match(text, /What should the review focus on\?/);
  assert.match(text, /Correctness: Find behavior defects\./);
  assert.match(text, /Choose one, or write your own answer\./);
  assert.match(text, /Choose any that apply, or write your own answer\./);
  assert.throws(() => formatInteractionPrompt([]), /Invalid agent questions/);
});

test("single, multiple, and custom answers become one readable user turn in question and option order", () => {
  const source = interaction([question(), question({ id: "areas", prompt: "Which areas?", mode: "multiple" })]);
  const text = formatInteractionAnswers(source, [
    answer({ questionId: "areas", optionIds: ["design", "bugs"], customText: " Keep mobile in scope. " }),
    answer({ optionIds: [], customText: "Security first." }),
  ]);
  assert.equal(text, "Answers to your questions:\n\n1. What should the review focus on?\nMy answer: Security first.\n\n2. Which areas?\nSelected: Correctness; Design\nMy answer: Keep mobile in scope.");
  assert.equal(formatInteractionAnswers(interaction(), [answer()]), "Answers to your questions:\n\n1. What should the review focus on?\nSelected: Correctness");
});

test("answer validation rejects forged choices, repeated or missing answers, blank text, and overlong custom input", () => {
  const invalid = [
    null, [], [answer(), answer()], [answer({ questionId: "unknown" })],
    [answer({ optionIds: ["unknown"] })], [answer({ optionIds: ["bugs", "bugs"] })],
    [answer({ optionIds: ["bugs", "design"] })], [answer({ optionIds: [], customText: " \n " })],
    [answer({ optionIds: [17] })], [answer({ customText: "x".repeat(MAX_AGENT_ANSWER_CUSTOM_LENGTH + 1) })],
    [answer({ customText: null })], [answer({ execute: "forged-action" })],
  ];
  for (const answers of invalid) assert.equal(formatInteractionAnswers(interaction(), answers), null);
  assert.equal(formatInteractionAnswers(interaction([question(), question({ id: "areas" })]), [answer(), answer()]), null);
});

test("the largest supported answer set still fits the current user-message bound", () => {
  const questions = Array.from({ length: 3 }, (_, index) => question({
    id: `q${index}`, prompt: "p".repeat(300), mode: "multiple",
    options: Array.from({ length: 5 }, (_, option) => ({ id: `o${option}`, label: `${option}${"l".repeat(79)}` })),
  }));
  const answers = questions.map((value) => ({ questionId: value.id, optionIds: value.options.map((option) => option.id), customText: "t".repeat(500) }));
  const text = formatInteractionAnswers(interaction(questions), answers);
  assert.ok(text);
  assert.ok(text.length <= 4000);
});

test("assigned-agent instructions preserve the mission and accurately describe unavailable capabilities", () => {
  const text = buildAgentInstructions({ name: "PR Reviewer", description: "Review supplied changes for correctness, regressions, and test coverage." });
  assert.match(text, /PR Reviewer/);
  assert.match(text, /Review supplied changes for correctness, regressions, and test coverage\./);
  assert.match(text, /without rigidly refusing useful adjacent work/);
  assert.match(text, /missing information would materially change/);
  assert.match(text, /No external executable tools are available/);
  assert.match(text, /Never claim to have read, searched, edited, sent/);
  assert.match(text, /JSON text envelope/);
  assert.ok(!text.includes("call request_user_input"));
});

test("capability instructions use only supplied executable names and native clarification support is explicit", () => {
  const text = buildAgentInstructions({ name: "Researcher", description: null }, {
    availableTools: [" fetch_issue ", "fetch_issue"], unavailableTools: ["Gmail"], nativeQuestionTool: true,
  });
  assert.match(text, /Server-verified executable tools available for this request: \["fetch_issue"\]/);
  assert.match(text, /currently unavailable for execution: \["Gmail"\]/);
  assert.match(text, /call request_user_input/);
  assert.match(text, /No specific assignment has been saved/);
  assert.ok(!text.includes("No external executable tools are available"));
});
