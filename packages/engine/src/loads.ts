import { STARTING_LOAD_RATIO } from "@repcurve/exercises";
import { availableDumbbellLoadsKg, loadForReps, roundDownToOwned } from "@repcurve/shared";
import type { Equipment, Exercise, Profile, Rir, TrainingLevel } from "@repcurve/shared";
import { LEVEL_LOAD_MULTIPLIER } from "./level.js";

export function isLoaded(e: Exercise): boolean {
  return e.loadType === "dumbbell_pair" || e.loadType === "single_dumbbell";
}

/** Reps the starting load is aimed at: a third of the way into the range. */
export function startingTargetReps(repRange: [number, number]): number {
  return Math.round((repRange[0] * 2 + repRange[1]) / 3);
}

/**
 * Starting load for an exercise. If an e1RM is known, derive the load for the
 * lower part of the rep range at the target RIR; otherwise use a
 * conservative bodyweight ratio. Always rounded down to an owned dumbbell.
 */
export function startingLoadKg(
  e: Exercise,
  profile: Profile,
  equipment: Equipment,
  level: TrainingLevel,
  repRange: [number, number],
  targetRir: Rir,
  e1rmKg?: number,
): number | null {
  if (!isLoaded(e)) return null;
  const owned = availableDumbbellLoadsKg(equipment.dumbbells);
  if (owned.length === 0) return null;
  let target: number;
  if (e1rmKg && e1rmKg > 0) {
    target = loadForReps(e1rmKg, startingTargetReps(repRange), targetRir);
  } else {
    const ratio = STARTING_LOAD_RATIO[e.id]?.[profile.sex] ?? 0.1;
    target = ratio * profile.bodyweightKg * LEVEL_LOAD_MULTIPLIER[level];
  }
  return roundDownToOwned(target, owned);
}

export function repRangeFor(e: Exercise, level: TrainingLevel): [number, number] {
  if (e.loadType === "time") return [30, 60];
  if (e.pattern === "core") return [8, 15];
  if (e.pattern === "vertical_pull") return e.ladderLevel === 1 ? [3, 6] : [3, 10];
  if (e.pattern === "isolation") return [10, 20];
  // One-sided sets take twice as long, so they stay in a lower range per side.
  if (e.unilateral && e.loadType !== "band") return e.loadType === "bodyweight" ? [6, 15] : [6, 12];
  if (e.loadType === "bodyweight") return [8, 20];
  if (e.loadType === "band") return [10, 20];
  return level === "novice" ? [8, 15] : [6, 12];
}
