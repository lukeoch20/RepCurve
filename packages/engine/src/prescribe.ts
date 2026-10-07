import { formatLoad } from "@repcurve/shared";
import type { Exercise, LoadType, Rir, Units } from "@repcurve/shared";
import type { Prescription } from "./types.js";

export const TARGET_RIR: Rir = 2;
export const MAX_REPS = 30;
/** One-sided sets stop growing earlier: 20 reps a side already takes two minutes. */
export const MAX_REPS_UNILATERAL = 12;
export const MAX_HOLD_SEC = 120;

export const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

/** A sensible first target inside a rep range: two above the bottom, or the bottom for holds. */
export function defaultTargetReps(repRange: [number, number], loadType: LoadType): number {
  if (loadType === "time") return repRange[0];
  return clamp(repRange[0] + 2, repRange[0], repRange[1]);
}

export interface PrescriptionArgs {
  exercise: Exercise;
  slot: string;
  sets: number;
  repRange: [number, number];
  targetReps: number;
  loadKg: number | null;
  targetRir?: Rir;
  benchmarkSet: boolean;
  units: Units;
}

export function buildPrescription(a: PrescriptionArgs): Prescription {
  const p: Prescription = {
    slot: a.slot,
    exerciseId: a.exercise.id,
    name: a.exercise.name,
    pattern: a.exercise.pattern,
    loadType: a.exercise.loadType,
    unilateral: a.exercise.unilateral,
    sets: a.sets,
    repRange: a.repRange,
    targetReps: a.targetReps,
    loadKg: a.loadKg,
    loadDisplay: formatLoad(a.loadKg, a.exercise.loadType, a.units),
    targetRir: a.targetRir ?? TARGET_RIR,
    benchmarkSet: a.benchmarkSet,
  };
  if (a.exercise.cue) p.cue = a.exercise.cue;
  return p;
}

/** The most reps (or seconds) a set of this exercise is allowed to grow to. */
export function maxRepsFor(e: Exercise): number {
  if (e.loadType === "time") return MAX_HOLD_SEC;
  return e.unilateral ? MAX_REPS_UNILATERAL : MAX_REPS;
}
