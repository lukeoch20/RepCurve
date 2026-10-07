import type { Exercise } from "@repcurve/shared";

/**
 * Seconds for one set, both sides for unilateral work. Timed from the reps the user will
 * actually do (the target) when known, else from the middle of the rep range.
 */
export function setSeconds(e: Exercise, repRange: [number, number], reps?: number): number {
  const n = reps ?? (repRange[0] + repRange[1]) / 2;
  const base = e.loadType === "time" ? n : n * e.repTimeSec;
  return e.unilateral ? base * 2 + 5 : base;
}

export interface TimedItem {
  exercise: Exercise;
  repRange: [number, number];
  reps?: number;
}

export function supersetSeconds(items: TimedItem[], rounds: number, transitionSec: number, restSec: number): number {
  const work = items.reduce((sum, it) => sum + setSeconds(it.exercise, it.repRange, it.reps), 0);
  const perRound = work + transitionSec * (items.length - 1) + restSec;
  return perRound * rounds;
}

export function warmupMinutes(budget: number): number {
  return budget >= 15 ? 2 : 1;
}

export function finisherMinutes(budget: number): number {
  return budget >= 18 ? 2 : 0;
}

/** Longer budgets earn longer rests; 20-minute sessions stay dense. */
export function restSecondsForBudget(budget: number): number {
  if (budget >= 35) return 90;
  if (budget >= 25) return 75;
  if (budget >= 15) return 60;
  return 45;
}

export const TRANSITION_SEC = 20;

/** Seconds a planned core finisher takes, with 30 s between sets. */
export function finisherSeconds(e: Exercise, repRange: [number, number], sets: number, reps?: number): number {
  return sets * setSeconds(e, repRange, reps) + Math.max(0, sets - 1) * 30;
}

/** Sets of a core finisher that fit its reserved time (at least one, at most three). */
export function finisherSets(e: Exercise, repRange: [number, number], budgetMinutes: number, reps?: number): number {
  const reserved = finisherMinutes(budgetMinutes) * 60;
  return Math.max(1, Math.min(3, Math.floor((reserved + 30) / (setSeconds(e, repRange, reps) + 30))));
}
