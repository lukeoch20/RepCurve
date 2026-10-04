import { lbToKg } from "@repcurve/shared";
import type { Rir } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { planSessionWith } from "./generate.js";
import {
  alternativesFor,
  applyState,
  initialTrainingState,
  preferExercise,
  prescriptionsOf,
  recordSession,
  resolveExercise,
  swapPrescription,
  type TrainingState,
} from "./state.js";
import { logSession, onTarget, referenceContext } from "./testkit.js";
import type { Prescription, SessionPlan } from "./types.js";

const ctx = referenceContext();
const lb = lbToKg;

const find = (s: SessionPlan, slot: string): Prescription => {
  const p = prescriptionsOf(s).find((x) => x.slot === slot);
  if (!p) throw new Error(`no ${slot} in ${s.id}: ${prescriptionsOf(s).map((x) => x.slot).join(",")}`);
  return p;
};

/** Plan, personalise, log with `perform`, record. Returns the applied session and new state. */
function train(state: TrainingState, index: number, perform = onTarget as (p: Prescription, i: number) => { reps: number; rir: Rir }) {
  const applied = applyState(planSessionWith(ctx, index), state, ctx);
  const result = recordSession(state, applied, logSession(applied, perform), ctx);
  return { applied, ...result };
}

describe("applyState", () => {
  it("leaves a fresh plan unchanged", () => {
    const plan = planSessionWith(ctx, 0);
    const applied = applyState(plan, initialTrainingState(), ctx);
    expect(prescriptionsOf(applied).map((p) => [p.exerciseId, p.loadKg, p.targetReps, p.benchmarkSet])).toEqual(
      prescriptionsOf(plan).map((p) => [p.exerciseId, p.loadKg, p.targetReps, p.benchmarkSet]),
    );
    expect(applied.deload).toBe(false);
    expect(applied.comeback).toBe(false);
  });

  it("passes cardio sessions through untouched", () => {
    const cardio = planSessionWith(ctx, 2);
    expect(cardio.kind).toBe("cardio");
    expect(applyState(cardio, initialTrainingState(), ctx)).toBe(cardio);
  });
});

