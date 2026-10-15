import type { Muscle, Rir } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { planSessionWith } from "./generate.js";
import { applySoreness, primeMovers, recordSoreSession, soreQuestion, sorenessSummary, SORE_MIN_HOURS, SORE_WINDOW_HOURS, type Soreness } from "./soreness.js";
import { applyState, initialTrainingState, prescriptionsOf, recordSession, type TrainingState } from "./state.js";
import { logSession, onTarget, referenceContext } from "./testkit.js";
import type { Prescription, SessionPlan } from "./types.js";
import { MUSCLES } from "./volume.js";

const ctx = referenceContext();
const HOUR = 3_600_000;
const T0 = Date.UTC(2026, 9, 5, 7);

const very = (...groups: Muscle[]): Soreness[] => groups.map((group) => ({ group, level: "very" }));
const works = (p: Prescription, groups: Muscle[]) => primeMovers(p.exerciseId).some((m) => groups.includes(m));

/** Benchmark, then train a few sessions so every exercise has a calibrated working weight. */
function trained(): TrainingState {
  let state = initialTrainingState();
  for (let i = 0; i < 4; i++) {
    const plan = applyState(planSessionWith(ctx, i), state, ctx);
    if (plan.kind !== "strength") continue;
    state = recordSession(state, plan, logSession(plan, (p, j) => (p.benchmarkSet && j === 0 ? { reps: 12, rir: 2 } : onTarget(p))), ctx).state;
  }
  return state;
}

describe("the still-sore question", () => {
  const plan = planSessionWith(ctx, 1);
  const legs = { finishedAt: T0, exerciseIds: ["goblet_squat"] };

  it("asks about muscles today's plan shares with a session in the last three days", () => {
    const q = soreQuestion(plan, [legs, { finishedAt: T0 - HOUR, exerciseIds: ["one_arm_db_row"] }], T0 + 30 * HOUR);
    expect(q).toEqual({ groups: ["quads", "glutes", "back"], since: T0 });
  });

  it("doesn't ask after three days, for cardio, or when nothing is shared", () => {
    expect(soreQuestion(plan, [legs], T0 + (SORE_WINDOW_HOURS + 1) * HOUR)).toBeNull();
    expect(soreQuestion(planSessionWith(ctx, 2), [legs], T0 + 8 * HOUR)).toBeNull();
    expect(soreQuestion(plan, [{ finishedAt: T0, exerciseIds: ["standing_calf_raise"] }], T0 + 8 * HOUR)).toBeNull();
    expect(soreQuestion(plan, [], T0)).toBeNull();
    // Core alone (the finisher) doesn't ask; with another muscle it's included.
    const core = prescriptionsOf(plan).find((p) => primeMovers(p.exerciseId).includes("core"))!.exerciseId;
    expect(soreQuestion(plan, [{ finishedAt: T0, exerciseIds: [core] }], T0 + 8 * HOUR)).toBeNull();
    expect(soreQuestion(plan, [{ finishedAt: T0, exerciseIds: [core, "goblet_squat"] }], T0 + 8 * HOUR)!.groups).toEqual(["quads", "glutes", "core"]);
  });

  it("waits until soreness could have come on: not in the hours straight after a session", () => {
    const legsNow = { finishedAt: T0, exerciseIds: ["goblet_squat"] };
    expect(soreQuestion(plan, [legsNow], T0 + 2 * 60_000)).toBeNull();
    expect(soreQuestion(plan, [legsNow], T0 + (SORE_MIN_HOURS - 1) * HOUR)).toBeNull();
    expect(soreQuestion(plan, [legsNow], T0 + SORE_MIN_HOURS * HOUR)).not.toBeNull();
  });
});

