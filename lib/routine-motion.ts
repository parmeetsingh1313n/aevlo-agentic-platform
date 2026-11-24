export type RoutinePhase = 0 | 1 | 2 | 3 | 4;
export type RoutineStepState = "waiting" | "active" | "complete";

export const ROUTINE_CYCLE_MS = 9600;
const boundaries = [600, 2400, 4200, 6000, ROUTINE_CYCLE_MS] as const;
// Auth has no playback controls: one short sequence, then a readable resting state.
const authBoundaries = [300, 1400, 2500, 3600] as const;

function cycleTime(elapsedMs: number): number {
  return ((elapsedMs % ROUTINE_CYCLE_MS) + ROUTINE_CYCLE_MS) % ROUTINE_CYCLE_MS;
}

export function getRoutinePhase(elapsedMs: number, singlePass = false): RoutinePhase {
  if (singlePass) {
    const phase = authBoundaries.findIndex((boundary) => Math.max(0, elapsedMs) < boundary);
    return (phase === -1 ? 4 : phase) as RoutinePhase;
  }
  const elapsed = cycleTime(elapsedMs);
  return boundaries.findIndex((boundary) => elapsed < boundary) as RoutinePhase;
}

export function getNextRoutineDelay(elapsedMs: number, singlePass = false): number | null {
  if (singlePass) {
    const elapsed = Math.max(0, elapsedMs);
    const next = authBoundaries.find((boundary) => elapsed < boundary);
    return next === undefined ? null : next - elapsed;
  }
  const elapsed = cycleTime(elapsedMs);
  const next = boundaries.find((boundary) => elapsed < boundary) ?? ROUTINE_CYCLE_MS;
  return next - elapsed;
}

export function getRoutineStepState(index: number, phase: RoutinePhase): RoutineStepState {
  if (phase === 4 || index < phase - 1) return "complete";
  return index === phase - 1 ? "active" : "waiting";
}
