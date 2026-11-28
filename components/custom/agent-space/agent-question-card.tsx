"use client";

import { useId, useRef, useState } from "react";
import { ArrowUp, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  formatInteractionAnswers,
  MAX_AGENT_ANSWER_CUSTOM_LENGTH,
  type AgentInteraction,
  type AgentInteractionAnswer,
} from "@/lib/agent-interaction";
import styles from "./agent-question-card.module.css";

type Props = {
  interaction: AgentInteraction;
  disabled?: boolean;
  answered?: boolean;
  onSubmit: (message: string) => boolean;
};

export function AgentQuestionCard(props: Props) {
  return <QuestionCardForm key={props.interaction.id} {...props} />;
}

function QuestionCardForm({ interaction, disabled = false, answered = false, onSubmit }: Props) {
  const formId = useId();
  const submittedRef = useRef(false);
  const [submitted, setSubmitted] = useState(false);
  const [answers, setAnswers] = useState<AgentInteractionAnswer[]>(() => interaction.questions.map((question) => ({
    questionId: question.id,
    optionIds: [],
    customText: "",
  })));
  const [error, setError] = useState("");
  const complete = answered || submitted;
  const message = formatInteractionAnswers(interaction, answers);

  function updateAnswer(questionId: string, update: (answer: AgentInteractionAnswer) => AgentInteractionAnswer) {
    if (disabled || complete || submittedRef.current) return;
    setError("");
    setAnswers((previous) => previous.map((answer) => answer.questionId === questionId ? update(answer) : answer));
  }

  function submit() {
    if (disabled || complete || submittedRef.current) return;
    const formatted = formatInteractionAnswers(interaction, answers);
    if (!formatted) {
      setError("Choose an option or write an answer for each question.");
      return;
    }
    submittedRef.current = true;
    let accepted = false;
    try { accepted = onSubmit(formatted); }
    catch { /* Keep the answers available when the conversation cannot accept them. */ }
    if (!accepted) {
      submittedRef.current = false;
      setError("Your answers weren’t sent. Keep them here and try again.");
      return;
    }
    setSubmitted(true);
    setAnswers([]);
    setError("");
  }

  if (complete) return (
    <section className={styles.completed} aria-label="Answered agent questions">
      <Check size={15} aria-hidden="true" />
      <div>
        <p className={styles.completedTitle}>Details provided</p>
        <p className={styles.hint}>Your answers are included in the conversation.</p>
      </div>
    </section>
  );

  return (
    <form className={styles.form} data-agent-question-id={interaction.id} aria-label="Answer your agent’s questions" onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <div className={styles.heading}>
        <h3>A few details to continue</h3>
        <p className={styles.hint}>Choose an answer, write your own, or add context to your selection.</p>
      </div>
      <div className={styles.questions}>
        {interaction.questions.map((question, questionIndex) => {
          const answer = answers.find((item) => item.questionId === question.id);
          const optionIds = answer?.optionIds ?? [];
          const questionId = `${formId}-question-${questionIndex}`;
          const helpId = `${questionId}-help`;
          return (
            <fieldset key={question.id} className={styles.question} disabled={disabled}>
              <legend>{question.prompt}</legend>
              <p id={helpId} className={styles.hint}>{question.mode === "multiple" ? "Choose any that apply, or write your own answer." : "Choose one, or write your own answer."}</p>
              <div className={styles.options}>
                {question.options.map((option, optionIndex) => {
                  const id = `${questionId}-option-${optionIndex}`;
                  const selected = optionIds.includes(option.id);
                  return (
                    <label key={option.id} htmlFor={id} className={styles.option} data-selected={selected}>
                      <input
                        id={id}
                        type={question.mode === "multiple" ? "checkbox" : "radio"}
                        name={questionId}
                        checked={selected}
                        aria-describedby={option.description ? `${id}-description` : helpId}
                        onChange={() => updateAnswer(question.id, (current) => ({
                          ...current,
                          optionIds: question.mode === "single" ? [option.id] : current.optionIds.includes(option.id)
                            ? current.optionIds.filter((item) => item !== option.id)
                            : [...current.optionIds, option.id],
                        }))}
                      />
                      <span className={styles.optionCopy}>
                        <span className={styles.optionLabel}>{option.label}</span>
                        {option.description && <span id={`${id}-description`} className={styles.optionDescription}>{option.description}</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className={styles.customHeading}>
                <label htmlFor={`${questionId}-custom`}>Your answer or extra context</label>
                {optionIds.length > 0 && <button type="button" className={styles.clear} onClick={() => updateAnswer(question.id, (current) => ({ ...current, optionIds: [] }))}>Clear selection</button>}
              </div>
              <textarea
                id={`${questionId}-custom`}
                rows={2}
                maxLength={MAX_AGENT_ANSWER_CUSTOM_LENGTH}
                value={answer?.customText ?? ""}
                placeholder="Write what fits your task…"
                onChange={(event) => updateAnswer(question.id, (current) => ({ ...current, customText: event.target.value }))}
              />
            </fieldset>
          );
        })}
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.footer}>
        <p className={styles.hint}>{disabled ? "Continue when the conversation is ready." : "Your answers help the agent choose the next step."}</p>
        <Button type="submit" disabled={disabled || !message} size="lg" className={styles.submit}>
          Continue <ArrowUp size={14} aria-hidden="true" />
        </Button>
      </div>
    </form>
  );
}
