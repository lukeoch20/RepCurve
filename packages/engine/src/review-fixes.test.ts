/** Regression tests for the independent review's engine findings (RC-xx). */
import { getExercise } from "@repcurve/exercises";
import { lbToKg } from "@repcurve/shared";
import type { Profile, Rir, SetLog } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { makeContext } from "./context.js";
import { planSessionWith } from "./generate.js";
import { freshProgress, progressExercise } from "./progression.js";
import {
  applyState,
  initialTrainingState,
  preferExercise,
  prescriptionsOf,
  recordSession,
  swapPrescription,
  type TrainingState,
} from "./state.js";
import { adjustableEquipment, logSession, onTarget, referenceContext, referenceEquipment, referenceProfile, sets } from "./testkit.js";
import type { Prescription, SessionPlan } from "./types.js";

const lb = lbToKg;
const noBar = makeContext(
  { ...referenceProfile, daysPerWeek: 3, minutesPerSession: 30, trainingHistory: "a_little", goal: "strength_muscle" },
  { ...referenceEquipment, treadmill: false, dumbbells: { kind: "fixed", weights: [10, 15, 20, 25, 30, 35, 40], unit: "lb", pairs: true } },
);
const ids = (s: SessionPlan) => prescriptionsOf(s).map((p) => p.exerciseId);

describe("RC-02: one exercise per session, progressed once", () => {
  it("keeps exercises unique when a ladder move lands on an exercise already in the session", () => {
    const plan = planSessionWith(noBar, 3);
    expect(ids(plan)).toContain("one_arm_db_row");
    expect(ids(plan)).toContain("db_bent_over_row");
    const state = preferExercise(initialTrainingState(), "one_arm_db_row", "db_bent_over_row");
    const applied = applyState(plan, state, noBar);
    expect(new Set(ids(applied)).size).toBe(ids(applied).length);
    expect(ids(applied)).toContain("db_bent_over_row");
  });

  it("progresses an exercise once even if it appears in two slots", () => {
    const plan = applyState(planSessionWith(noBar, 3), initialTrainingState(), noBar);
    const row = prescriptionsOf(plan).find((p) => p.exerciseId === "db_bent_over_row")!;
    const dupe: Prescription = { ...row, slot: "A.row" };
    const doubled: SessionPlan = { ...plan, supersets: [...plan.supersets, { ...plan.supersets[0]!, items: [dupe] }] };
    const logs: SetLog[] = [0, 1, 2].map((i) => ({ exerciseId: row.exerciseId, slot: i < 2 ? row.slot : "A.row", setIndex: i % 2, loadKg: row.loadKg, reps: 7, rir: 1 as Rir }));
    const r = recordSession(initialTrainingState(), doubled, logs, noBar);
    const forRow = r.changes.filter((c) => c.exerciseId === row.exerciseId);
    expect(forRow).toHaveLength(1);
    expect(forRow[0]!.action).toBe("stall_noted");
    expect(r.state.exercises[row.exerciseId]!.loadKg).toBeCloseTo(row.loadKg!);
  });
});

describe("RC-03: a mid-session move to a heavier dumbbell resets the rep target", () => {
  it("bases next time on the sets at the new weight", () => {
    const ctx = referenceContext({ equipment: adjustableEquipment });
    const progress = { ...freshProgress(getExercise("goblet_squat"), ctx), loadKg: lb(20), repRange: [8, 15] as [number, number], targetReps: 15 };
    const logs: SetLog[] = [
      { exerciseId: "goblet_squat", setIndex: 0, loadKg: lb(20), reps: 15, rir: 4 },
      { exerciseId: "goblet_squat", setIndex: 1, loadKg: lb(22.5), reps: 11, rir: 2 },
      { exerciseId: "goblet_squat", setIndex: 2, loadKg: lb(22.5), reps: 10, rir: 1 },
    ];
    const r = progressExercise(progress, logs, ctx);
    expect(r.action).toBe("add_rep");
    expect(r.next.loadKg).toBeCloseTo(lb(22.5));
    expect(r.next.targetReps).toBe(11);
  });
});

