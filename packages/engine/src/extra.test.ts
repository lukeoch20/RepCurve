import { getExercise } from "@repcurve/exercises";
import type { SetLog } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { judgedSets, recordSessionWithExtras } from "./extra.js";
import { recordSoreSession } from "./soreness.js";
import { planSessionWith } from "./generate.js";
import { applyState, initialTrainingState, prescriptionsOf, recordSession, type TrainingState } from "./state.js";
import { logSession, onTarget, referenceContext } from "./testkit.js";
import type { Prescription, SessionPlan } from "./types.js";

const ctx = referenceContext();

/** A calibrated state and the next session's plan, logged on target. */
function setup(): { state: TrainingState; plan: SessionPlan; logs: SetLog[]; p: Prescription } {
  const s0 = applyState(planSessionWith(ctx, 0), initialTrainingState(), ctx);
  const state = recordSession(initialTrainingState(), s0, logSession(s0, onTarget), ctx).state;
  const plan = applyState(planSessionWith(ctx, 4), state, ctx);
  const p = prescriptionsOf(plan).find((x) => x.loadKg !== null)!;
  return { state, plan, logs: logSession(plan, onTarget), p };
}

const extra = (p: Prescription, patch: Partial<SetLog>): SetLog => ({
  exerciseId: p.exerciseId, slot: p.slot, setIndex: p.sets, loadKg: p.loadKg, reps: p.targetReps, rir: 2, extra: true, ...patch,
});

/** What progression decides, without the strength estimates. */
const decisions = (s: TrainingState) =>
  Object.fromEntries(Object.entries(s.exercises).map(([id, x]) => [id, { ...x, e1rmKg: null, bestE1rmKg: null }]));

describe("added sets", () => {
  it("are left out of the judgement unless they hurt or are all there is", () => {
    const plannedSet: SetLog = { exerciseId: "a", setIndex: 0, loadKg: 10, reps: 10, rir: 2 };
    const added: SetLog = { ...plannedSet, setIndex: 1, extra: true };
    const hurt: SetLog = { ...added, setIndex: 2, painFlag: true };
    const alone: SetLog = { ...added, exerciseId: "b" };
    expect(judgedSets([plannedSet, added, hurt, alone])).toEqual([plannedSet, hurt, alone]);
  });

  it("don't trigger a stall or add strain when they're a grind", () => {
    const { state, plan, logs, p } = setup();
    const without = recordSessionWithExtras(state, plan, logs, ctx);
    const grind = recordSessionWithExtras(state, plan, [...logs, extra(p, { reps: 2, rir: 0 }), extra(p, { setIndex: p.sets + 1, reps: 1, rir: 0 })], ctx);
    expect(grind.changes).toEqual(without.changes);
    expect(decisions(grind.state)).toEqual(decisions(without.state));
    expect(grind.state.strain).toEqual(without.state.strain);
    // Judged on everything, the grinders would have counted.
    const naive = recordSession(state, plan, [...logs, extra(p, { reps: 2, rir: 0 }), extra(p, { setIndex: p.sets + 1, reps: 1, rir: 0 })], ctx);
    expect(naive.state.strain.at(-1)).toBeGreaterThan(without.state.strain.at(-1)!);
  });

  it("don't move the weight up, but do count toward the best lift", () => {
    const { state, plan, logs, p } = setup();
    const without = recordSessionWithExtras(state, plan, logs, ctx);
    const heavy = extra(p, { loadKg: p.loadKg! * 1.5, reps: p.repRange[1] + 2, rir: 4 });
    const withHeavy = recordSessionWithExtras(state, plan, [...logs, heavy], ctx);
    expect(withHeavy.changes).toEqual(without.changes);
    expect(decisions(withHeavy.state)).toEqual(decisions(without.state));
    const before = without.state.exercises[p.exerciseId]!;
    const after = withHeavy.state.exercises[p.exerciseId]!;
    expect(after.bestE1rmKg!).toBeGreaterThan(before.bestE1rmKg!);
    expect(after.e1rmKg!).toBeGreaterThan(before.e1rmKg!);
  });

  it("still count pain", () => {
    const { state, plan, logs, p } = setup();
    const r = recordSessionWithExtras(state, plan, [...logs, extra(p, { painFlag: true })], ctx);
    expect(r.changes.find((c) => c.exerciseId === p.exerciseId)!.action).toBe("pain");
    expect(r.state.exercises[p.exerciseId]!.painCheck).toBe(true);
  });

  it("are judged when nothing else of that exercise was logged", () => {
    const { state, plan, logs, p } = setup();
    const r = recordSessionWithExtras(state, plan, [...logs.filter((l) => l.exerciseId !== p.exerciseId), extra(p, {})], ctx);
    expect(r.changes.find((c) => c.exerciseId === p.exerciseId)!.action).not.toBe("skipped");
  });

  it("combine with a very sore exercise: it is held at its weight, and its added sets still count toward the best lift", () => {
    const { state, plan, logs, p } = setup();
    const sorePlan: SessionPlan = {
      ...plan,
      supersets: plan.supersets.map((ss) => ({ ...ss, items: ss.items.map((x) => (x.exerciseId === p.exerciseId ? { ...x, sore: { groups: [...getExercise(x.exerciseId).primary], setOff: false } } : x)) })),
    };
    // Reps well above target would move the weight up if the exercise weren't held.
    const strong = logs.map((l) => (l.exerciseId === p.exerciseId ? { ...l, reps: p.repRange[1] + 3, rir: 4 as const } : l));
    const heavy = extra(p, { loadKg: p.loadKg! * 1.5, reps: p.repRange[1] + 2, rir: 4 });
    const r = recordSessionWithExtras(state, sorePlan, [...strong, heavy], ctx, recordSoreSession);
    const after = r.state.exercises[p.exerciseId]!;
    expect(after.loadKg).toBe(state.exercises[p.exerciseId]?.loadKg ?? p.loadKg);
    const plain = recordSessionWithExtras(state, sorePlan, strong, ctx, recordSoreSession).state.exercises[p.exerciseId]!;
    expect(after.bestE1rmKg ?? 0).toBeGreaterThan(plain.bestE1rmKg ?? 0);
  });
});
