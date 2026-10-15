import { getExercise } from "@repcurve/exercises";
import { MACHINES } from "@repcurve/shared";
import type { Equipment, Profile, Split } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { makeContext } from "./context.js";
import { planSessionWith } from "./generate.js";
import { deltHeadCeiling, deltHeadTarget, volumeCeiling } from "./level.js";
import { referenceEquipment, referenceProfile } from "./testkit.js";
import type { SessionPlan } from "./types.js";
import { ceilingVolume, deltHeadSets, isDeltRaise, weeklyDeltHeads, weeklyVolume } from "./volume.js";

const gym = {
  dumbbells: { kind: "adjustable", min: 5, max: 100, step: 5, unit: "lb", pairs: true },
  treadmill: true, mat: true, abRoller: true, pullupBar: true, bench: true, flatBench: true, adjustableBench: true,
  bands: ["light", "medium", "heavy"], bandAnchor: true, barbell: true, rack: true, cables: true, machines: [...MACHINES],
} as Equipment;

function weeks(profile: Partial<Profile>, equipment: Equipment, from: number, to: number): SessionPlan[][] {
  const ctx = makeContext({ ...referenceProfile, ...profile } as Profile, equipment);
  const n = ctx.template.length;
  return Array.from({ length: to - from + 1 }, (_, w) => Array.from({ length: n }, (_, d) => planSessionWith(ctx, (from + w - 1) * n + d)));
}

describe("shoulder heads", () => {
  it("credits lateral raises to the side, rear-delt raises to the rear, and overhead presses half to the side", () => {
    expect(deltHeadSets(getExercise("db_lateral_raise"))).toEqual({ side_delts: 1, rear_delts: 0 });
    expect(deltHeadSets(getExercise("dumbbell_reverse_fly")).rear_delts).toBe(1);
    expect(deltHeadSets(getExercise("db_overhead_press")).side_delts).toBe(0.5);
    expect(isDeltRaise(getExercise("db_lateral_raise"))).toBe(true);
    expect(isDeltRaise(getExercise("cable_lateral_raise"))).toBe(true);
    expect(isDeltRaise(getExercise("dumbbell_reverse_fly"))).toBe(false);
    expect(isDeltRaise(getExercise("db_overhead_press"))).toBe(false);
  });

  it("gives regular lifters at 45 minutes at least 6 sets a week for the side of the shoulder (it was 2 to 4)", { timeout: 30_000 }, () => {
    for (const split of ["full_body", "push_pull", "upper_lower", "ppl"] as Split[]) {
      const ws = weeks({ trainingHistory: "regular", split, daysPerWeek: 4, minutesPerSession: 45 }, gym, 2, 7);
      const side = ws.reduce((sum, w) => sum + weeklyDeltHeads(w).side_delts, 0) / ws.length;
      expect(side, split).toBeGreaterThanOrEqual(6);
    }
  });

  it("keeps the side within its own ceiling, and shoulders within theirs once lateral raises are set aside", { timeout: 30_000 }, () => {
    for (const split of ["full_body", "push_pull", "upper_lower", "ppl"] as Split[]) {
      for (const minutesPerSession of [30, 45, 60]) {
        for (const w of weeks({ trainingHistory: "regular", split, daysPerWeek: 5, minutesPerSession }, gym, 2, 3)) {
          expect(weeklyDeltHeads(w).side_delts).toBeLessThanOrEqual(deltHeadCeiling("intermediate"));
          expect(ceilingVolume(w, "intermediate").shoulders).toBeLessThanOrEqual(volumeCeiling("intermediate") + 1e-9);
        }
      }
    }
  });

  it("leaves novices to the big lifts: no side target, and lateral raises count against the shoulders as before", () => {
    expect(deltHeadTarget("novice")).toBeNull();
    expect(deltHeadCeiling("novice")).toBe(Infinity);
    for (const split of ["full_body", "push_pull", "upper_lower", "ppl"] as Split[]) {
      for (const w of weeks({ trainingHistory: "never", split, daysPerWeek: 4, minutesPerSession: 45 }, referenceEquipment, 2, 3)) {
        expect(ceilingVolume(w, "novice")).toEqual(weeklyVolume(w));
        expect(weeklyVolume(w).shoulders).toBeLessThanOrEqual(volumeCeiling("novice") + 1e-9);
      }
    }
  });
});
