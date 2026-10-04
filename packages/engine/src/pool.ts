import { EXERCISES } from "@repcurve/exercises";
import { canLoad, meetsRequirements } from "@repcurve/shared";
import type { Equipment, Exercise, Injury, Pattern, TrainingLevel } from "@repcurve/shared";
import type { Pool } from "./types.js";

/** Exercises the user can actually do with what they own and without aggravating anything. */
export function buildPool(equipment: Equipment, injuries: Injury[]): Pool {
  const exercises = EXERCISES.filter(
    (e) =>
      meetsRequirements(e.requires, equipment) &&
      canLoad(e.loadType, equipment) &&
      !e.avoidWith.some((i) => injuries.includes(i)),
  );
  const byLadder = new Map<string, Exercise[]>();
  for (const e of exercises) {
    const list = byLadder.get(e.ladder) ?? [];
    list.push(e);
    byLadder.set(e.ladder, list);
  }
  for (const list of byLadder.values()) list.sort((a, b) => a.ladderLevel - b.ladderLevel);
  return { exercises, byLadder };
}

/** Preferred ladders per pattern, in order. Variant B flips the push preference for variety. */
export function ladderPreference(pattern: Pattern, variant: number): string[] {
  switch (pattern) {
    case "squat":
      return ["squat_db", "squat_bw"];
    case "hinge":
      return ["hinge_db", "hinge_bw"];
    case "horizontal_push":
      return variant % 2 === 0 ? ["hpush_bw", "hpush_db"] : ["hpush_db", "hpush_bw"];
    case "vertical_push":
      return ["vpush_db", "vpush_bw"];
    case "row":
      return ["row_db", "row_band", "row_bw"];
    case "vertical_pull":
      return ["vpull_bar", "row_db", "row_band", "row_bw"];
    case "core":
      return variant % 2 === 0 ? ["core_roller", "core_floor", "core_hang"] : ["core_floor", "core_roller", "core_hang"];
    case "isolation":
      return ["iso_biceps", "iso_shoulders", "iso_triceps", "iso_calves"];
    case "cardio":
      return [];
  }
}

export function baseLadderLevel(level: TrainingLevel): number {
  switch (level) {
    case "novice":
      return 1;
    case "intermediate":
      return 2;
    case "advanced":
      return 3;
  }
}

/**
 * Pick the exercise for a pattern: walk the preferred ladders, choose the
 * highest available level at or below the target level.
 */
export function pickExercise(
  pool: Pool,
  pattern: Pattern,
  level: TrainingLevel,
  variant: number,
  levelOffset: number,
  exclude: Set<string>,
  /** Extra rungs up bodyweight ladders for people with some training history. */
  bodyweightBoost = 0,
): Exercise | null {
  for (const ladder of ladderPreference(pattern, variant)) {
    const candidates = (pool.byLadder.get(ladder) ?? []).filter((e) => !exclude.has(e.id));
    if (candidates.length === 0) continue;
    const boost = candidates.every((e) => e.loadType === "bodyweight" || e.loadType === "time") ? bodyweightBoost : 0;
    const target = Math.max(1, baseLadderLevel(level) + levelOffset + boost);
    let best: Exercise | null = null;
    for (const c of candidates) if (c.ladderLevel <= target) best = c;
    return best ?? candidates[0]!;
  }
  // Last resort: any exercise of the pattern.
  return pool.exercises.find((e) => e.pattern === pattern && !exclude.has(e.id)) ?? null;
}
