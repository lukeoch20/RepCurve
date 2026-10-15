/** The weekly ceiling on hard sets per muscle, and push/pull balance. */
import { getExercise } from "@repcurve/exercises";
import type { Equipment, Muscle, Profile, Split, TrainingHistory } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { makeContext } from "./context.js";
import { planSessionWith } from "./generate.js";
import { deltHeadCeiling, volumeCeiling } from "./level.js";
import { referenceEquipment, referenceProfile } from "./testkit.js";
import type { SessionPlan } from "./types.js";
import { DELT_HEADS, MUSCLES, ceilingVolume, weeklyDeltHeads, weeklyVolume } from "./volume.js";

const gym: Equipment = {
  ...referenceEquipment,
  dumbbells: { kind: "fixed", weights: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50], unit: "lb", pairs: true },
  bench: true,
  pullupBar: true,
  barbell: true,
  machines: ["leg_press", "lat_pulldown", "cable", "chest_press", "leg_curl", "leg_extension", "seated_row", "shoulder_press"],
} as Equipment;

const SPLITS: Split[] = ["full_body", "push_pull", "upper_lower", "ppl"];
const HISTORIES: TrainingHistory[] = ["never", "regular"];

function weekOf(profile: Partial<Profile>, equipment: Equipment, week: number): SessionPlan[] {
  const ctx = makeContext({ ...referenceProfile, ...profile }, equipment);
  const n = ctx.template.length;
  return Array.from({ length: n }, (_, d) => planSessionWith(ctx, (week - 1) * n + d));
}

const worked = (v: Record<Muscle, number>) => MUSCLES.filter((m) => m !== "core");

describe("the weekly volume ceiling", () => {
  it("keeps every muscle at or under the ceiling, for every split, length, day count and level", { timeout: 60_000 }, () => {
    for (const equipment of [referenceEquipment, gym])
      for (const trainingHistory of HISTORIES)
        for (const split of SPLITS)
          for (const daysPerWeek of [2, 3, 4, 5, 6])
            for (const minutesPerSession of [10, 20, 30, 45]) {
              const profile = { trainingHistory, split, daysPerWeek, minutesPerSession };
              const level = makeContext({ ...referenceProfile, ...profile }, equipment).level;
              const ceiling = volumeCeiling(level);
              for (const week of [1, 2, 3]) {
                // Past the novice stage, lateral raises count against the side head's own ceiling.
                const sessions = weekOf(profile, equipment, week);
                const v = ceilingVolume(sessions, level);
                for (const m of worked(v)) expect(v[m], `${JSON.stringify(profile)} week ${week} ${m}`).toBeLessThanOrEqual(ceiling + 1e-9);
                const heads = weeklyDeltHeads(sessions);
                for (const h of DELT_HEADS) expect(heads[h], `${JSON.stringify(profile)} week ${week} ${h}`).toBeLessThanOrEqual(deltHeadCeiling(level) + 1e-9);
              }
            }
  });

  it("is half again the top of the target: 15 sets for a novice, 24 for an intermediate", () => {
    expect(volumeCeiling("novice")).toBe(15);
    expect(volumeCeiling("intermediate")).toBe(24);
  });

  it("brings the 45-minute novice upper/lower week down from 40 glute sets", () => {
    const v = weeklyVolume(weekOf({ trainingHistory: "never", split: "upper_lower", daysPerWeek: 4, minutesPerSession: 45 }, referenceEquipment, 2));
    expect(v.glutes).toBeLessThanOrEqual(15);
    expect(v.quads).toBeLessThanOrEqual(15);
  });

  it("says why a session stops short of the time chosen", () => {
    const sessions = weekOf({ trainingHistory: "never", split: "upper_lower", daysPerWeek: 4, minutesPerSession: 45 }, gym, 2);
    const short = sessions.filter((s) => s.kind === "strength" && s.estimatedMinutes <= 42);
    expect(short.length).toBeGreaterThan(0);
    for (const s of short) expect(s.notes?.join(" ")).toMatch(/on purpose/);
  });

  it("never adds a third squat to a full-body day, even on a long day", () => {
    const family = (id: string) => `${getExercise(id).pattern}:${getExercise(id).family}`;
    for (const minutes of [45, 60, 90]) {
      const ctx = makeContext({ ...referenceProfile, split: "full_body", daysPerWeek: 4, minutesPerSession: 30 }, gym);
      for (let d = 0; d < ctx.template.length; d++) {
        const s = planSessionWith(ctx, ctx.template.length + d, { minutes });
        const counts = new Map<string, number>();
        for (const p of s.supersets.flatMap((ss) => ss.items)) counts.set(family(p.exerciseId), (counts.get(family(p.exerciseId)) ?? 0) + 1);
        for (const [f, n] of counts) expect(n, `${minutes} min ${s.name} ${f}`).toBeLessThanOrEqual(2);
      }
    }
  });
});

describe("push and pull days", () => {
  it("give chest about as many sets as back over two weeks", () => {
    for (const equipment of [referenceEquipment, gym])
      for (const daysPerWeek of [3, 4])
        for (const minutesPerSession of [20, 30]) {
          const profile = { split: "push_pull" as Split, daysPerWeek, minutesPerSession };
          const v = weeklyVolume([...weekOf(profile, equipment, 2), ...weekOf(profile, equipment, 3)]);
          expect(v.chest, JSON.stringify(profile)).toBeGreaterThanOrEqual(v.back * 0.75);
        }
  });
});
