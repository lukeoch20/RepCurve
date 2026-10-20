import { getExercise } from "@repcurve/exercises";
import { prescriptionsOf } from "@repcurve/engine";
import type { Equipment, Muscle, Profile } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { INITIAL, reducer, type AppState } from "../store/reducer";
import { migrateCore } from "./migrate";
import { isRegenerated, newCore, originalToday, planExerciseIds, planWork, regenerateToday, todayPlan } from "./plan";
import { finishSession, logSet, setOrder, startSession } from "./session";
import type { Core, SessionRecord } from "./types";

const profile: Profile = {
  sex: "female", age: 38, heightCm: 168, bodyweightKg: 66, trainingHistory: "regular", goal: "both",
  daysPerWeek: 3, minutesPerSession: 30, injuries: [], units: "lb", split: "full_body",
};
const dumbbells: Equipment = {
  dumbbells: { kind: "fixed", weights: [10, 15, 20, 25, 30, 35, 40], unit: "lb", pairs: true },
  treadmill: false, mat: true, abRoller: false, pullupBar: false, bench: true, bands: ["medium"],
};
const T0 = Date.UTC(2026, 9, 18, 7);
const muscles = (core: Core) => {
  const plan = todayPlan(core, [], T0);
  return new Set<Muscle>(prescriptionsOf(plan).flatMap((p) => getExercise(p.exerciseId).primary));
};