describe("very sore", () => {
  /** Plans from several splits and weeks, some with uneven supersets. */
  const plans: SessionPlan[] = [];
  const profiles = [
    {},
    { daysPerWeek: 3, split: "push_pull" as const },
    { daysPerWeek: 5, split: "ppl" as const, minutesPerSession: 40 },
    { daysPerWeek: 2, minutesPerSession: 15 },
    { trainingHistory: "regular" as const, split: "full_body" as const, daysPerWeek: 3, minutesPerSession: 45 },
    { trainingHistory: "regular" as const, split: "upper_lower" as const, daysPerWeek: 4, minutesPerSession: 30 },
  ];
  for (const profile of profiles) {
    const c = referenceContext({ profile });
    for (let i = 0; i < 14; i++) {
      const plan = planSessionWith(c, i);
      if (plan.kind === "strength") plans.push(plan);
    }
  }
  // And one where the first exercise of each pair already sits out the last round.
  const base = planSessionWith(ctx, 4);
  plans.push({ ...base, supersets: base.supersets.map((ss) => ({ ...ss, items: ss.items.map((p, i) => (i === 0 ? { ...p, sets: ss.rounds - 1 } : p)) })) });

  it("takes at most one set off exercises for the sore muscles, keeping every exercise at its rounds or one fewer", () => {
    // The sample includes supersets where an exercise already sits out the last round.
    expect(plans.some((p) => p.supersets.some((ss) => ss.items.some((x) => x.sets === ss.rounds - 1)))).toBe(true);
    let reduced = 0;
    const groupSets: Muscle[][] = [...MUSCLES.map((m) => [m]), ["quads", "glutes"], ["chest", "shoulders", "triceps"], [...MUSCLES]];
    for (const plan of plans) {
      for (const groups of groupSets) {
        const after = applySoreness(plan, very(...groups));
        const label = `${plan.id} ${groups.join("+")}`;
        expect(after.supersets.length, label).toBe(plan.supersets.length);
        after.supersets.forEach((ss, i) => {
          const before = plan.supersets[i]!;
          expect(ss.rounds, label).toBe(Math.max(...ss.items.map((p) => p.sets)));
          ss.items.forEach((p, j) => {
            const was = before.items[j]!;
            expect(p.exerciseId, label).toBe(was.exerciseId);
            expect(p.sets, label).toBeGreaterThanOrEqual(1);
            expect([ss.rounds, ss.rounds - 1], label).toContain(p.sets);
            expect(was.sets - p.sets, label).toBeGreaterThanOrEqual(0);
            expect(was.sets - p.sets, label).toBeLessThanOrEqual(1);
            if (works(p, groups)) {
              expect(p.sore?.groups.length, label).toBeGreaterThan(0);
              expect(p.sore?.setOff, label).toBe(p.sets < was.sets);
              if (p.sets < was.sets) reduced++;
            } else {
              expect(p.sets, label).toBe(was.sets);
              expect(p.sore, label).toBeUndefined();
              expect(p.loadKg, label).toBe(was.loadKg);
            }
          });
        });
        if (plan.finisher) {
          const f = after.finisher!;
          expect(f.sets).toBeGreaterThanOrEqual(Math.max(1, plan.finisher.sets - 1));
          if (!works(f, groups)) expect(f.sets).toBe(plan.finisher.sets);
        }
        expect(after.estimatedMinutes, label).toBeLessThanOrEqual(plan.estimatedMinutes + 1e-9);
      }
    }
    expect(reduced).toBeGreaterThan(0);
  });

  it("drops a whole round only when every exercise in the superset sits it out", () => {
    const plan = planSessionWith(ctx, 4);
    const a = plan.supersets[0]!;
    const groups = [...new Set(a.items.flatMap((p) => primeMovers(p.exerciseId)))];
    const after = applySoreness(plan, very(...groups));
    expect(after.supersets[0]!.rounds).toBe(a.rounds - 1);
    expect(after.supersets[0]!.items.every((p) => p.sets === a.rounds - 1)).toBe(true);
  });

  it("changes nothing for 'a bit' or 'not sore', and only marks a lighter session", () => {
    const plan = planSessionWith(ctx, 4);
    expect(applySoreness(plan, [{ group: "quads", level: "bit" }, { group: "chest", level: "none" }])).toBe(plan);
    expect(applySoreness(plan, undefined)).toBe(plan);
    const deload = { ...plan, deload: true };
    const after = applySoreness(deload, very("quads"));
    expect(prescriptionsOf(after).map((p) => p.sets)).toEqual(prescriptionsOf(deload).map((p) => p.sets));
    expect(prescriptionsOf(after).filter((p) => p.sore).every((p) => p.sore!.setOff === false)).toBe(true);
  });

  it("says what changed", () => {
    const after = applySoreness(planSessionWith(ctx, 4), very("quads"));
    expect(sorenessSummary(after)).toBe("Quads still very sore: one set fewer of Goblet squat, at the same weight today.");
    expect(sorenessSummary(planSessionWith(ctx, 4))).toBeNull();
  });
});

