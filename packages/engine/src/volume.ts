import { getExercise } from "@repcurve/exercises";
import type { Muscle } from "@repcurve/shared";
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
  for (const ss of session.supersets) n += ss.rounds * ss.items.length;
  if (session.finisher) n += session.finisher.sets;
  return n;
}
