"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { CalendarDays, Check, Clock3, FileText, Pause, Play, RotateCcw, ScanText, Sunrise } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand";
import { useRoutinePlayback } from "@/hooks/use-routine-playback";
import { getRoutineStepState } from "@/lib/routine-motion";
import { cn } from "@/lib/utils";
import { authStyles as styles } from "./auth-styles";

const examples = [
  {
    name: "Morning brief", title: "A clear head start.", schedule: "Weekdays at 9:00", icon: Sunrise,
    steps: [
      { time: "09:00", title: "Find what matters", detail: "The news and notes worth your attention", icon: ScanText },
      { time: "09:01", title: "Put the brief together", detail: "The important bits, without the noise", icon: FileText },
      { time: "09:02", title: "Ready for your review", detail: "One thoughtful summary to start your day", icon: Check },
    ],
  },
  {
    name: "Weekly recap", title: "Your week, in perspective.", schedule: "Fridays at 16:00", icon: CalendarDays,
    steps: [
      { time: "16:00", title: "Gather the week’s updates", detail: "Progress from the tools you work in", icon: ScanText },
      { time: "16:01", title: "Connect the important dots", detail: "Wins, loose ends, and what comes next", icon: FileText },
      { time: "16:02", title: "A recap you can review", detail: "A clear picture before you close the week", icon: Check },
    ],
  },
];

