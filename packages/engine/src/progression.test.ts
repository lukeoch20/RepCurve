import { getExercise } from "@repcurve/exercises";
import { lbToKg } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { calibrate, freshProgress, ladderNeighbour, progressExercise, type ExerciseProgress } from "./progression.js";
import { adjustableEquipment, referenceContext, sets } from "./testkit.js";

const ctx = referenceContext();
const lb = lbToKg;

function progress(exerciseId: string, patch: Partial<ExerciseProgress> = {}): ExerciseProgress {
  return { ...freshProgress(getExercise(exerciseId), ctx), ...patch };
}

describe("progression: loaded exercises", () => {
  const goblet = progress("goblet_squat", { loadKg: lb(20), repRange: [8, 15], targetReps: 10 });

  it("holds the weight and asks for one more rep mid-range", () => {
    const r = progressExercise(goblet, sets("goblet_squat", lb(20), [12, 11, 10], 2), ctx);
    expect(r.action).toBe("add_rep");
    expect(r.next.loadKg).toBeCloseTo(lb(20));
    expect(r.next.targetReps).toBe(11);
    expect(r.next.e1rmKg).toBeGreaterThan(0);
    expect(r.next.timesPerformed).toBe(1);
  });

  it("jumps the rep target when the user reports reps to spare", () => {
    const r = progressExercise(goblet, sets("goblet_squat", lb(20), [10, 10, 10], 4), ctx);
    expect(r.action).toBe("add_rep");
    expect(r.next.targetReps).toBe(13);
  });

  it("steps up a dumbbell when the e1RM says the bottom of the range is reachable", () => {
    const adj = referenceContext({ equipment: adjustableEquipment });
    const r = progressExercise(goblet, sets("goblet_squat", lb(20), [15, 15, 15], 2), adj);
    expect(r.action).toBe("load_up");
    expect(r.next.loadKg).toBeCloseTo(lb(22.5));
    expect(r.next.targetReps).toBe(9);
  });

  it("moves up the ladder instead when the next dumbbell is too big a jump", () => {
    const r = progressExercise(goblet, sets("goblet_squat", lb(20), [15, 15, 15], 2), ctx);
    expect(r.action).toBe("ladder_up");
    expect(r.next.exerciseId).toBe("db_front_squat");
    // 20 lb goblet ≈ 15 lb per hand on a front squat (relative starting ratios 0.2 vs 0.15).
    expect(r.next.loadKg).toBeCloseTo(lb(15));
    expect(r.next.targetReps).toBe(8);
    expect(r.performed.exerciseId).toBe("goblet_squat");
  });

  it("builds reps when the jump is too big and there is no harder variant", () => {
    const p = progress("db_floor_press", { loadKg: lb(25), repRange: [8, 15], targetReps: 15 });
    const r = progressExercise(p, sets("db_floor_press", lb(25), [15, 15, 15], 2), ctx);
    expect(r.action).toBe("widen_range");
    expect(r.next.repRange).toEqual([8, 18]);
    expect(r.next.targetReps).toBe(16);
  });

  it("says so when the user has outgrown their equipment", () => {
    const p = progress("db_floor_press", { loadKg: lb(30), repRange: [8, 30], targetReps: 30 });
    const r = progressExercise(p, sets("db_floor_press", lb(30), [30, 30, 30], 2), ctx);
    expect(r.action).toBe("maxed_out");
    expect(r.reason).toMatch(/heavier dumbbells/);
    const again = progressExercise(r.next, sets("db_floor_press", lb(30), [30, 30, 30], 2), ctx);
    expect(again.action).toBe("hold");
  });

  it("keeps one-sided exercises at 12 reps per side and moves on to tempo", () => {
    const p = progress("single_arm_db_overhead_press", { loadKg: lb(30), repRange: [6, 12], targetReps: 12 });
    const r = progressExercise(p, sets("single_arm_db_overhead_press", lb(30), [12, 12, 12], 2), ctx);
    expect(r.action).toBe("maxed_out");
    expect(r.next.repRange).toEqual([6, 12]);
  });

  it("brings a range saved above the cap back inside it", () => {
    const p = progress("single_arm_db_overhead_press", { loadKg: lb(30), repRange: [8, 30], targetReps: 28 });
    const r = progressExercise(p, sets("single_arm_db_overhead_press", lb(30), [12, 12, 12], 2), ctx);
    expect(r.next.repRange).toEqual([8, 12]);
    expect(r.action).toBe("maxed_out");
  });

  it("notes one tough session, then drops a dumbbell after the second", () => {
    const r1 = progressExercise(goblet, sets("goblet_squat", lb(20), [7, 6, 5], 0), ctx);
    expect(r1.action).toBe("stall_noted");
    expect(r1.next.stalls).toBe(1);
    expect(r1.next.loadKg).toBeCloseTo(lb(20));
    const r2 = progressExercise(r1.next, sets("goblet_squat", lb(20), [7, 6, 5], 0), ctx);
    expect(r2.action).toBe("load_down");
    expect(r2.next.loadKg).toBeCloseTo(lb(15));
    expect(r2.next.stalls).toBe(0);
    expect(r2.next.targetReps).toBeGreaterThanOrEqual(8);
    expect(r2.next.targetReps).toBeLessThanOrEqual(15);
  });

  it("does not call a session too hard because the last tired set dipped below the range", () => {
    const r = progressExercise(goblet, sets("goblet_squat", lb(20), [10, 9, 7], [2, 1, 1]), ctx);
    expect(r.action).toBe("add_rep");
  });

  it("follows the dumbbell the user actually finished with", () => {
    const logs = [
      ...sets("goblet_squat", lb(20), [6], 0),
      ...sets("goblet_squat", lb(15), [12, 12], 2).map((s) => ({ ...s, setIndex: s.setIndex + 1 })),
    ];
    const r = progressExercise(goblet, logs, ctx);
    expect(r.next.loadKg).toBeCloseTo(lb(15));
    expect(r.action).toBe("add_rep");
  });

  it("swaps to an easier variation when the user flags pain", () => {
    const r = progressExercise(goblet, sets("goblet_squat", lb(20), [10, 10], 2).map((s, i) => (i === 1 ? { ...s, painFlag: true } : s)), ctx);
    expect(r.action).toBe("pain");
    expect(r.next.exerciseId).toBe("bodyweight_squat");
    expect(r.reason).toMatch(/get it checked/);
  });
});

