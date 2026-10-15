import { getExercise } from "@repcurve/exercises";
import { describe, expect, it } from "vitest";
import { BLOCK_WEEKS, planSessionWith } from "./generate.js";
import { applyState, initialTrainingState, preferExercise, prescriptionsOf, type TrainingState } from "./state.js";
import { referenceContext } from "./testkit.js";
import type { Prescription } from "./types.js";

const ctx = referenceContext({ profile: { trainingHistory: "regular" } });
const days = ctx.template.length;
/** Strength session indices in a week (1-based week). */
const strengthIn = (week: number) =>
  [...Array(days).keys()].map((d) => (week - 1) * days + d).filter((i) => ctx.template[i % days] === "strength");
const altWeek = BLOCK_WEEKS + 1;

/** Prescriptions in the alternate block that stand in for another exercise, with their session index. */
const alternates = (): { index: number; p: Prescription }[] =>
  strengthIn(altWeek).flatMap((index) => prescriptionsOf(planSessionWith(ctx, index)).filter((p) => p.alternateOf).map((p) => ({ index, p })));

describe("alternate blocks carry swaps over", () => {
  it("the alternate block marks what each alternate stands in for, and the first block marks nothing", () => {
    expect(alternates().length).toBeGreaterThan(0);
    for (const { p } of alternates()) expect(p.alternateOf).not.toBe(p.exerciseId);
    for (const index of strengthIn(1)) expect(prescriptionsOf(planSessionWith(ctx, index)).some((p) => p.alternateOf)).toBe(false);
  });

  it('a "do this instead" made on the usual exercise holds in the alternate block', () => {
    let checked = 0;
    for (const { index, p } of alternates()) {
      const base = getExercise(p.alternateOf!);
      // Any other exercise of the same movement in the pool, not already the alternate.
      const other = ctx.pool.exercises.find((e) => e.pattern === base.pattern && e.id !== base.id && e.id !== p.exerciseId);
      if (!other) continue;
      const state = preferExercise(initialTrainingState(), base.id, other.id);
      const applied = applyState(planSessionWith(ctx, index), state, ctx);
      // The swapped-to exercise fills the slot unless something else in the session already uses it.
      const taken = prescriptionsOf(planSessionWith(ctx, index)).some((x) => x.exerciseId === other.id && x.slot !== p.slot);
      if (taken) continue;
      checked++;
      expect(prescriptionsOf(applied).find((x) => x.slot === p.slot)!.exerciseId, `${p.slot}: ${base.id} → ${other.id}`).toBe(other.id);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("a swap made on the alternate itself wins over one carried from the usual exercise", () => {
    const { index, p } = alternates()[0]!;
    const base = getExercise(p.alternateOf!);
    const pool = ctx.pool.exercises.filter((e) => e.pattern === base.pattern && e.id !== base.id && e.id !== p.exerciseId);
    expect(pool.length).toBeGreaterThan(1);
    let state: TrainingState = preferExercise(initialTrainingState(), base.id, pool[0]!.id);
    state = preferExercise(state, p.exerciseId, pool[1]!.id);
    const applied = applyState(planSessionWith(ctx, index), state, ctx);
    expect(prescriptionsOf(applied).find((x) => x.slot === p.slot)!.exerciseId).toBe(pool[1]!.id);
  });

  it("with no swaps, the alternate block uses the alternates", () => {
    const { index, p } = alternates()[0]!;
    const applied = applyState(planSessionWith(ctx, index), initialTrainingState(), ctx);
    expect(prescriptionsOf(applied).find((x) => x.slot === p.slot)!.exerciseId).toBe(p.exerciseId);
  });
});
