import { getExercise } from "@repcurve/exercises";
import type { Exercise, Muscle, TrainingLevel } from "@repcurve/shared";
import { deltHeadTarget } from "./level.js";
import type { SessionPlan } from "./types.js";

export const MUSCLES: Muscle[] = ["quads", "glutes", "hamstrings", "chest", "shoulders", "triceps", "biceps", "back", "core", "calves"];

export function emptyVolume(): Record<Muscle, number> {
  const v = {} as Record<Muscle, number>;
  for (const m of MUSCLES) v[m] = 0;
  return v;
}

/** Hard sets per muscle for a list of sessions (primary = 1, secondary = 0.5). */
export function weeklyVolume(sessions: SessionPlan[]): Record<Muscle, number> {
  const v = emptyVolume();
  const add = (exerciseId: string, sets: number) => {
    const e = getExercise(exerciseId);
    for (const m of e.primary) v[m] += sets;
    for (const m of e.secondary) v[m] += sets * 0.5;
  };
  for (const s of sessions) {
    for (const ss of s.supersets) for (const p of ss.items) add(p.exerciseId, p.sets);
    if (s.finisher) add(s.finisher.exerciseId, s.finisher.sets);
  }
  return v;
}

export function hardSets(session: SessionPlan): number {
  let n = 0;
  for (const ss of session.supersets) for (const p of ss.items) n += p.sets;
  if (session.finisher) n += session.finisher.sets;
  return n;
}

/**
 * Heads of the shoulder, inside the planner only (everywhere else shoulders are one muscle). The
 * front gets plenty from every press and the rear from every row (4 to 12 sets a week in the plans
 * we measured), but the side only gets real work from lateral raises (and some from overhead
 * presses), so the side is the head the planner tracks, with its own target and ceiling.
 */
export type DeltHead = "side_delts" | "rear_delts";
const ALL_HEADS: DeltHead[] = ["side_delts", "rear_delts"];
/** The heads with their own target and ceiling. */
export const DELT_HEADS: DeltHead[] = ["side_delts"];

const HEAD_TARGET: Record<DeltHead, string> = { side_delts: "lateral_deltoid", rear_delts: "posterior_deltoid" };

/** Hard sets one set of `e` gives each shoulder head. */
export function deltHeadSets(e: Exercise): Record<DeltHead, number> {
  const out = { side_delts: 0, rear_delts: 0 };
  for (const h of ALL_HEADS) {
    const t = HEAD_TARGET[h];
    out[h] = e.targets.prime.includes(t) ? 1 : e.targets.secondary.includes(t) ? 0.5 : 0;
  }
  // Overhead presses work the side of the shoulder too, though the catalogue tags them by the front.
  if (e.pattern === "vertical_push") out.side_delts = Math.max(out.side_delts, 0.5);
  return out;
}

/** Hard sets per shoulder head for a list of sessions, and the shoulder sets that were lateral raises. */
export function weeklyDeltHeads(sessions: SessionPlan[]): Record<DeltHead | "delt_raises", number> {
  const v = { side_delts: 0, rear_delts: 0, delt_raises: 0 };
  const add = (exerciseId: string, sets: number) => {
    const e = getExercise(exerciseId);
    const h = deltHeadSets(e);
    for (const k of ALL_HEADS) v[k] += h[k] * sets;
    if (isDeltRaise(e)) v.delt_raises += sets;
  };
  for (const s of sessions) {
    for (const ss of s.supersets) for (const p of ss.items) add(p.exerciseId, p.sets);
    if (s.finisher) add(s.finisher.exerciseId, s.finisher.sets);
  }
  return v;
}

/**
 * A raise for a tracked head (a lateral raise): light, low-fatigue isolation work that the weekly
 * ceiling counts against the head's own ceiling, not the shoulders'. Without this, pressing alone
 * fills the shoulders' ceiling and leaves no room for the head pressing misses.
 */
export function isDeltRaise(e: Exercise): boolean {
  const tracked = DELT_HEADS.map((h) => HEAD_TARGET[h]);
  return e.pattern === "isolation" && e.primary.length === 1 && e.primary[0] === "shoulders" &&
    e.targets.prime.length > 0 && e.targets.prime.every((t) => tracked.includes(t));
}

/**
 * Hard sets per muscle as the weekly ceiling counts them: past the novice stage (when the shoulder
 * head has its own ceiling), shoulders leave out lateral raises.
 */
export function ceilingVolume(sessions: SessionPlan[], level: TrainingLevel): Record<Muscle, number> {
  const v = weeklyVolume(sessions);
  if (deltHeadTarget(level) === null) return v;
  for (const s of sessions) {
    for (const p of [...s.supersets.flatMap((ss) => ss.items), ...(s.finisher ? [s.finisher] : [])]) {
      if (isDeltRaise(getExercise(p.exerciseId))) v.shoulders -= p.sets;
    }
  }
  return v;
}
