import { prescriptionsOf, resolveExercise } from "@repcurve/engine";
import type { Equipment, Profile } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { whatRepCurveKnows } from "./knows";
import { migrateData } from "./migrate";
import { newCore, todayPlan } from "./plan";
import { cautionFine, forgetSwaps, profileFor, retest, settleRetests } from "./profile";
import { finishSession, logSet, setOrder, startSession, swapExercise } from "./session";
import type { ActiveSession, Core, SessionRecord } from "./types";

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

/**
 * A first session: the first exercise swapped out for good ("don't like it"), the overhead-loading
 * exercise flagged as hurting the shoulder, everything else done as planned.
 */
function firstSession(): { core: Core; history: SessionRecord[]; disliked: string; swappedIn: string } {
  const core = newCore(profile, equipment, T0);
  let active: ActiveSession = startSession(core, [], T0, null);
  const first = prescriptionsOf(active.plan)[0]!;
  const swappedIn = "db_reverse_lunge";
  const swapped = swapExercise(active, core, first.slot, swappedIn, true, "dislike");
  active = swapped.active;
  for (const ref of setOrder(active.plan)) {
    const p = prescriptionsOf(active.plan).find((x) => x.slot === ref.slot)!;
    const hurts = p.pattern === "horizontal_push" && ref.setIndex === 0;
    active = logSet(active, ref, { loadKg: p.loadKg, reps: p.targetReps, rir: 2, ...(hurts ? { painFlag: true } : {}) }, swapped.core, T0);
    if (hurts) active = { ...active, sets: active.sets.map((s) => (s.painFlag ? { ...s, painArea: "Shoulder" } : s)) };
  }
  const r = finishSession(active, swapped.core, T0 + 3_600_000);
  return { core: r.core, history: [r.record], disliked: first.exerciseId, swappedIn };
}

describe("what RepCurve knows", () => {
  const { core, history, disliked, swappedIn } = firstSession();
  const now = T0 + DAY;

  it("shows level, weekly sets, cautions, swaps and working weights in plain words", () => {
    const k = whatRepCurveKnows(core, history, now);
    expect(k.level).toMatchObject({ started: "Beginner", volume: "Beginner", target: [8, 10], next: { level: "Intermediate", sessions: 59 } });
    expect(k.weeklySets.find((m) => m.muscle === "quads")!.sets).toBeGreaterThan(0);
    expect(k.cautions).toHaveLength(1);
    expect(k.cautions[0]).toMatchObject({ area: "Shoulder" });
    expect(k.cautions[0]!.lifts).toBe("Lifts after 2 pain-free sessions or 6 weeks. Pain-free so far: 0 of 2.");
    expect(k.swaps).toEqual([expect.objectContaining({ exerciseId: disliked, action: "Bring it back" })]);
    expect(k.swaps[0]!.what).toMatch(/You don't like it\. Swapped for .+ from now on\./);
    expect(k.weights.length).toBeGreaterThan(0);
    expect(k.weights.every((w) => w.now.includes("range"))).toBe(true);
    expect(k.weights.some((w) => w.trend === "Set by a benchmark")).toBe(true);
  });

  it("'It's fine now' lifts the caution and stays lifted, until pain is flagged again", () => {
    expect(Object.values(core.state.exercises).some((p) => p.painCheck)).toBe(true);
    const fixed = cautionFine(core, history, "Shoulder", now);
    expect(whatRepCurveKnows(fixed, history, now).cautions).toEqual([]);
    expect(prescriptionsOf(todayPlan(fixed, history, now)).some((p) => p.caution)).toBe(false);
    expect(Object.values(fixed.state.exercises).some((p) => p.painCheck)).toBe(false);
    // It survives a save and reload.
    const loaded = migrateData(JSON.parse(JSON.stringify({ core: fixed, active: null, history })));
    expect(profileFor(loaded.core!, loaded.history, now).cautions).toEqual([]);
  });

  it("'Bring it back' puts the disliked exercise back in the plan and forgets the dislike", () => {
    expect(resolveExercise(core.state, disliked)).toBe(swappedIn);
    const back = forgetSwaps(core, history, disliked, now);
    expect(resolveExercise(back.state, disliked)).toBe(disliked);
    expect(whatRepCurveKnows(back, history, now).swaps).toEqual([]);
    expect(profileFor(back, history, now).preferences.disliked).toEqual([]);
  });

  it("'Re-test' gives the exercise a test set next time it comes up", () => {
    const k = whatRepCurveKnows(core, history, now);
    const w = k.weights.find((x) => x.canRetest)!;
    const re = retest(core, w.exerciseId);
    expect(whatRepCurveKnows(re, history, now).weights.find((x) => x.exerciseId === w.exerciseId)).toMatchObject({ retesting: true, canRetest: false, trend: "Re-testing next time" });
    let found = false;
    for (let i = re.nextIndex; i < re.nextIndex + 8 && !found; i++) {
      const p = prescriptionsOf(todayPlan({ ...re, nextIndex: i }, history, now)).find((x) => x.exerciseId === w.exerciseId);
      if (p) {
        expect(p.benchmarkSet).toBe(true);
        found = true;
      }
    }
    expect(found).toBe(true);
    // Once the weight is set again, the re-test is dropped from the corrections.
    const done = { ...re, state: { ...re.state, exercises: { ...re.state.exercises, [w.exerciseId]: { ...re.state.exercises[w.exerciseId]!, calibrated: true } } } };
    expect(settleRetests(done).profileOverrides!.rebenchmark).toEqual([]);
    expect(settleRetests(re)).toBe(re);
  });

  it("keeps corrections it can read, and fields it doesn't know", () => {
    const raw = JSON.parse(JSON.stringify({ core: { ...core, profileOverrides: { cautionsCleared: { Shoulder: now, Knee: "soon" }, rebenchmark: ["goblet_squat", 4], futureThing: { a: 1 } } }, active: null, history }));
    expect(migrateData(raw).core!.profileOverrides).toEqual({ cautionsCleared: { Shoulder: now }, rebenchmark: ["goblet_squat"], futureThing: { a: 1 } });
    const junk = JSON.parse(JSON.stringify({ core: { ...core, profileOverrides: "nope" }, active: null, history }));
    expect("profileOverrides" in migrateData(junk).core!).toBe(false);
  });
});
