import type { Equipment, Profile } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { newCore } from "./plan";
import { adherence, liftObservations, previewProjection, userProjection } from "./projection";
import type { SessionRecord } from "./types";

const profile: Profile = {
  sex: "male", age: 33, heightCm: 178, bodyweightKg: 84, trainingHistory: "never", goal: "both",
  daysPerWeek: 4, minutesPerSession: 20, injuries: [], units: "lb",
};
const equipment: Equipment = {
  dumbbells: { kind: "fixed", weights: [10, 15, 20, 25, 30], unit: "lb", pairs: true },
  treadmill: true, mat: true, abRoller: true, pullupBar: false, bench: false, bands: [],
};
const T0 = Date.UTC(2026, 9, 5);
const DAY = 86_400_000;

function rec(i: number, day: number, load: number, reps: number): SessionRecord {
  return {
    id: `s${i}`, index: i, kind: "strength", name: "Full body A", week: 1, startedAt: T0 + day * DAY, finishedAt: T0 + day * DAY,
    activeMinutes: 20, plan: {} as SessionRecord["plan"], changes: [], cardio: null, deload: false, comeback: false, skipped: false,
    sets: [{ exerciseId: "goblet_squat", slot: "A.squat", setIndex: 0, loadKg: load, reps, rir: 2, at: 0 }],
  };
}

describe("projection glue", () => {
  it("previews a plan before any training", () => {
    const p = previewProjection(profile, equipment);
    expect(p.points.find((x) => x.week === 12)!.strengthPct.mid).toBeGreaterThan(10);
  });

  it("turns history into lift observations measured in weeks", () => {
    const obs = liftObservations([rec(0, 0, 10, 10), rec(1, 14, 10, 14)], new Date(T0).toISOString());
    expect(obs).toHaveLength(2);
    expect(obs[1]!.week).toBeCloseTo(2);
  });

  it("measures adherence from the first session, after two full weeks (RC-30)", () => {
    const core = newCore(profile, equipment, T0);
    expect(adherence(core, [], T0 + 30 * DAY)).toBeUndefined();
    // Set up on day 0, first session on day 7: a week later it's too early to judge.
    expect(adherence(core, [rec(0, 7, 10, 10)], T0 + 15 * DAY)).toBeUndefined();
    const eight = Array.from({ length: 8 }, (_, i) => rec(i, 7 + i * 1.75, 10, 10));
    expect(adherence(core, eight, T0 + 21 * DAY)).toBeCloseTo(1);
    expect(adherence(core, eight.slice(0, 4), T0 + 21 * DAY)).toBeCloseTo(0.5);
  });

  it("projects for a user with history", () => {
    const core = newCore(profile, equipment, T0);
    const p = userProjection(core, [rec(0, 0, 10, 10)], T0 + 2 * DAY);
    expect(p.points).toHaveLength(5);
  });
});
