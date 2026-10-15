import { EXERCISES, getExercise } from "@repcurve/exercises";
import { MACHINES, availableLoadsKg, lbToKg } from "@repcurve/shared";
import type { Equipment, Profile } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { makeContext } from "./context.js";
import { generateProgram, planSessionWith } from "./generate.js";
import { alternativesFor, prescriptionsOf } from "./state.js";
import { referenceEquipment, referenceProfile } from "./testkit.js";
import { setupSeconds } from "./timing.js";

const gym: Equipment = {
  dumbbells: { kind: "adjustable", min: 5, max: 100, step: 5, unit: "lb", pairs: true },
  treadmill: true, mat: true, abRoller: true, pullupBar: true, bench: true, flatBench: true, adjustableBench: true,
  bands: [], barbell: true, rack: true, trapBar: true, ezBar: true, cables: true, machines: [...MACHINES],
};
const bodyweight: Equipment = { ...referenceEquipment, dumbbells: { kind: "none" }, abRoller: false };

function week(profile: Partial<Profile>, equipment: Equipment) {
  const program = generateProgram({ profile: { ...referenceProfile, ...profile }, equipment }, { weeks: 2, createdAt: "test" });
  return program.sessions.filter((s) => s.week === 2 && s.kind === "strength");
}
const idsOf = (sessions: ReturnType<typeof week>) => sessions.flatMap((s) => prescriptionsOf(s).map((p) => p.exerciseId));

describe("the evidence review's catalog in plans", () => {
  it("never plans an optional, advanced or retired exercise on its own", () => {
    for (const equipment of [referenceEquipment, bodyweight, gym]) {
      for (const split of ["full_body", "push_pull", "upper_lower", "ppl"] as const) {
        for (const id of idsOf(week({ split, minutesPerSession: 40 }, equipment))) {
          expect(getExercise(id).tier, id).toBe("default");
        }
      }
    }
  });

  it("gives a gym newcomer a coherent machine-based plan", () => {
    const ids = idsOf(week({ split: "push_pull", minutesPerSession: 30 }, gym));
    expect(ids).toContain("machine_chest_press");
    expect(ids).toContain("leg_press");
    expect(ids).toContain("lat_pulldown");
    expect(ids.some((id) => getExercise(id).loadType === "barbell")).toBe(false);
  });

  it("has experienced lifters chasing strength practise the barbell lifts", () => {
    const ids = idsOf(week({ split: "full_body", trainingHistory: "regular", goal: "strength_muscle", minutesPerSession: 40, daysPerWeek: 3 }, gym));
    expect(ids).toContain("barbell_back_squat");
    expect(ids).toContain("barbell_bench_press");
  });

  it("adds a knee-flexion (hamstring curl) exercise alongside hinges", () => {
    for (const equipment of [referenceEquipment, bodyweight, gym]) {
      const ids = idsOf(week({ split: "push_pull", minutesPerSession: 30 }, equipment));
      expect(ids.some((id) => getExercise(id).family === "knee_flexion"), JSON.stringify(ids)).toBe(true);
      expect(ids.some((id) => getExercise(id).family === "rdl" || getExercise(id).family === "bridge")).toBe(true);
    }
  });

  it("is honest when nothing trains pulling, and names the smallest fix", () => {
    const sessions = week({ split: "full_body" }, bodyweight);
    expect(idsOf(sessions).some((id) => ["row", "vertical_pull"].includes(getExercise(id).pattern))).toBe(false);
    for (const s of sessions) expect(s.coverage?.[0]).toMatch(/bands with a door anchor/);
    expect(week({ split: "full_body" }, { ...bodyweight, bands: ["medium"], bandAnchor: true })[0]!.coverage).toBeUndefined();
  });

  it("only offers band rows and pulldowns with a secure anchor", () => {
    const noAnchor = idsOf(week({ split: "push_pull" }, { ...bodyweight, bands: ["medium"] }));
    expect(noAnchor).not.toContain("band_row");
    const anchored = idsOf(week({ split: "push_pull" }, { ...bodyweight, bands: ["medium"], bandAnchor: true }));
    expect(anchored).toContain("band_row");
  });

  it("never makes a jump rope the warm-up", () => {
    const s = planSessionWith(makeContext(referenceProfile, { ...referenceEquipment, jumpRope: true }), 0);
    expect(s.warmup.map((w) => w.name).join()).not.toMatch(/rope/i);
  });
});