describe("progression: bodyweight and holds", () => {
  it("moves up the push-up ladder when the range is owned", () => {
    const p = progress("knee_push_up", { repRange: [8, 20], targetReps: 20 });
    const r = progressExercise(p, sets("knee_push_up", null, [20, 20, 20], 2), ctx);
    expect(r.action).toBe("ladder_up");
    expect(r.next.exerciseId).toBe("push_up");
    expect(r.next.targetReps).toBe(8);
    expect(r.next.loadKg).toBeNull();
  });

  it("steps down the ladder after two tough sessions", () => {
    const p = progress("push_up", { stalls: 1, repRange: [8, 20] });
    const r = progressExercise(p, sets("push_up", null, [6, 5, 4], 0), ctx);
    expect(r.action).toBe("ladder_down");
    expect(r.next.exerciseId).toBe("knee_push_up");
  });

  it("lengthens holds in 15-second steps", () => {
    const p = progress("hollow_hold", { repRange: [30, 60], targetReps: 60 });
    const r = progressExercise(p, sets("hollow_hold", null, [60, 60], 2), ctx);
    expect(r.action).toBe("widen_range");
    expect(r.next.repRange).toEqual([30, 75]);
  });
});

describe("ladder neighbours", () => {
  it("skips rungs the user can't do", () => {
    const custom = referenceContext();
    const ladder = custom.pool.byLadder.get("hpush_bw")!.filter((e) => e.id !== "knee_push_up");
    custom.pool.byLadder.set("hpush_bw", ladder);
    expect(ladderNeighbour(getExercise("incline_push_up"), custom, 1)?.id).toBe("push_up");
    expect(ladderNeighbour(getExercise("push_up"), custom, -1)?.id).toBe("incline_push_up");
  });

  it("only offers rungs that fit the equipment", () => {
    // Feet-elevated push-ups need a bench, which the reference user doesn't have.
    expect(ladderNeighbour(getExercise("push_up"), ctx, 1)).toBeNull();
  });
});

describe("benchmark calibration", () => {
  it("sets the working weight and rep target from the benchmark set", () => {
    const p = progress("goblet_squat", { loadKg: lb(20) });
    const r = calibrate(p, sets("goblet_squat", lb(20), [12, 10], 2), ctx);
    expect(r.action).toBe("calibrated");
    expect(r.next.loadKg).toBeCloseTo(lb(20));
    expect(r.next.targetReps).toBe(12);
    expect(r.next.calibrated).toBe(true);
    expect(r.reason).toBe("Benchmark: working weight 20 lb, aim for 12 reps.");
  });

  it("moves up the ladder when the heaviest dumbbell is too light", () => {
    const p = progress("goblet_squat", { loadKg: lb(30) });
    const r = calibrate(p, sets("goblet_squat", lb(30), [20], 3), ctx);
    expect(r.next.exerciseId).toBe("db_front_squat");
    expect(r.next.loadKg).toBeCloseTo(lb(20));
    expect(r.performed.calibrated).toBe(true);
  });

  it("starts at the lightest dumbbell when even that is heavy", () => {
    const p = progress("db_overhead_press", { loadKg: lb(10) });
    const r = calibrate(p, sets("db_overhead_press", lb(10), [3], 0), ctx);
    expect(r.next.loadKg).toBeCloseTo(lb(10));
    expect(r.next.targetReps).toBe(8);
  });

  it("places bodyweight work on the right rung", () => {
    const easy = calibrate(progress("incline_push_up"), sets("incline_push_up", null, [20], 4), ctx);
    expect(easy.next.exerciseId).toBe("knee_push_up");
    const fits = calibrate(progress("knee_push_up"), sets("knee_push_up", null, [12], 2), ctx);
    expect(fits.next.exerciseId).toBe("knee_push_up");
    expect(fits.next.targetReps).toBe(12);
  });
});
