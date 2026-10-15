import { e1RM } from "@repcurve/shared";
import type { SetLog } from "@repcurve/shared";
import type { EngineContext } from "./context.js";
import { recordSession, type RecordResult, type TrainingState } from "./state.js";
import type { SessionPlan } from "./types.js";

/**
 * The sets progression judges. A set added beyond the plan counts for volume and records, but it
 * doesn't move the weight up, count as a tough session or add to the strain behind a deload. One
 * that hurt still counts, and an exercise with only added sets logged is judged on those.
 */
export function judgedSets(logs: SetLog[]): SetLog[] {
  const planned = new Set(logs.filter((l) => !l.extra).map((l) => l.exerciseId));
  return logs.filter((l) => !l.extra || l.painFlag || !planned.has(l.exerciseId));
}

function bestE1rm(sets: SetLog[]): number | null {
  let best: number | null = null;
  for (const s of sets) {
    if (s.loadKg === null || s.reps <= 0) continue;
    const v = e1RM(s.loadKg, s.reps, s.rir);
    if (best === null || v > best) best = v;
  }
  return best;
}

/**
 * recordSession for a session that may have added sets: progression judges the planned sets
 * only, and the added ones still count toward the strength estimate and the best ever.
 */
export function recordSessionWithExtras(state: TrainingState, session: SessionPlan, logs: SetLog[], ctx: EngineContext): RecordResult {
  const judged = judgedSets(logs);
  const result = recordSession(state, session, judged, ctx);
  if (judged.length === logs.length) return result;
  const exercises = { ...result.state.exercises };
  for (const id of new Set(logs.filter((l) => l.extra).map((l) => l.exerciseId))) {
    const p = exercises[id];
    const e1 = bestE1rm(logs.filter((l) => l.exerciseId === id));
    if (!p || e1 === null) continue;
    exercises[id] = { ...p, e1rmKg: Math.max(p.e1rmKg ?? 0, e1), bestE1rmKg: Math.max(p.bestE1rmKg ?? 0, e1) };
  }
  return { ...result, state: { ...result.state, exercises } };
}
