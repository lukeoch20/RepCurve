import { lbToKg } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { adviseNextSet } from "./advice.js";
import { buildPrescription } from "./prescribe.js";
import { getExercise } from "@repcurve/exercises";
import { adjustableEquipment, referenceContext, sets } from "./testkit.js";

const ctx = referenceContext();
const lb = lbToKg;

const goblet = (benchmarkSet: boolean, loadLb = 20) =>
  buildPrescription({
    exercise: getExercise("goblet_squat"),
    slot: "A.squat",
    sets: 3,
    repRange: [8, 15],
    targetReps: 10,
    loadKg: lb(loadLb),
    benchmarkSet,
    units: "lb",
  });

describe("adviseNextSet", () => {
  it("has nothing to say before the first set", () => {
    expect(adviseNextSet(goblet(false), [], ctx).message).toBe("");
  });

  it("keeps the weight after a good benchmark and sets the rep target", () => {
    const a = adviseNextSet(goblet(true), sets("goblet_squat", lb(20), [12], 2), ctx);
    expect(a.loadKg).toBeCloseTo(lb(20));
    expect(a.targetReps).toBe(12);
    expect(a.message).toBe("Benchmark logged. Stay at 20 lb and aim for 12 reps.");
  });

  it("moves the remaining sets up after a strong benchmark", () => {
    const a = adviseNextSet(goblet(true), sets("goblet_squat", lb(20), [20], 4), ctx);
    expect(a.loadKg).toBeCloseTo(lb(25));
    expect(a.tone).toBe("adjust");
    expect(a.message).toBe("Benchmark logged. Use 25 lb for the rest and aim for 11 reps.");
  });

  it("drops a dumbbell after a grind", () => {
    const a = adviseNextSet(goblet(false), sets("goblet_squat", lb(20), [6], 0), ctx);
    expect(a.loadKg).toBeCloseTo(lb(15));
    expect(a.message).toMatch(/Drop to 15 lb/);
  });

  it("suggests a heavier dumbbell only when the reps would still land in range", () => {
    const fixed = adviseNextSet(goblet(false), sets("goblet_squat", lb(20), [15], 4), ctx);
    expect(fixed.loadKg).toBeCloseTo(lb(20));
    expect(fixed.message).toMatch(/Add a couple of reps/);
    const adj = adviseNextSet(goblet(false), sets("goblet_squat", lb(20), [15], 4), referenceContext({ equipment: adjustableEquipment }));
    expect(adj.loadKg).toBeCloseTo(lb(22.5));
    expect(adj.message).toBe("Too easy. Try 22.5 lb next set.");
  });

  it("tells you to stop on pain", () => {
    const a = adviseNextSet(goblet(false), [{ ...sets("goblet_squat", lb(20), [8], 2)[0]!, painFlag: true }], ctx);
    expect(a.tone).toBe("stop");
  });

  it("sets bodyweight targets from a benchmark", () => {
    const p = buildPrescription({
      exercise: getExercise("incline_push_up"), slot: "A.horizontal_push", sets: 3, repRange: [8, 20],
      targetReps: 10, loadKg: null, benchmarkSet: true, units: "lb",
    });
    const a = adviseNextSet(p, sets("incline_push_up", null, [15], 3), ctx);
    expect(a.targetReps).toBe(16);
    expect(a.loadKg).toBeNull();
  });
});