describe("regenerating today's session", () => {
  const core = newCore(profile, dumbbells, T0);

  it("swaps in other exercises for the same day and keeps the session as full", () => {
    const before = todayPlan(core, [], T0);
    const next = regenerateToday(core, [], T0)!;
    expect(next).not.toBeNull();
    expect(isRegenerated(next)).toBe(true);
    const after = todayPlan(next, [], T0);
    expect(after.kind).toBe("strength");
    expect(after.name).toBe(before.name);
    // All new: even the only overhead press the planner uses gives way to a stand-in (a one-arm press).
    const first = planExerciseIds(before);
    expect(planExerciseIds(after).filter((id) => first.includes(id))).toEqual([]);
    expect(planWork(after)).toBeGreaterThanOrEqual(0.85 * planWork(before));
    expect(after.estimatedMinutes).toBeLessThanOrEqual(profile.minutesPerSession + 1);
    // The same day trains (mostly) the same muscles.
    const was = muscles(core);
    const now = muscles(next);
    expect([...was].filter((m) => now.has(m)).length).toBeGreaterThanOrEqual(Math.min(was.size, now.size) - 1);
  });

  it("offers something new each time, always training the day's main movements", () => {
    const planned = todayPlan(core, [], T0);
    const patterns = (plan: typeof planned) => new Set(prescriptionsOf(plan).map((p) => p.pattern).filter((p) => p !== "isolation" && p !== "core"));
    const needed = patterns(planned);
    let c = core;
    let shown = planExerciseIds(planned);
    for (let i = 0; i < 6; i++) {
      const next = regenerateToday(c, [], T0);
      expect(next, `regenerate ${i + 1}`).not.toBeNull();
      const plan = todayPlan(next!, [], T0);
      const ids = planExerciseIds(plan);
      expect(ids, `regenerate ${i + 1}`).not.toEqual(shown);
      expect([...needed].filter((p) => !patterns(plan).has(p)), `regenerate ${i + 1}`).toEqual([]);
      expect(planWork(plan)).toBeGreaterThanOrEqual(0.85 * planWork(planned));
      c = next!;
      shown = ids;
    }
  });

  it("isn't pulled back by the training state, and a movement with few options takes turns", () => {
    // A pull day for someone who moved up from glute bridges and swapped planks for dead bugs, with
    // dumbbells and no bench: only two rows to choose from.
    const pull: Profile = { ...profile, split: "push_pull", minutesPerSession: 20, daysPerWeek: 4 };
    const noBench: Equipment = { ...dumbbells, bench: false, bands: [] };
    let c: Core = newCore(pull, noBench, T0);
    c = { ...c, state: { ...c.state, substitutions: { glute_bridge: "single_leg_glute_bridge", plank: "dead_bug" } } };
    c = { ...c, nextIndex: [0, 1, 2, 3].find((i) => /pull/i.test(todayPlan({ ...c, nextIndex: i }, [], T0).name))! };
    const planned = planExerciseIds(todayPlan(c, [], T0));
    const seen: string[][] = [planned];
    for (let i = 0; i < 5; i++) {
      c = regenerateToday(c, [], T0)!;
      seen.push(planExerciseIds(todayPlan(c, [], T0)));
    }
    // Each tap changes most of the session, not one exercise.
    for (let i = 1; i < seen.length; i++) {
      const fresh = seen[i]!.filter((id) => !seen[i - 1]!.includes(id)).length;
      expect(fresh, `tap ${i}: ${seen[i]!.join(", ")}`).toBeGreaterThanOrEqual(Math.ceil(seen[i]!.length / 2));
    }
    // Every planned exercise gives way at some point, rows included; the single-leg bridge and dead bug don't stick.
    for (const id of planned) expect(seen.slice(1).some((ids) => !ids.includes(id)), id).toBe(true);
    for (const id of ["single_leg_glute_bridge", "dead_bug"]) expect(seen.slice(1).filter((ids) => ids.includes(id)).length, id).toBeLessThan(5);
    // Both rows take turns rather than standing still.
    const rows = seen.slice(1).map((ids) => ids.filter((id) => id === "one_arm_db_row" || id === "db_bent_over_row").join("+"));
    expect(new Set(rows).size).toBeGreaterThan(1);
  });

  it("goes back to the original, and lapses once the session is done", () => {
    const next = regenerateToday(core, [], T0)!;
    expect(planExerciseIds(todayPlan(originalToday(next), [], T0))).toEqual(planExerciseIds(todayPlan(core, [], T0)));
    // Started and finished: the regenerated session is what was trained, and the next one is as planned.
    let active = startSession(next, [], T0, null);
    expect(planExerciseIds(active.plan)).toEqual(planExerciseIds(todayPlan(next, [], T0)));
    for (const ref of setOrder(active.plan)) {
      const p = prescriptionsOf(active.plan).find((x) => x.slot === ref.slot)!;
      active = logSet(active, ref, { loadKg: p.loadKg, reps: p.targetReps, rir: 2 }, next, T0);
    }
    const r = finishSession(active, next, T0 + 3_600_000);
    const history: SessionRecord[] = [r.record];
    expect(isRegenerated(r.core)).toBe(false);
    expect(planExerciseIds(todayPlan(r.core, history, T0 + 2 * 86_400_000))).toEqual(planExerciseIds(todayPlan(originalToday(r.core), history, T0 + 2 * 86_400_000)));
  });

  it("does nothing on a cardio day, and says so when nothing else fits", () => {
    // Three days a week at 30 minutes plans no cardio day, so a cardio one is set up directly.
    const cardioDay = { ...newCore({ ...profile, daysPerWeek: 5 }, dumbbells, T0) };
    for (let i = 0; i < 5; i++) {
      const c = { ...cardioDay, nextIndex: i };
      if (todayPlan(c, [], T0).kind === "cardio") expect(regenerateToday(c, [], T0)).toBeNull();
    }
    // Floor only, and a trained person: very little to choose from, but Regenerate still never repeats the plan on screen.
    const floor: Equipment = { dumbbells: { kind: "none" }, treadmill: false, mat: true, abRoller: false, pullupBar: false, bench: false, bands: [] };
    const bare = newCore(profile, floor, T0);
    const next = regenerateToday(bare, [], T0);
    if (next) expect(planExerciseIds(todayPlan(next, [], T0))).not.toEqual(planExerciseIds(todayPlan(bare, [], T0)));
  });

  it("is saved with the data, and broken values are dropped", () => {
    const next = regenerateToday(core, [], T0)!;
    expect(migrateCore(JSON.parse(JSON.stringify(next)))!.regenerated).toEqual(next.regenerated);
    const broken = migrateCore({ ...JSON.parse(JSON.stringify(next)), regenerated: { index: 0, exclude: ["not_an_exercise", 7] } })!;
    expect(broken.regenerated).toBeUndefined();
  });

  it("works through the store, and not mid-session", () => {
    let s: AppState = { ...INITIAL, ready: true, data: { core, active: null, history: [] } };
    s = reducer(s, { type: "regenerate", now: T0, minutes: null });
    expect(isRegenerated(s.data.core!)).toBe(true);
    s = reducer(s, { type: "originalToday" });
    expect(s.data.core!.regenerated).toBeUndefined();
    s = reducer(s, { type: "start", now: T0, minutes: null });
    expect(reducer(s, { type: "regenerate", now: T0, minutes: null })).toBe(s);
  });
});
