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
  /**
   * Sets of this exercise, when it does fewer than the superset's rounds (it sits out the last
   * round). Defaults to every round.
   */
  sets?: number;
}

/** A light warm-up set before a heavy barbell lift that comes after the session's first superset. */
export const RAMP_SET_SEC = 60;

/** One-time setup for a set of exercises: adjusting machines, loading bars, anchoring bands. */
export function setupSeconds(exercises: Exercise[]): number {
  return exercises.reduce((sum, e) => sum + (e.setupSec ?? 0), 0);
}

/**
 * Seconds for `rounds` rounds of a superset (setup not included: it happens once). An exercise with
 * fewer sets than rounds sits out the last rounds; a round still ends with the rest.
 */
export function supersetSeconds(items: TimedItem[], rounds: number, transitionSec: number, restSec: number): number {
  let total = 0;
  for (let r = 0; r < rounds; r++) {
    const active = items.filter((it) => (it.sets ?? rounds) > r);
    if (active.length === 0) continue;
    const work = active.reduce((sum, it) => sum + setSeconds(it.exercise, it.repRange, it.reps), 0);
    total += work + transitionSec * (active.length - 1) + restSec;
  }
  return total;
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

/** Seconds a planned core finisher takes, with 30 s between sets and any setup. */
export function finisherSeconds(e: Exercise, repRange: [number, number], sets: number, reps?: number): number {
  return (e.setupSec ?? 0) + sets * setSeconds(e, repRange, reps) + Math.max(0, sets - 1) * 30;
}

/** Sets of a core finisher that fit its reserved time (at least one, at most three). */
export function finisherSets(e: Exercise, repRange: [number, number], budgetMinutes: number, reps?: number): number {
  const reserved = finisherMinutes(budgetMinutes) * 60;
  return Math.max(1, Math.min(3, Math.floor((reserved - (e.setupSec ?? 0) + 30) / (setSeconds(e, repRange, reps) + 30))));
}
