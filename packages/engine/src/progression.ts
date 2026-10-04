import { getExercise } from "@repcurve/exercises";
import { availableDumbbellLoadsKg, e1RM, nextOwnedLoad, prevOwnedLoad } from "@repcurve/shared";
import type { Equipment, Exercise, Rir, SetLog } from "@repcurve/shared";
import { isLoaded } from "./loads.js";
import type { Pool } from "./types.js";

export interface ExerciseState {
  exerciseId: string;
  loadKg: number | null;
  repRange: [number, number];
  targetRir: Rir;
  /** Consecutive sessions that were too hard. */
  stalls: number;
  /** Best e1RM seen, kg per dumbbell (or effective bodyweight load). */
  e1rmKg: number | null;
}

export type ProgressionAction =
  | "hold"
  | "add_rep"
  | "load_up"
  | "ladder_up"
  | "widen_range"
  | "load_down"
  | "ladder_down"
  | "stall_noted";

export interface ProgressionResult {
  next: ExerciseState;
  action: ProgressionAction;
  reason: string;
}

/** Load steps up to this fraction heavier are taken as soon as the top of the range is hit. */
export const SMALL_STEP = 0.15;

function ladderNeighbour(e: Exercise, pool: Pool, dir: 1 | -1): Exercise | null {
  const ladder = pool.byLadder.get(e.ladder) ?? [];
  return ladder.find((x) => x.ladderLevel === e.ladderLevel + dir) ?? null;
}

export function progressExercise(
  state: ExerciseState,
  logs: SetLog[],
  equipment: Equipment,
  pool: Pool,
): ProgressionResult {
  const sets = logs.filter((l) => l.exerciseId === state.exerciseId);
  if (sets.length === 0) return { next: state, action: "hold", reason: "No sets logged." };

  const e = getExercise(state.exerciseId);
  const [lo, hi] = state.repRange;
  const owned = availableDumbbellLoadsKg(equipment.dumbbells);
  const avgRir = sets.reduce((s, x) => s + x.rir, 0) / sets.length;
  const allTop = sets.every((s) => s.reps >= hi);
  const anyBelow = sets.some((s) => s.reps < lo);
  const tooHard = anyBelow || avgRir < state.targetRir - 1;

  let bestE1rm = state.e1rmKg ?? 0;
  for (const s of sets) {
    if (s.loadKg !== null) bestE1rm = Math.max(bestE1rm, e1RM(s.loadKg, s.reps, s.rir));
  }
  const base: ExerciseState = { ...state, e1rmKg: bestE1rm > 0 ? bestE1rm : state.e1rmKg };

  if (tooHard) {
    const stalls = state.stalls + 1;
    if (stalls < 2) {
      return { next: { ...base, stalls }, action: "stall_noted", reason: "That was too hard once; same again next time, one more miss and we step back." };
    }
    if (isLoaded(e) && state.loadKg !== null) {
      const prev = prevOwnedLoad(state.loadKg, owned);
      if (prev !== null) {
        return { next: { ...base, loadKg: prev, stalls: 0 }, action: "load_down", reason: "Two hard sessions in a row: dropping one dumbbell and rebuilding reps." };
      }
    }
    const down = ladderNeighbour(e, pool, -1);
    if (down) {
      return {
        next: { ...base, exerciseId: down.id, loadKg: state.loadKg, stalls: 0, e1rmKg: null },
        action: "ladder_down",
        reason: `Two hard sessions in a row: switching to ${down.name} to rebuild.`,
      };
    }
    return { next: { ...base, stalls: 0 }, action: "hold", reason: "Too hard twice but nothing lighter is available; hold and aim for the bottom of the range." };
  }

  if (allTop && avgRir >= state.targetRir) {
    if (isLoaded(e) && state.loadKg !== null) {
      const next = nextOwnedLoad(state.loadKg, owned);
      if (next !== null && next / state.loadKg - 1 <= SMALL_STEP) {
        return { next: { ...base, loadKg: next, stalls: 0 }, action: "load_up", reason: "Top of the rep range with reps to spare: next dumbbell up, reps reset to the bottom of the range." };
      }
      const up = ladderNeighbour(e, pool, 1);
      if (up) {
        return {
          next: { ...base, exerciseId: up.id, loadKg: state.loadKg, stalls: 0, e1rmKg: null },
          action: "ladder_up",
          reason: `Owned the rep range: moving up to ${up.name} at the same weight.`,
        };
      }
      if (next !== null) {
        return { next: { ...base, loadKg: next, stalls: 0 }, action: "load_up", reason: "Big jump to the next dumbbell, but you've earned it: reps reset to the bottom of the range." };
      }
      return { next: { ...base, repRange: [lo, Math.min(30, hi + 3)], stalls: 0 }, action: "widen_range", reason: "Heaviest dumbbell you own and nothing harder on this ladder: adding reps." };
    }
    const up = ladderNeighbour(e, pool, 1);
    if (up) {
      return { next: { ...base, exerciseId: up.id, stalls: 0, e1rmKg: null }, action: "ladder_up", reason: `Owned the rep range: moving up to ${up.name}.` };
    }
    return { next: { ...base, repRange: [lo, Math.min(30, hi + 3)], stalls: 0 }, action: "widen_range", reason: "Hardest variant available: adding reps." };
  }

  return { next: { ...base, stalls: 0 }, action: "add_rep", reason: "Same weight next time; aim for one more rep on your weakest set." };
}
