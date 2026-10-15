import type { ExerciseChange, Prescription } from "@repcurve/engine";
import { lbToKg } from "@repcurve/shared";
import type { Equipment, Profile } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { newCore } from "./plan";
import { startSession } from "./session";
import type { ActiveSession, LoggedSet, SessionRecord } from "./types";
import { lastChangeFor, whyThisLoad } from "./why";

const profile: Profile = {
  sex: "male", age: 33, heightCm: 178, bodyweightKg: 84, trainingHistory: "never", goal: "both",
  daysPerWeek: 4, minutesPerSession: 20, injuries: [], units: "lb",
};
const equipment: Equipment = {
  dumbbells: { kind: "fixed", weights: [10, 15, 20, 25, 30], unit: "lb", pairs: true },
  treadmill: true, mat: true, abRoller: true, pullupBar: false, bench: false, bands: [],
};
const T0 = Date.UTC(2026, 9, 5, 7, 0, 0);

function setup(): { active: ActiveSession; p: Prescription } {
  const core = { ...newCore(profile, equipment, T0), nextIndex: 4 };
  const active = startSession(core, [], T0, null);
  const first = active.plan.supersets.flatMap((ss) => ss.items).find((x) => x.loadType === "dumbbell_pair")!;
  return { active, p: { ...first, benchmarkSet: false, loadKg: lbToKg(25), targetReps: 10 } };
}

function record(p: Prescription, change: Partial<ExerciseChange>, reps: number[], index = 0): SessionRecord {
  const sets: LoggedSet[] = reps.map((r, i) => ({ exerciseId: p.exerciseId, slot: p.slot, setIndex: i, loadKg: lbToKg(20), reps: r, rir: 3, at: T0 }));
  sets.push({ exerciseId: p.exerciseId, slot: p.slot, setIndex: reps.length, loadKg: lbToKg(30), reps: 3, rir: 0, at: T0, extra: true });
  return {
    id: `s${index}`, index, kind: "strength", name: "A", week: 1, startedAt: T0, finishedAt: T0, activeMinutes: 20,
    plan: {} as SessionRecord["plan"], sets, cardio: null, deload: false, comeback: false, skipped: false,
    changes: [{
      slot: p.slot, exerciseId: p.exerciseId, nextExerciseId: p.exerciseId, action: "load_up",
      reason: "Top of the range with reps to spare: up to 25 lb each.",
      next: { loadKg: lbToKg(25), targetReps: 10, repRange: [8, 12] }, ...change,
    }],
  };
}

describe("why this weight", () => {
  it("explains a load-up from last time's planned sets", () => {
    const { active, p } = setup();
    expect(whyThisLoad(p, active, [record(p, {}, [12, 12, 12])], "lb")).toEqual([
      "Last time: 12, 12, 12 reps at 20 lb each.",
      "Top of the range with reps to spare: up to 25 lb each.",
    ]);
  });

  it("reads from today, not from last time", () => {
    const { active, p } = setup();
    const lines = whyThisLoad(p, active, [record(p, { action: "add_rep", reason: "Same weight next time; aim for one more rep.", next: { loadKg: lbToKg(25), targetReps: 11, repRange: [8, 12] } }, [10, 10, 9])], "lb");
    expect(lines[1]).toBe("Same weight, one more rep: aim for 11 today.");
    const tough = whyThisLoad(p, active, [record(p, { action: "stall_noted" }, [6, 5, 5])], "lb");
    expect(tough[1]).toMatch(/^That one was tough, so it's the same plan today/);
  });

  it("uses the newest session that changed it, skipping ones where it wasn't done", () => {
    const { p } = setup();
    const older = record(p, { reason: "old" }, [10, 10], 0);
    const newer = record(p, { reason: "new" }, [11, 11], 1);
    const notDone = record(p, { action: "skipped", reason: "Not logged this time." }, [], 2);
    expect(lastChangeFor(p.exerciseId, [older, newer, notDone])?.change.reason).toBe("new");
    expect(lastChangeFor("nope", [older])).toBeNull();
  });

  it("covers a benchmark, a first time, a swap, a deload, a nearer weight and a recent pain", () => {
    const { active, p } = setup();
    expect(whyThisLoad({ ...p, benchmarkSet: true }, active, [], "lb")[0]).toMatch(/^Benchmark: 25 lb each is a first guess/);
    expect(whyThisLoad(p, active, [], "lb")[0]).toMatch(/^First time: 25 lb each is a first guess/);
    expect(whyThisLoad({ ...p, loadKg: null, loadType: "bodyweight", targetReps: 12 }, active, [], "lb")[0]).toMatch(/^First time: 12 reps is a starting point/);
    const swapped: ActiveSession = { ...active, swaps: [{ slot: p.slot, from: "push_up", to: p.exerciseId, permanent: false }] };
    expect(whyThisLoad(p, swapped, [], "lb")[0]).toBe("Swapped in for Push-up today.");
    const deload: ActiveSession = { ...active, plan: { ...active.plan, deload: true } };
    expect(whyThisLoad(p, deload, [record(p, {}, [12, 12])], "lb")).toContain("Deload week: a step lighter and one set fewer while you recover.");
    expect(whyThisLoad({ ...p, loadKg: lbToKg(20) }, active, [record(p, {}, [12, 12])], "lb").at(-1)).toBe("20 lb each is the nearest your equipment allows.");
    expect(whyThisLoad({ ...p, caution: "Shoulder", painCheck: true }, active, [], "lb").at(-1)).toMatch(/^Your shoulder hurt recently/);
  });
});
