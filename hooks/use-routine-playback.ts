"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { getNextRoutineDelay, getRoutinePhase, ROUTINE_CYCLE_MS, type RoutinePhase } from "@/lib/routine-motion";

const motionQuery = "(prefers-reduced-motion: reduce)";
function subscribeMotionPreference(callback: () => void) {
  const query = window.matchMedia(motionQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
const getReducedMotion = () => window.matchMedia(motionQuery).matches;
const getServerReducedMotion = () => true;

/** Small demo clock: one timer per beat, never a per-frame React render. */
export function useRoutinePlayback(container: RefObject<HTMLElement | null>, selection: number, singlePass = false) {
  const reducedMotion = useSyncExternalStore(subscribeMotionPreference, getReducedMotion, getServerReducedMotion);
  const [phase, setPhase] = useState<RoutinePhase>(4);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [revision, setRevision] = useState(0);
  const clock = useRef({ elapsed: 0, epoch: 0 });
  const frozenAt = useRef<number | null>(null);
  const motionState = reducedMotion ? "reduced" : paused ? "paused" : visible ? "playing" : "suspended";

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let intersects = false;
    const updateVisibility = () => {
      const next = intersects && document.visibilityState === "visible";
      if (!next && frozenAt.current === null) frozenAt.current = performance.now();
      setVisible(next);
    };
    const observer = new IntersectionObserver(([entry]) => {
      intersects = entry.isIntersecting;
      updateVisibility();
    }, { threshold: 0.15 });
    observer.observe(element);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, [container]);

  useEffect(() => {
    if (motionState !== "playing") return;
    const epoch = clock.current.epoch;
    const savedElapsed = clock.current.elapsed;
    const startedAt = performance.now();
    frozenAt.current = null;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      if (clock.current.epoch !== epoch || document.visibilityState !== "visible") return;
      const totalElapsed = savedElapsed + performance.now() - startedAt;
      const elapsed = singlePass ? totalElapsed : totalElapsed % ROUTINE_CYCLE_MS;
      setPhase(getRoutinePhase(elapsed, singlePass));
      const delay = getNextRoutineDelay(elapsed, singlePass);
      if (delay !== null) timer = setTimeout(tick, delay + 4);
    };
    timer = setTimeout(tick, 0);
    return () => {
      clearTimeout(timer);
      // A replay invalidates the old effect; its cleanup cannot undo the reset.
      if (clock.current.epoch === epoch) {
        const stoppedAt = frozenAt.current ?? performance.now();
        const elapsed = savedElapsed + Math.max(0, stoppedAt - startedAt);
        clock.current.elapsed = singlePass ? elapsed : elapsed % ROUTINE_CYCLE_MS;
      }
    };
  }, [motionState, selection, revision, singlePass]);

  const togglePause = () => {
    if (!paused) frozenAt.current = performance.now();
    setPaused(!paused);
  };
  const replay = () => {
    clock.current = { elapsed: 0, epoch: clock.current.epoch + 1 };
    frozenAt.current = null;
    setPhase(0);
    setPaused(false);
    setRevision((value) => value + 1);
  };

  return { phase: reducedMotion ? 4 as RoutinePhase : phase, paused, reducedMotion, motionState, togglePause, replay, restart: replay };
}