describe("recordSession", () => {
  it("carries calibrated weights into later sessions and benchmarks each exercise once", () => {
    const s0 = train(initialTrainingState(), 0, (p, i) =>
      p.benchmarkSet && i === 0 ? { reps: 12, rir: 2 } : { reps: p.targetReps, rir: 2 },
    );
    const goblet = s0.changes.find((c) => c.exerciseId === "goblet_squat")!;
    expect(goblet.action).toBe("calibrated");
    expect(s0.state.exercises["goblet_squat"]!.calibrated).toBe(true);

    // Session 4 (Full body C, week 1) also has goblet squats: no second benchmark.
    const c = applyState(planSessionWith(ctx, 3), s0.state, ctx);
    const p = find(c, "C.squat");
    expect(p.exerciseId).toBe("goblet_squat");
    expect(p.benchmarkSet).toBe(false);
    expect(p.targetReps).toBe(s0.state.exercises["goblet_squat"]!.targetReps);
  });

  it("moves every slot that used an exercise when it ladders up, without duplicating", () => {
    let state = initialTrainingState();
    state.exercises["goblet_squat"] = {
      exerciseId: "goblet_squat", loadKg: lb(30), repRange: [8, 15], targetRir: 2, targetReps: 15,
      stalls: 0, e1rmKg: null, bestE1rmKg: null, calibrated: true, timesPerformed: 4,
    };
    state = train(state, 4, (p) => ({ reps: p.exerciseId === "goblet_squat" ? 15 : p.targetReps, rir: 2 })).state;
    expect(resolveExercise(state, "goblet_squat")).toBe("db_front_squat");

    const a = applyState(planSessionWith(ctx, 8), state, ctx); // Full body A, week 3
    expect(find(a, "A.squat").exerciseId).toBe("db_front_squat");
    const b = applyState(planSessionWith(ctx, 9), state, ctx); // Full body B already programs front squats
    const ids = prescriptionsOf(b).map((p) => p.exerciseId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("starts a reactive deload after three grinding sessions and ends it a week later", () => {
    let state = initialTrainingState();
    const grind = () => ({ reps: 6, rir: 0 as Rir });
    const strengthIdx = [4, 5, 7, 8, 9, 11, 12, 13, 15];
    let i = 0;
    let r = train(state, strengthIdx[i++]!, grind);
    expect(r.deloadStarted).toBe(false);
    r = train(r.state, strengthIdx[i++]!, grind);
    expect(r.deloadStarted).toBe(false);
    r = train(r.state, strengthIdx[i++]!, grind);
    expect(r.deloadStarted).toBe(true);
    state = r.state;
    expect(state.deloadRemaining).toBe(ctx.strengthPerWeek);

    const before = JSON.parse(JSON.stringify(state.exercises));
    const planned = planSessionWith(ctx, strengthIdx[i]!);
    const deload = applyState(planned, state, ctx);
    expect(deload.deload).toBe(true);
    expect(deload.supersets[0]!.rounds).toBe(planned.supersets[0]!.rounds - 1);
    const loaded = prescriptionsOf(deload).find((p) => p.loadKg !== null)!;
    expect(loaded.loadKg!).toBeLessThan(state.exercises[loaded.exerciseId]!.loadKg! + 1e-9);

    for (let k = 0; k < ctx.strengthPerWeek; k++) {
      r = train(r.state, strengthIdx[i++]!, onTarget);
      expect(r.changes.every((c) => c.action === "deload" || c.action === "skipped")).toBe(true);
    }
    expect(r.deloadFinished).toBe(true);
    expect(r.state.deloadRemaining).toBe(0);
    // Deloads don't move working weights.
    for (const [id, p] of Object.entries(before) as [string, { loadKg: number | null }][]) {
      expect(r.state.exercises[id]!.loadKg).toBe(p.loadKg);
    }
  });

  it("eases you back in after two weeks off, then progresses from what you lifted", () => {
    const first = train(initialTrainingState(), 4);
    const planned = planSessionWith(ctx, 5);
    const back = applyState(planned, first.state, ctx, { daysSinceLastStrength: 18 });
    expect(back.comeback).toBe(true);
    expect(back.supersets[0]!.rounds).toBe(planned.supersets[0]!.rounds - 1);
    const r = recordSession(first.state, back, logSession(back, onTarget), ctx);
    expect(r.changes.filter((c) => c.action !== "skipped").every((c) => c.action === "comeback")).toBe(true);
    const anyLoaded = prescriptionsOf(back).find((p) => p.loadKg !== null)!;
    expect(r.state.exercises[anyLoaded.exerciseId]!.loadKg).toBeCloseTo(anyLoaded.loadKg!);
  });

  it("ignores cardio sessions", () => {
    const state = initialTrainingState();
    const r = recordSession(state, planSessionWith(ctx, 2), [], ctx);
    expect(r.state).toBe(state);
    expect(r.changes).toEqual([]);
  });

  it("reports skipped exercises without changing them", () => {
    const plan = applyState(planSessionWith(ctx, 4), initialTrainingState(), ctx);
    const r = recordSession(initialTrainingState(), plan, [], ctx);
    expect(r.changes.every((c) => c.action === "skipped")).toBe(true);
    expect(Object.keys(r.state.exercises)).toHaveLength(0);
  });
});

describe("swaps", () => {
  it("offers alternatives for the same movement that fit the equipment", () => {
    const plan = planSessionWith(ctx, 4);
    const alts = alternativesFor(find(plan, "A.squat"), ctx).map((e) => e.id);
    expect(alts).toContain("bodyweight_squat");
    expect(alts).toContain("db_front_squat");
    expect(alts).not.toContain("goblet_squat");
    expect(alts).not.toContain("db_bulgarian_split_squat"); // needs a bench
  });

  it("swaps for one session keeping slot and sets", () => {
    const plan = planSessionWith(ctx, 4);
    const p = find(plan, "A.squat");
    const s = swapPrescription(p, "bodyweight_squat", initialTrainingState(), ctx);
    expect(s.slot).toBe(p.slot);
    expect(s.sets).toBe(p.sets);
    expect(s.loadKg).toBeNull();
  });

  it("keeps a permanent swap in every session and still fits the time budget", () => {
    const state = preferExercise(initialTrainingState(), "goblet_squat", "db_reverse_lunge");
    for (const idx of [4, 7]) {
      const s = applyState(planSessionWith(ctx, idx), state, ctx);
      expect(prescriptionsOf(s).map((p) => p.exerciseId)).toContain("db_reverse_lunge");
      expect(s.estimatedMinutes).toBeLessThanOrEqual(s.budgetMinutes);
    }
  });
});