describe("RC-06: pain counts in every session type", () => {
  it("swaps a painful exercise even in a deload", () => {
    const ctx = referenceContext();
    const state: TrainingState = { ...initialTrainingState(), deloadRemaining: 3, strengthSessionsLogged: 6 };
    const plan = applyState(planSessionWith(ctx, 8), state, ctx);
    expect(plan.deload).toBe(true);
    const logs = logSession(plan, (p, i) => ({ reps: p.targetReps, rir: 2, painFlag: p.exerciseId === "goblet_squat" && i === 0 }));
    const r = recordSession(state, plan, logs, ctx);
    const c = r.changes.find((x) => x.exerciseId === "goblet_squat")!;
    expect(c.action).toBe("pain");
    expect(c.nextExerciseId).not.toBe("goblet_squat");
  });
});

describe("RC-08: building up on the easiest option isn't a grind", () => {
  it("doesn't deload a beginner who can't yet reach the bottom of the range on the easiest exercises", () => {
    const profile: Profile = { ...referenceProfile, age: 58, bodyweightKg: 95, daysPerWeek: 3, minutesPerSession: 20 };
    const ctx = makeContext(profile, { ...referenceEquipment, dumbbells: { kind: "none" }, treadmill: false, abRoller: false });
    let state = initialTrainingState();
    let deloads = 0;
    for (let i = 3; i < 33; i++) {
      const plan = applyState(planSessionWith(ctx, i), state, ctx);
      if (plan.kind !== "strength") continue;
      if (plan.deload) deloads++;
      const r = recordSession(state, plan, logSession(plan, (p) => ({ reps: p.loadType === "time" ? p.targetReps : 5, rir: 1 })), ctx);
      state = r.state;
    }
    expect(deloads).toBeLessThanOrEqual(3);
  });
});

describe("RC-22: a week-1 swap keeps the benchmark", () => {
  it("carries the benchmark flag to an uncalibrated replacement", () => {
    const ctx = referenceContext();
    const p = prescriptionsOf(planSessionWith(ctx, 0)).find((x) => x.exerciseId === "goblet_squat")!;
    expect(p.benchmarkSet).toBe(true);
    expect(swapPrescription(p, "db_front_squat", initialTrainingState(), ctx).benchmarkSet).toBe(true);
  });
});

describe("RC-27: logs with no set at the working weight", () => {
  it("doesn't crash", () => {
    const ctx = referenceContext();
    const progress = { ...freshProgress(getExercise("goblet_squat"), ctx), loadKg: lb(20) };
    expect(() => progressExercise(progress, sets("goblet_squat", null, [10, 10], 2), ctx)).not.toThrow();
  });
});

describe("RC-33: substitutions never chain", () => {
  it("resolves the target before redirecting", () => {
    let state = preferExercise(initialTrainingState(), "db_front_squat", "db_reverse_lunge");
    state = preferExercise(state, "goblet_squat", "db_front_squat");
    for (const to of Object.values(state.substitutions)) expect(Object.keys(state.substitutions)).not.toContain(to);
    expect(state.substitutions["goblet_squat"]).toBe("db_reverse_lunge");
  });

  it("holds across a long simulation of every exercise moving", () => {
    const ctx = referenceContext();
    let state = initialTrainingState();
    for (let i = 0; i < 64; i++) {
      const plan = applyState(planSessionWith(ctx, i), state, ctx);
      if (plan.kind !== "strength") continue;
      state = recordSession(state, plan, logSession(plan, (p) => ({ reps: p.repRange[1], rir: 4 })), ctx).state;
      for (const to of Object.values(state.substitutions)) expect(Object.keys(state.substitutions)).not.toContain(to);
    }
  });
});

void onTarget;
