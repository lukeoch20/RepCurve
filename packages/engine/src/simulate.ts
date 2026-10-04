import { STARTING_LOAD_RATIO, getExercise } from "@repcurve/exercises";
import { repsAtLoad } from "@repcurve/shared";
import type { Exercise, Rir, SetLog } from "@repcurve/shared";
import type { EngineContext } from "./context.js";
import { planSessionWith } from "./generate.js";
import { isLoaded } from "./loads.js";
import { applyState, initialTrainingState, prescriptionsOf, recordSession, type ExerciseChange, type TrainingState } from "./state.js";
import type { Prescription, SessionPlan } from "./types.js";

export interface SimulatedSession {
  plan: SessionPlan;
  logs: SetLog[];
  changes: ExerciseChange[];
}

export interface SimulationResult {
  state: TrainingState;
  sessions: SimulatedSession[];
  changes: ExerciseChange[];
}

export interface VirtualLifter {
  /** Fractional strength gain the lifter approaches over months, e.g. 0.35. */
  ceiling: number;
  /** Weeks to get ~63% of the way to the ceiling. */
  timeConstantWeeks: number;
  /** True 1RM as a multiple of the starting-load ratio × bodyweight. */
  startMultiple: number;
}

export const DEFAULT_LIFTER: VirtualLifter = { ceiling: 0.35, timeConstantWeeks: 6, startMultiple: 1.6 };

/**
 * Run the engine against a virtual lifter whose true strength rises with
 * diminishing returns. Each set they do the target if they can with a rep to
 * spare, and lose about one rep of capacity per round to fatigue. A dev tool
 * for checking that progression behaves over months, not a model of anyone.
 */
export function simulateTraining(ctx: EngineContext, weeks: number, lifter: VirtualLifter = DEFAULT_LIFTER): SimulationResult {
  const bw = ctx.profile.bodyweightKg;
  const days = ctx.template.length;
  const strength = (i: number) => 1 + lifter.ceiling * (1 - Math.exp(-i / (days * lifter.timeConstantWeeks)));
  const capacity = (e: Exercise, p: Prescription, i: number, setIndex: number): number => {
    if (e.loadType === "time") return 45 + Math.floor(i / days) * 3;
    if (isLoaded(e) && p.loadKg !== null) {
      const true1rm = (STARTING_LOAD_RATIO[e.id]?.[ctx.profile.sex] ?? 0.1) * bw * lifter.startMultiple * strength(i);
      return repsAtLoad(true1rm, p.loadKg) - setIndex;
    }
    const frac = e.bodyweightFraction ?? 0.5;
    // Relative to bodyweight, legs are far stronger than arms; core work is in between.
    const relative = e.pattern === "squat" || e.pattern === "hinge" ? 1.6 : e.pattern === "core" ? 1.1 : 0.9;
    return Math.floor(((relative * strength(i)) / frac - 1) * 30) - setIndex;
  };

  let state = initialTrainingState();
  const sessions: SimulatedSession[] = [];
  const changes: ExerciseChange[] = [];
  for (let i = 0; i < weeks * days; i++) {
    const plan = applyState(planSessionWith(ctx, i), state, ctx);
    if (plan.kind !== "strength") {
      sessions.push({ plan, logs: [], changes: [] });
      continue;
    }
    const logs: SetLog[] = prescriptionsOf(plan).flatMap((p) => {
      const e = getExercise(p.exerciseId);
      return Array.from({ length: p.sets }, (_, s) => {
        const cap = Math.max(1, capacity(e, p, i, s));
        let reps: number;
        if (e.loadType === "time") reps = Math.min(p.targetReps, cap);
        else if (p.benchmarkSet && s === 0) reps = Math.max(1, Math.min(20, cap - 2));
        else reps = Math.max(1, Math.min(p.targetReps, cap - 1));
        const rir = Math.max(0, Math.min(4, cap - reps)) as Rir;
        return { exerciseId: p.exerciseId, slot: p.slot, setIndex: s, loadKg: p.loadKg, reps, rir };
      });
    });
    const r = recordSession(state, plan, logs, ctx);
    state = r.state;
    sessions.push({ plan, logs, changes: r.changes });
    changes.push(...r.changes);
  }
  return { state, sessions, changes };
}
