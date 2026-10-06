/** Regression tests for the independent review's engine findings (RC-xx). */
import { getExercise } from "@repcurve/exercises";
import { lbToKg } from "@repcurve/shared";
import type { Profile, Rir, SetLog } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { makeContext } from "./context.js";
import { generateProgram, missingPatterns, planSessionWith } from "./generate.js";
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

describe("RC-01: fitting keeps volume while the lifter progresses", () => {
  it("times sets from the target reps and tolerates a small overrun instead of dropping a pair", () => {
    const ctx = referenceContext({ profile: { daysPerWeek: 5, goal: "fitness" }, equipment: { ...referenceEquipment, dumbbells: { kind: "fixed", weights: [8, 12, 20], unit: "lb", pairs: true } } });
    const plan = planSessionWith(ctx, 5);
    const pairs = plan.supersets.length;
    // A strong lifter on the hardest one-sided variants of every movement.
    let state = initialTrainingState();
    for (const [from, to] of [["goblet_squat", "db_reverse_lunge"], ["db_rdl", "db_single_leg_rdl"], ["db_bent_over_row", "db_renegade_row"]] as const) {
      state = preferExercise(state, from, to);
    }
    const applied = applyState(plan, state, ctx);
    expect(applied.supersets.length).toBe(pairs);
    expect(applied.estimatedMinutes).toBeLessThanOrEqual(applied.budgetMinutes * 1.05);
  });

  it("puts rounds and the finisher back when time frees up", () => {
    const ctx = referenceContext();
    const plan = planSessionWith(ctx, 4);
    const applied = applyState(plan, initialTrainingState(), ctx);
    const planned = plan.supersets.reduce((n, ss) => n + ss.rounds, 0);
    const got = applied.supersets.reduce((n, ss) => n + ss.rounds, 0);
    expect(got).toBeGreaterThanOrEqual(planned);
    expect(applied.finisher).not.toBeNull();
  });
});

describe("RC-23: core finisher", () => {
  it("plans two sets where they fit in the reserved time", () => {
    const sessions = [0, 1, 2, 3].map((i) => planSessionWith(referenceContext(), i)).filter((s) => s.finisher);
    expect(sessions.length).toBeGreaterThan(0);
    for (const s of sessions) {
      if (["dead_bug", "plank", "hollow_hold", "hanging_knee_raise"].includes(s.finisher!.exerciseId)) expect(s.finisher!.sets, s.id).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("RC-25: pairs and coverage", () => {
  it("pairs a lone exercise with another movement instead of a one-exercise superset", () => {
    // Bodyweight only with a wrist injury: no pushing exercise exists at all.
    const ctx = makeContext(
      { ...referenceProfile, injuries: ["wrist"], daysPerWeek: 2, minutesPerSession: 15 },
      { ...referenceEquipment, dumbbells: { kind: "none" }, abRoller: false, treadmill: false },
    );
    for (let i = 0; i < 2; i++) {
      const s = planSessionWith(ctx, i);
      expect(s.supersets[0]!.items.length, s.id).toBe(2);
      expect(s.supersets[0]!.items.some((p) => p.slot.endsWith(".alt")), s.id).toBe(true);
    }
    const program = generateProgram({ profile: ctx.profile, equipment: ctx.equipment });
    expect(program.explanation.join(" ")).toMatch(/no push-up or press/);
  });

  it("never pairs two exercises that share a prime mover", () => {
    const ctx = referenceContext({ equipment: { ...referenceEquipment, dumbbells: { kind: "fixed", weights: [10, 15, 20], unit: "lb", pairs: false } } });
    for (let i = 0; i < 12; i++) {
      const s = planSessionWith(ctx, i);
      for (const ss of s.supersets) {
        const [a, b] = ss.items.map((p) => getExercise(p.exerciseId));
        if (a && b) expect(a.primary.some((m) => b.primary.includes(m)), `${s.id} ${a.id}+${b.id}`).toBe(false);
      }
    }
  });

  it("says when the week misses a movement pattern", () => {
    const program = generateProgram({ profile: { ...referenceProfile, daysPerWeek: 2, minutesPerSession: 10 }, equipment: referenceEquipment });
    const missing = missingPatterns(program.sessions.filter((s) => s.week === 2));
    if (missing.length > 0) expect(program.explanation.join(" ")).toMatch(/Your week has no/);
  });
});

describe("RC-26: explanation text", () => {
  it("explains the benchmark week to regular lifters too", () => {
    const program = generateProgram({ profile: { ...referenceProfile, trainingHistory: "regular" }, equipment: referenceEquipment });
    expect(program.explanation.join(" ")).toMatch(/benchmark week/);
  });

  it("describes a large volume gap with the numbers", () => {
    const program = generateProgram({ profile: { ...referenceProfile, daysPerWeek: 2, minutesPerSession: 15 }, equipment: { ...referenceEquipment, dumbbells: { kind: "none" } } });
    expect(program.explanation.join(" ")).toMatch(/well under \(.*\d/);
  });
});

describe("RC-31: switch time reaches the program", () => {
  it("passes transitionSec through generateProgram", () => {
    const quick = generateProgram({ profile: referenceProfile, equipment: referenceEquipment }, { transitionSec: 10 });
    const slow = generateProgram({ profile: referenceProfile, equipment: referenceEquipment }, { transitionSec: 45 });
    expect(slow.sessions[4]!.supersets[0]!.transitionSec).toBe(45);
    expect(quick.sessions[4]!.supersets[0]!.transitionSec).toBe(10);
  });
});

describe("RC-32: a strength session always has exercises", () => {
  it("places one pair even when long rests leave no room, and says why", () => {
    const ctx = referenceContext({ profile: { minutesPerSession: 10 } });
    const s = planSessionWith(ctx, 4, { restSec: 180, transitionSec: 45 });
    expect(s.supersets.length).toBeGreaterThanOrEqual(1);
    expect(s.supersets[0]!.items.length).toBe(2);
    expect(s.notes?.join(" ")).toMatch(/Shorter rests/);
  });
});
