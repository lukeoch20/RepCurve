import type { Rir } from "./types.js";

export const KG_PER_LB = 0.45359237;

export const lbToKg = (lb: number): number => lb * KG_PER_LB;
export const kgToLb = (kg: number): number => kg / KG_PER_LB;

/** Epley estimate of 1RM. Reps are the reps actually completed. */
export function epley1RM(loadKg: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return loadKg;
  return loadKg * (1 + reps / 30);
}

/**
 * Estimated 1RM that accounts for reps left in the tank.
 * A set of 8 at RIR 2 is treated as a set of 10 to failure, capped so that
 * very easy sets don't inflate the estimate.
 */
export function e1RM(loadKg: number, reps: number, rir: Rir): number {
  const effectiveReps = Math.min(reps + rir, 30);
  return epley1RM(loadKg, effectiveReps);
}

/** Inverse Epley: fraction of 1RM that can be lifted for `reps` to failure. */
export function pctOf1RMForReps(reps: number): number {
  return 1 / (1 + reps / 30);
}

/** Load that should allow `reps` with `rir` left, given an e1RM. */
export function loadForReps(e1rmKg: number, reps: number, rir: Rir): number {
  return e1rmKg * pctOf1RMForReps(reps + rir);
}

/** Reps achievable at a load, to failure, given an e1RM. */
export function repsAtLoad(e1rmKg: number, loadKg: number): number {
  if (loadKg <= 0) return 30;
  if (loadKg >= e1rmKg) return loadKg === e1rmKg ? 1 : 0;
  return Math.floor((e1rmKg / loadKg - 1) * 30 + 1e-9);
}

export const round1 = (n: number): number => Math.round(n * 10) / 10;
