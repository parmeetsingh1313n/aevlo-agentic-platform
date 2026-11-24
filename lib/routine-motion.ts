export type RoutinePhase = 0 | 1 | 2 | 3 | 4;
export type RoutineStepState = "waiting" | "active" | "complete";

export const ROUTINE_CYCLE_MS = 9600;
const boundaries = [600, 2400, 4200, 6000, ROUTINE_CYCLE_MS] as const;

function cycleTime(elapsedMs: number): number {
  return ((elapsedMs % ROUTINE_CYCLE_MS) + ROUTINE_CYCLE_MS) % ROUTINE_CYCLE_MS;
}

export function getRoutinePhase(elapsedMs: number): RoutinePhase {
  const elapsed = cycleTime(elapsedMs);
  return boundaries.findIndex((boundary) => elapsed < boundary) as RoutinePhase;
}

export function getNextRoutineDelay(elapsedMs: number): number {
  const elapsed = cycleTime(elapsedMs);
  const next = boundaries.find((boundary) => elapsed < boundary) ?? ROUTINE_CYCLE_MS;
  return next - elapsed;
}

export function getRoutineStepState(index: number, phase: RoutinePhase): RoutineStepState {
  if (phase === 4 || index < phase - 1) return "complete";
  return index === phase - 1 ? "active" : "waiting";
}