describe("time and loads for gym equipment", () => {
  it("counts setup once per exercise, not per round", () => {
    const s = planSessionWith(makeContext({ ...referenceProfile, minutesPerSession: 30, split: "push_pull" }, gym), 7);
    const ss = s.supersets[0]!;
    const setup = setupSeconds(ss.items.map((p) => getExercise(p.exerciseId)));
    expect(setup).toBeGreaterThan(0);
    expect(s.estimatedMinutes).toBeLessThanOrEqual(30);
  });

  it("loads a barbell from the empty bar in plate steps, and a machine in stack steps", () => {
    const bar = availableLoadsKg({ loadType: "barbell", barKg: 20 }, gym, "lb");
    expect(bar[0]).toBeCloseTo(lbToKg(45));
    expect(bar[1]! - bar[0]!).toBeCloseTo(lbToKg(5));
    const stack = availableLoadsKg({ loadType: "machine" }, gym, "kg");
    expect(stack.slice(0, 3)).toEqual([5, 10, 15]);
  });

  it("never starts a barbell lift below the empty bar", () => {
    const ctx = makeContext({ ...referenceProfile, sex: "female", bodyweightKg: 50, split: "full_body", trainingHistory: "regular", goal: "strength_muscle", minutesPerSession: 40 }, gym);
    for (let i = 0; i < 6; i++) {
      for (const p of prescriptionsOf(planSessionWith(ctx, i))) {
        const e = getExercise(p.exerciseId);
        if (e.loadType === "barbell") expect(p.loadKg!).toBeGreaterThanOrEqual(lbToKg(45) - 1e-6);
      }
    }
  });
});

describe("swaps", () => {
  const ctx = makeContext({ ...referenceProfile, split: "push_pull" }, { ...referenceEquipment, bench: true });
  const all = [0, 1, 2, 3, 4, 5].flatMap((i) => prescriptionsOf(planSessionWith(ctx, i)));
  const press = all.find((p) => p.pattern === "horizontal_push")!;

  it("offers optional and advanced exercises after the planner's own choices", () => {
    const tiers = alternativesFor(press, ctx).map((e) => e.tier);
    expect(tiers).toContain("optional");
    expect(tiers.indexOf("optional")).toBeGreaterThan(tiers.lastIndexOf("default"));
  });

  it("puts different equipment first when the equipment is busy, and two-sided options first for balance", () => {
    const current = getExercise(press.exerciseId);
    expect(alternativesFor(press, ctx, [], "busy")[0]!.loadType).not.toBe(current.loadType);
    const lunge = { ...press, exerciseId: "db_reverse_lunge", pattern: "squat" as const };
    expect(alternativesFor(lunge, ctx, [], "balance")[0]!.unilateral).toBe(false);
  });

  it("keeps an isolation swap to the same job: a curl is not a lateral raise", () => {
    const curl = { ...press, exerciseId: "db_curl", pattern: "isolation" as const };
    for (const e of alternativesFor(curl, makeContext(referenceProfile, gym))) expect(e.family).toBe("biceps");
  });

  it("never offers the retired towel row", () => {
    const row = { ...press, exerciseId: "one_arm_db_row", pattern: "row" as const };
    expect(alternativesFor(row, ctx).map((e) => e.id)).not.toContain("towel_door_row");
    expect(EXERCISES.find((e) => e.id === "towel_door_row")!.tier).toBe("retired");
  });
});
