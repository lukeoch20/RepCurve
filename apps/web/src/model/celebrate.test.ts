import type { Equipment, Profile } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { caloriesFor, celebrate, movedKg, newRecords } from "./celebrate";
import { newCore, planFor } from "./plan";
import type { SessionRecord } from "./types";

const DAY = 86_400_000;
const T0 = new Date(2026, 8, 7, 18).getTime(); // a Monday evening, local time
const profile: Profile = {
  sex: "male", age: 33, heightCm: 178, bodyweightKg: 84, trainingHistory: "never", goal: "both",
  daysPerWeek: 3, minutesPerSession: 20, injuries: [], units: "lb",
};
const equipment: Equipment = {
  dumbbells: { kind: "fixed", weights: [10, 15, 20, 25, 30], unit: "lb", pairs: true },
  treadmill: true, mat: true, abRoller: true, pullupBar: false, bench: true, bands: [],
};
const core = newCore(profile, equipment, T0);
const plan = planFor(core, 0);

function rec(i: number, day: number, sets: { id: string; load: number | null; reps: number }[], extra: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: `s${i}`, index: i, kind: "strength", name: "Full body A", week: 1, startedAt: T0 + day * DAY, finishedAt: T0 + day * DAY,
    activeMinutes: 20, plan, changes: [], cardio: null, deload: false, comeback: false, skipped: false,
    sets: sets.map((s, k) => ({ exerciseId: s.id, slot: "A.x", setIndex: k, loadKg: s.load, reps: s.reps, rir: 2, at: 0 })),
    ...extra,
  };
}

describe("session celebration", () => {
  it("estimates calories from body weight, time and the kind of session", () => {
    // 5 METs x 84 kg x 1/3 h = 140.
    expect(caloriesFor(rec(0, 0, []), 84)).toBe(140);
    const walk = rec(0, 0, [], { kind: "cardio", cardio: { minutes: 30, effort: 3, notes: "" } });
    const run = rec(0, 0, [], { kind: "cardio", cardio: { minutes: 30, effort: 8, notes: "" } });
    expect(caloriesFor(run, 84)).toBeGreaterThan(caloriesFor(walk, 84));
    expect(caloriesFor(walk, 84) % 5).toBe(0);
  });

  it("counts both dumbbells of a pair and both sides of a one-sided move", () => {
    const pair = plan.supersets.flatMap((s) => s.items).find((p) => p.loadType === "dumbbell_pair" && !p.unilateral)!;
    const r = rec(0, 0, [{ id: pair.exerciseId, load: 10, reps: 10 }, { id: "push_up", load: null, reps: 10 }]);
    expect(movedKg(r)).toBe(200);
  });

  it("finds new records only against earlier sessions of the same lift", () => {
    const h = [
      rec(0, 0, [{ id: "goblet_squat", load: 10, reps: 10 }, { id: "push_up", load: null, reps: 8 }]),
      rec(1, 2, [{ id: "goblet_squat", load: 12, reps: 10 }, { id: "push_up", load: null, reps: 8 }, { id: "reverse_lunge", load: null, reps: 10 }]),
    ];
    const recs = newRecords(h[1]!, h);
    expect(recs.map((r) => r.exerciseId)).toEqual(["goblet_squat"]); // push-ups tied; lunge is new, not a record
    expect(newRecords(h[0]!, h)).toEqual([]);
  });

  it("makes the first workout, milestones and full weeks feel like an occasion", () => {
    const first = rec(0, 0, [{ id: "goblet_squat", load: 10, reps: 10 }]);
    expect(celebrate(first, [first], core).headline).toBe("First workout done!");

    const ten = Array.from({ length: 10 }, (_, i) => rec(i, i * 2, [{ id: "goblet_squat", load: 10, reps: 10 }]));
    expect(celebrate(ten[9]!, ten, core).headline).toBe("Workout number 10!");

    const week = [0, 1, 2].map((d) => rec(d + 20, d, [{ id: "push_up", load: null, reps: 8 }]));
    const c = celebrate(week[2]!, [rec(19, -10, [{ id: "push_up", load: null, reps: 8 }]), ...week], core);
    expect(c.week).toEqual({ done: 3, planned: 3 });
    expect(c.headline).toBe("Week complete!");
    expect(c.benefits).toHaveLength(2);
  });

  it("works for records saved without a plan", () => {
    const r = { ...rec(0, 0, [{ id: "goblet_squat", load: 10, reps: 10 }]), plan: {} as SessionRecord["plan"] };
    expect(() => celebrate(r, [r], core)).not.toThrow();
  });
});