describe("recording a very sore session", () => {
  const state = trained();
  const plan = applySoreness(applyState(planSessionWith(ctx, 4), state, ctx), very("quads"));
  const easy = (p: Prescription) => ({ reps: p.repRange[1], rir: 4 as Rir });
  const stalled = (p: Prescription) => ({ reps: p.repRange[0] - 2, rir: 0 as Rir });

  it("keeps the sore exercises' weight and reps whether the sets went well or badly", () => {
    for (const perform of [easy, stalled]) {
      const logs = logSession(plan, perform);
      const r = recordSoreSession(state, plan, logs, ctx);
      const sore = prescriptionsOf(plan).filter((p) => p.sore);
      expect(sore.length).toBeGreaterThan(0);
      for (const p of sore) {
        const before = state.exercises[p.exerciseId]!;
        const after = r.state.exercises[p.exerciseId]!;
        expect([after.loadKg, after.targetReps, after.repRange, after.stalls]).toEqual([before.loadKg, before.targetReps, before.repRange, before.stalls]);
        expect(after.timesPerformed).toBe(before.timesPerformed + 1);
        expect(r.changes.find((c) => c.exerciseId === p.exerciseId)).toMatchObject({ action: "hold" });
      }
      // Everything else is recorded exactly as without the check-in.
      const usual = recordSession(state, plan, logs, ctx);
      for (const p of prescriptionsOf(plan).filter((x) => !x.sore)) {
        expect(r.state.exercises[p.exerciseId]).toEqual(usual.state.exercises[p.exerciseId]);
      }
      expect(r.changes.map((c) => c.slot)).toEqual(usual.changes.map((c) => c.slot));
      expect(r.state.strengthSessionsLogged).toBe(state.strengthSessionsLogged + 1);
    }
    // Without the check-in, the easy session would have moved the sore exercise on.
    const usual = recordSession(state, plan, logSession(plan, easy), ctx);
    const squat = prescriptionsOf(plan).find((p) => p.sore)!;
    expect(usual.changes.find((c) => c.exerciseId === squat.exerciseId)!.action).not.toBe("hold");
  });

  it("still lets pain through the pain rules", () => {
    const squat = prescriptionsOf(plan).find((p) => p.sore)!;
    const logs = logSession(plan, (p) => ({ ...onTarget(p), ...(p.exerciseId === squat.exerciseId ? { painFlag: true } : {}) }));
    const r = recordSoreSession(state, plan, logs, ctx);
    expect(r.changes.find((c) => c.exerciseId === squat.exerciseId)!.action).toBe("pain");
  });

  it("records a session without sore exercises exactly as before", () => {
    const plain = applyState(planSessionWith(ctx, 4), state, ctx);
    const logs = logSession(plain, onTarget);
    expect(recordSoreSession(state, plain, logs, ctx)).toEqual(recordSession(state, plain, logs, ctx));
  });
});
