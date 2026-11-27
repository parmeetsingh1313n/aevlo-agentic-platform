"use client";
import { useRef } from "react";
import { ArrowUp, CornerDownLeft, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_PREVIEW_MESSAGE_LENGTH } from "@/lib/agent-preview";
import styles from "./agent-space.module.css";
export function ChatComposer({
  active,
  draft,
  onDraft,
  onSend,
}: {
  active: boolean;
  draft: string;
  onDraft: (value: string) => void;
  onSend: (text: string) => boolean;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  function submit() {
    if (!active || !draft.trim()) return;
    if (!onSend(draft)) return;
    onDraft("");
    if (textarea.current) textarea.current.style.height = "auto";
  }
  return (
    <div className="shrink-0 px-4 pt-3 pb-4 sm:px-7">
      <form
        aria-label="Conversation preview"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className={styles.composer}
      >
        <label htmlFor="agent-message" className="sr-only">
          Message your agent
        </label>
        <textarea
          id="agent-message"
          ref={textarea}
          rows={2}
          value={draft}
          disabled={!active}
          maxLength={MAX_PREVIEW_MESSAGE_LENGTH}
          placeholder={
            active
              ? "Message your agent…"
              : "Resume the preview to write a message"
          }
          aria-describedby="composer-help"
          onChange={(event) => {
            onDraft(event.target.value);
            event.target.style.height = "auto";
            event.target.style.height = `${Math.min(event.target.scrollHeight, 144)}px`;
          }}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              submit();
            }
          }}
          className="max-h-36 min-h-12 w-full resize-none bg-transparent px-4 pt-3 text-sm leading-6 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
        <div className="flex items-center justify-between gap-3 px-3 pt-1 pb-3">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <LockKeyhole size={13} aria-hidden="true" />
            Local preview
          </span>
          <div className="flex items-center gap-3">
            {draft.length > 3200 && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {draft.length} / 4000
              </span>
            )}
            <Button
              type="submit"
              size="icon-lg"
              disabled={!active || !draft.trim()}
              aria-label="Send preview message"
              className="rounded-xl motion-reduce:transition-none"
            >
              <ArrowUp className="size-5" />
            </Button>
          </div>
        </div>
      </form>
      <div
        id="composer-help"
        className="mt-2.5 flex items-center justify-between gap-3 text-[11px] leading-4 text-muted-foreground"
      >
        <span>
          Messages stay on this page. Live AI replies are not available yet.
        </span>
        <span className="hidden shrink-0 items-center gap-1.5 md:flex">
          <CornerDownLeft size={12} aria-hidden="true" />
          Send <span className="mx-1">·</span> Shift + Enter for a new line
        </span>
      </div>
    </div>
  );
}