export function RoutinePreview({ enhancedMotion = false }: { enhancedMotion?: boolean } = {}) {
  const [selected, setSelected] = useState(0);
  const container = useRef<HTMLElement | null>(null);
  const card = useRef<HTMLDivElement | null>(null);
  const paper = useRef<HTMLDivElement | null>(null);
  const pointerRect = useRef<DOMRect | null>(null);
  const pointerFrame = useRef<number | null>(null);
  const pointerPosition = useRef({ x: 0, y: 0 });
  const playback = useRoutinePlayback(container, selected, enhancedMotion);
  const example = examples[selected];
  const Icon = example.icon;
  const canTilt = !playback.reducedMotion && (!enhancedMotion || playback.motionState === "playing");

  const resetTilt = useCallback(() => {
    if (pointerFrame.current !== null) cancelAnimationFrame(pointerFrame.current);
    pointerFrame.current = null;
    pointerRect.current = null;
    card.current?.style.removeProperty("--tilt-x");
    card.current?.style.removeProperty("--tilt-y");
    paper.current?.style.removeProperty("--paper-x");
    paper.current?.style.removeProperty("--paper-y");
  }, []);

  useEffect(() => {
    if (!canTilt) resetTilt();
    return resetTilt;
  }, [canTilt, resetTilt]);

  const enterCard = (event: PointerEvent<HTMLDivElement>) => {
    if (canTilt && event.pointerType === "mouse") {
      pointerRect.current = event.currentTarget.getBoundingClientRect();
    }
  };
  const moveCard = (event: PointerEvent<HTMLDivElement>) => {
    const rect = pointerRect.current;
    if (!canTilt || event.pointerType !== "mouse" || !rect) return;
    pointerPosition.current = {
      x: Math.max(-0.5, Math.min(0.5, (event.clientX - rect.left) / rect.width - 0.5)),
      y: Math.max(-0.5, Math.min(0.5, (event.clientY - rect.top) / rect.height - 0.5)),
    };
    if (pointerFrame.current !== null) return;
    pointerFrame.current = requestAnimationFrame(() => {
      const point = pointerPosition.current;
      card.current?.style.setProperty("--tilt-x", `${(-point.y * 3).toFixed(2)}deg`);
      card.current?.style.setProperty("--tilt-y", `${(point.x * 4).toFixed(2)}deg`);
      if (enhancedMotion) {
        paper.current?.style.setProperty("--paper-x", `${(-point.x * 6).toFixed(2)}px`);
        paper.current?.style.setProperty("--paper-y", `${(-point.y * 4).toFixed(2)}px`);
      }
      pointerFrame.current = null;
    });
  };

  return (
    <figure ref={container} className={styles.preview} data-example-routine="true" data-motion={playback.motionState} data-phase={playback.phase}>
      <figcaption className={styles.previewCaption}>
        <span>Example routine</span>
        {!enhancedMotion && <div className={styles.previewControls} role="group" aria-label="Example animation controls">
          <Button type="button" variant="ghost" size="icon" className={styles.previewControl}
            aria-label={playback.paused ? "Play example animation" : "Pause example animation"}
            aria-pressed={playback.paused} disabled={playback.reducedMotion}
            title={playback.reducedMotion ? "Reduced motion is enabled" : playback.paused ? "Play animation" : "Pause animation"}
            onClick={playback.togglePause}>
            {playback.paused ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}
          </Button>
          <Button type="button" variant="ghost" size="icon" className={styles.previewControl}
            aria-label="Replay example animation" title="Replay animation" onClick={playback.replay}>
            <RotateCcw size={13} aria-hidden="true" />
          </Button>
        </div>}
      </figcaption>
      <div className={styles.routineChoices} role="group" aria-label="Choose an example routine">
        {examples.map((item, index) => (
          <Button type="button" variant="ghost" key={item.name} aria-pressed={selected === index}
            className={cn(styles.routineChoice, selected === index && styles.routineChoiceActive, enhancedMotion && styles.authChoice)}
            onClick={() => { if (selected !== index) { playback.restart(); resetTilt(); setSelected(index); } }}>
            <span className={enhancedMotion ? styles.authChoiceLabel : undefined}>{item.name}</span>
          </Button>
        ))}
      </div>
      <span className="sr-only" role="status">{example.name} selected.{playback.paused ? " Animation paused." : ""}</span>
      <div className={styles.previewScene} onPointerEnter={enterCard} onPointerMove={moveCard} onPointerLeave={resetTilt}>
        <div key={enhancedMotion ? `paper-${selected}` : "paper"} ref={paper} className={cn(styles.previewPaper, enhancedMotion && styles.authPaperMotion)} aria-hidden="true" />
        <div key={selected} className={enhancedMotion ? styles.authCardMotion : styles.cardMotion}>
          <div ref={card} className={styles.routineCard}>
            <header className={styles.routineHeader}>
              <span className={styles.routineIcon}><Icon size={23} strokeWidth={1.5} aria-hidden="true" /></span>
              <div className={styles.routineTitle}>
                <h3>{example.title}</h3>
                <p><Clock3 size={12} aria-hidden="true" /> {example.schedule}</p>
              </div>
              <BrandMark className={styles.cardMark} />
            </header>
            <ol className={styles.routineSteps}>
              {example.steps.map((step, index) => {
                const state = getRoutineStepState(index, playback.phase);
                const StepIcon = state === "complete" ? Check : step.icon;
                return (
                  <li key={`${example.name}-${step.time}`} className={styles.routineStep} data-state={state}
                    style={enhancedMotion ? { "--step-order": index } as CSSProperties : undefined}>
                    <time className={styles.stepTime} dateTime={step.time}>{step.time}</time>
                    <span className={cn(styles.stepIcon, state === "complete" && styles.stepComplete, enhancedMotion && styles.authStepIcon)}>
                      {state === "active" && <>
                        {enhancedMotion && <span className={styles.authNodeEcho} aria-hidden="true" />}
                        <span className={enhancedMotion ? styles.authNodeHalo : styles.nodeHalo} aria-hidden="true" />
                      </>}
                      <StepIcon className={state === "complete" ? enhancedMotion ? styles.authStepCheck : styles.stepCheck : ""} size={14} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <div className={cn(styles.stepCopy, enhancedMotion && styles.authStepCopy)}><p>{step.title}</p><span>{step.detail}</span></div>
                    {index < 2 && <>
                      <span className={enhancedMotion ? styles.authFlowBeam : styles.flowBeam} aria-hidden="true" />
                      {enhancedMotion ? (
                        <span className={styles.authFlowCarrier} aria-hidden="true">
                          <span className={styles.authFlowTrack}><span className={styles.authFlowTrail} /><span className={styles.authFlowSpark} /></span>
                        </span>
                      ) : <span className={styles.flowToken} aria-hidden="true" />}
                    </>}
                  </li>
                );
              })}
            </ol>
            <div className={styles.routineFootnote}>
              <span className={cn(styles.statusDot, enhancedMotion && playback.phase === 4 && styles.authStepCheck)} aria-hidden="true" />
              You set the direction. Your agent follows through.
            </div>
          </div>
        </div>
      </div>
    </figure>
  );
}
