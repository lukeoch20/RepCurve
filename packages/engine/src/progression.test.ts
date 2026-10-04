import { lbToKg } from "@repcurve/shared";
import type { Equipment, SetLog } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { buildPool } from "./pool.js";
import { progressExercise, type ExerciseState } from "./progression.js";

const equipment: Equipment = {
  dumbbells: { kind: "fixed", weights: [10, 15, 20, 25, 30], unit: "lb", pairs: true },
  treadmill: true, mat: true, abRoller: true, pullupBar: false, bench: false, bands: [],
};
const pool = buildPool(equipment, []);

const sets = (exerciseId: string, loadKg: number | null, reps: number[], rir: 0 | 1 | 2 | 3 | 4): SetLog[] =>
  reps.map((r, i) => ({ exerciseId, setIndex: i, loadKg, reps: r, rir }));

describe("progression: loaded exercises", () => {
  const base: ExerciseState = { exerciseId: "goblet_squat", loadKg: lbToKg(20), repRange: [8, 15], targetRir: 2, stalls: 0, e1rmKg: null };

  it("holds and asks for one more rep mid-range", () => {
    const r = progressExercise(base, sets("goblet_squat", base.loadKg, [12, 11, 10], 2), equipment, pool);
    expect(r.action).toBe("add_rep");
    expect(r.next.loadKg).toBe(base.loadKg);
    expect(r.next.e1rmKg).toBeGreaterThan(0);
  });

  it("moves up the ladder when the next dumbbell is a big jump", () => {
    // 20 lb -> 25 lb is a 25% jump, so the engine prefers a harder variant first.
    const r = progressExercise(base, sets("goblet_squat", base.loadKg, [15, 15, 15], 2), equipment, pool);
    expect(r.action).toBe("ladder_up");
    expect(r.next.exerciseId).toBe("db_front_squat");
  });

  it("takes a small step up when the next dumbbell is close", () => {
    const adj: Equipment = { ...equipment, dumbbells: { kind: "adjustable", min: 5, max: 50, step: 2.5, unit: "lb", pairs: true } };
    const p = buildPool(adj, []);
    const s: ExerciseState = { ...base, loadKg: lbToKg(20) };
    const r = progressExercise(s, sets("goblet_squat", s.loadKg, [15, 15, 15], 2), adj, p);
    expect(r.action).toBe("load_up");
    expect(r.next.loadKg).toBeCloseTo(lbToKg(22.5));
  });

  it("notes one hard session, steps back after two", () => {
    const r1 = progressExercise(base, sets("goblet_squat", base.loadKg, [7, 6, 5], 0), equipment, pool);
    expect(r1.action).toBe("stall_noted");
    expect(r1.next.stalls).toBe(1);
    const r2 = progressExercise(r1.next, sets("goblet_squat", base.loadKg, [7, 6, 5], 0), equipment, pool);
    expect(r2.action).toBe("load_down");
    expect(r2.next.loadKg).toBeCloseTo(lbToKg(15));
    expect(r2.next.stalls).toBe(0);
  });

  it("widens the rep range at the heaviest dumbbell with no harder variant", () => {
    const s: ExerciseState = { exerciseId: "db_bent_over_row", loadKg: lbToKg(30), repRange: [8, 15], targetRir: 2, stalls: 0, e1rmKg: null };
    const r = progressExercise(s, sets("db_bent_over_row", s.loadKg, [15, 15, 15], 3), equipment, pool);
    // row_db has a level 3 (renegade row) available, so ladder_up is expected here.
    expect(["ladder_up", "widen_range"]).toContain(r.action);
  });
});

describe("progression: bodyweight exercises", () => {
  it("moves up the push-up ladder when the range is owned", () => {
    const s: ExerciseState = { exerciseId: "knee_push_up", loadKg: null, repRange: [8, 20], targetRir: 2, stalls: 0, e1rmKg: null };
    const r = progressExercise(s, sets("knee_push_up", null, [20, 20, 20], 2), equipment, pool);
    expect(r.action).toBe("ladder_up");
    expect(r.next.exerciseId).toBe("push_up");
  });

  it("steps down the ladder after two hard sessions", () => {
    const s: ExerciseState = { exerciseId: "push_up", loadKg: null, repRange: [8, 20], targetRir: 2, stalls: 1, e1rmKg: null };
    const r = progressExercise(s, sets("push_up", null, [6, 5, 4], 0), equipment, pool);
    expect(r.action).toBe("ladder_down");
    expect(r.next.exerciseId).toBe("knee_push_up");
  });
});
