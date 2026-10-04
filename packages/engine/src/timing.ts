import type { Exercise } from "@repcurve/shared";

/** Seconds for one set at the midpoint of the rep range, both sides for unilateral work. */
export function setSeconds(e: Exercise, repRange: [number, number]): number {
  const mid = (repRange[0] + repRange[1]) / 2;
  const base = e.loadType === "time" ? mid : mid * e.repTimeSec;
  return e.unilateral ? base * 2 + 5 : base;
}

export function supersetSeconds(
  items: { exercise: Exercise; repRange: [number, number] }[],
  rounds: number,
  transitionSec: number,
  restSec: number,
): number {
  const work = items.reduce((sum, it) => sum + setSeconds(it.exercise, it.repRange), 0);
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
