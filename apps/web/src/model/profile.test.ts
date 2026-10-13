import { prescriptionsOf, swapSticks } from "@repcurve/engine";
import { getExercise } from "@repcurve/exercises";
import type { Equipment, Profile } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { newCore, todayPlan } from "./plan";
import { profileFor } from "./profile";
import { finishSession, startSession, swapExercise } from "./session";
import type { SessionRecord } from "./types";

const profile: Profile = {
  sex: "male", age: 33, heightCm: 178, bodyweightKg: 84, trainingHistory: "never", goal: "both",
  daysPerWeek: 4, minutesPerSession: 30, injuries: [], units: "lb", split: "full_body",
};
const equipment: Equipment = {
  dumbbells: { kind: "fixed", weights: [10, 15, 20, 25, 30], unit: "lb", pairs: true },
  treadmill: true, mat: true, abRoller: true, pullupBar: false, bench: true, bands: [],
};
const T0 = Date.UTC(2026, 9, 5, 7);
const DAY = 86_400_000;

describe("the training profile in the app", () => {
  it("remembers why an exercise was swapped, and a second 'too hard' sticks", () => {
    const core = newCore(profile, equipment, T0);
    const active = startSession(core, [], T0, null);
    const p = prescriptionsOf(active.plan)[0]!;
    const swapped = swapExercise(active, core, p.slot, "bodyweight_squat", false, "hard");
    expect(swapped.active.swaps).toEqual([{ slot: p.slot, from: p.exerciseId, to: "bodyweight_squat", permanent: false, reason: "hard" }]);
    const { record } = finishSession(swapped.active, swapped.core, T0 + 30 * 60_000);
    expect(record.swaps).toHaveLength(1);
    const prof = profileFor(core, [record], T0 + DAY);
    expect(prof.preferences.tooHard[p.exerciseId]).toBe(1);
    expect(swapSticks(prof, p.exerciseId, "hard")).toBe(true);
  });

  it("puts a check-in on every exercise that loads an area that hurt recently", () => {
    const core = newCore(profile, equipment, T0);
    const hurt: SessionRecord = {
      id: "s1", index: 0, kind: "strength", name: "Full body A", week: 1, startedAt: T0, finishedAt: T0, activeMinutes: 20,
      plan: {} as SessionRecord["plan"], changes: [], cardio: null, deload: false, comeback: false, skipped: false,
      sets: [{ exerciseId: "db_overhead_press", slot: "A.vpush", setIndex: 0, loadKg: 9, reps: 8, rir: 2, painFlag: true, painArea: "Shoulder", at: T0 }],
    };
    let cautioned = 0;
    for (let i = 1; i < 6; i++) {
      for (const p of prescriptionsOf(todayPlan({ ...core, nextIndex: i }, [hurt], T0 + DAY))) {
        const loadsShoulder = getExercise(p.exerciseId).avoidWith.includes("shoulder");
        expect(p.caution, p.exerciseId).toBe(loadsShoulder ? "Shoulder" : undefined);
        if (loadsShoulder) cautioned++;
      }
    }
    expect(cautioned).toBeGreaterThan(0);
    // Six weeks later, it's over.
    const later = prescriptionsOf(todayPlan({ ...core, nextIndex: 1 }, [hurt], T0 + 43 * DAY));
    expect(later.every((p) => p.caution === undefined)).toBe(true);
  });

  it("keeps the caution when an exercise is swapped for one that loads the same area", () => {
    const core = newCore(profile, equipment, T0);
    const hurt: SessionRecord = {
      id: "s1", index: 0, kind: "strength", name: "Full body A", week: 1, startedAt: T0, finishedAt: T0, activeMinutes: 20,
      plan: {} as SessionRecord["plan"], changes: [], cardio: null, deload: false, comeback: false, skipped: false,
      sets: [{ exerciseId: "db_rdl", slot: "A.hinge", setIndex: 0, loadKg: 9, reps: 8, rir: 2, painFlag: true, painArea: "Lower back", at: T0 }],
    };
    const history = [hurt];
    const prof = profileFor(core, history, T0 + DAY);
    // Find a planned row that spares the lower back, then swap it for the bent-over row, which doesn't.
    for (let i = 1; i < 8; i++) {
      const active = startSession({ ...core, nextIndex: i }, history, T0 + DAY, null);
      const row = prescriptionsOf(active.plan).find((p) => p.pattern === "row" && !getExercise(p.exerciseId).avoidWith.includes("low_back"));
      if (!row) continue;
      expect(row.caution).toBeUndefined();
      const swapped = swapExercise(active, { ...core, nextIndex: i }, row.slot, "db_bent_over_row", false, "busy", prof);
      const np = prescriptionsOf(swapped.active.plan).find((p) => p.slot === row.slot)!;
      expect(np.exerciseId).toBe("db_bent_over_row");
      expect(np).toMatchObject({ painCheck: true, caution: "Lower back", benchmarkSet: false });
      // Swapping back to an exercise that spares the area drops the check-in.
      const back = swapExercise(swapped.active, { ...core, nextIndex: i }, row.slot, row.exerciseId, false, "busy", prof);
      expect(prescriptionsOf(back.active.plan).find((p) => p.slot === row.slot)!.caution).toBeUndefined();
      return;
    }
    throw new Error("no planned row that spares the lower back");
  });
});
