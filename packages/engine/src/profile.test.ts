import { describe, expect, it } from "vitest";
import { applyProfile, bringBack, buildProfile, cautionAreasFor, clearPainChecks, resetWorkingWeight, swapSticks, type FeedbackSession } from "./profile.js";
import { alternativesFor, applyState, initialTrainingState, preferExercise, prescriptionsOf, recordSession, resolveExercise, swapPrescription } from "./state.js";
import type { SessionPlan } from "./types.js";
import { logSession, onTarget, referenceContext, sets } from "./testkit.js";
import { planSessionWith } from "./generate.js";

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 1);
const hurt = (at: number, exerciseId: string, area: string): FeedbackSession => ({
  finishedAt: at,
  kind: "strength",
  sets: [{ exerciseId, painFlag: true, painArea: area }],
});
const fine = (at: number, exerciseId: string): FeedbackSession => ({ finishedAt: at, kind: "strength", sets: [{ exerciseId }] });

describe("the training profile", () => {
  it("turns a painful area into a caution on every exercise that loads it", () => {
    const p = buildProfile(initialTrainingState(), [hurt(T0, "db_overhead_press", "Shoulder")], T0 + DAY);
    expect(p.cautions).toMatchObject([{ area: "Shoulder", injury: "shoulder", reports: 1, active: true }]);
    const plan: SessionPlan = {
      kind: "strength",
      supersets: [{ label: "A", rounds: 3, transitionSec: 20, restSec: 60, estimatedSec: 0, items: [
        { slot: "A.1", exerciseId: "single_arm_db_overhead_press", benchmarkSet: true },
        { slot: "A.2", exerciseId: "goblet_squat", benchmarkSet: true },
      ] }],
      finisher: null,
    } as unknown as SessionPlan;
    const marked = prescriptionsOf(applyProfile(plan, p));
    expect(marked[0]).toMatchObject({ painCheck: true, caution: "Shoulder", benchmarkSet: false });
    expect(marked[1]!.painCheck).toBeUndefined();
  });

  it("lifts a caution after two pain-free sessions that trained the area, or after six weeks", () => {
    const after = (sessions: FeedbackSession[], now: number) => buildProfile(initialTrainingState(), sessions, now).cautions[0]!.active;
    const first = hurt(T0, "db_overhead_press", "Shoulder");
    expect(after([first, fine(T0 + 2 * DAY, "db_overhead_press")], T0 + 3 * DAY)).toBe(true);
    // A session that didn't load the shoulder doesn't count.
    expect(after([first, fine(T0 + 2 * DAY, "goblet_squat"), fine(T0 + 4 * DAY, "db_overhead_press")], T0 + 5 * DAY)).toBe(true);
    expect(after([first, fine(T0 + 2 * DAY, "db_overhead_press"), fine(T0 + 4 * DAY, "machine_shoulder_press")], T0 + 5 * DAY)).toBe(false);
    expect(after([first], T0 + 43 * DAY)).toBe(false);
    // Hurting again starts the count over.
    const again = buildProfile(initialTrainingState(), [first, fine(T0 + 2 * DAY, "db_overhead_press"), hurt(T0 + 4 * DAY, "barbell_overhead_press", "Shoulder")], T0 + 5 * DAY);
    expect(again.cautions[0]).toMatchObject({ reports: 2, painFreeSessions: 0, active: true });
  });

  it("keeps areas no exercise is marked for, without changing the plan", () => {
    const p = buildProfile(initialTrainingState(), [hurt(T0, "db_curl", "Elbow")], T0 + DAY);
    expect(p.cautions).toMatchObject([{ area: "Elbow", injury: null }]);
  });

  it("remembers why exercises were swapped, and makes a repeated reason stick", () => {
    const s = (reason: "hard" | "balance" | "dislike" | "busy", permanent = false): FeedbackSession => ({
      finishedAt: T0, kind: "strength", sets: [], swaps: [{ slot: "A.1", from: "db_bulgarian_split_squat", to: "db_reverse_lunge", reason, permanent }],
    });
    const once = buildProfile(initialTrainingState(), [s("hard")], T0);
    expect(once.preferences.tooHard).toEqual({ db_bulgarian_split_squat: 1 });
    expect(swapSticks(buildProfile(initialTrainingState(), [], T0), "db_bulgarian_split_squat", "hard")).toBe(false);
    expect(swapSticks(once, "db_bulgarian_split_squat", "hard")).toBe(true);
    expect(swapSticks(once, "db_bulgarian_split_squat", "balance")).toBe(false);
    expect(swapSticks(once, "db_bulgarian_split_squat", "busy")).toBe(false);
    expect(buildProfile(initialTrainingState(), [s("dislike", true)], T0).preferences.disliked).toEqual(["db_bulgarian_split_squat"]);
  });
});

describe("cautions in progression", () => {
  it("holds a cautioned exercise steady even at the top of its range, without marking it as hurting", () => {
    const ctx = referenceContext();
    // Week 2, so the first sets aren't benchmarks.
    const plan = planSessionWith(ctx, ctx.template.length);
    const p = prescriptionsOf(plan)[0]!;
    const cautioned: SessionPlan = { ...plan, supersets: plan.supersets.map((ss) => ({ ...ss, items: ss.items.map((x) => (x.slot === p.slot ? { ...x, caution: "Shoulder", painCheck: true, benchmarkSet: false } : x)) })) };
    const top = sets(p.exerciseId, p.loadKg, Array(p.sets).fill(p.repRange[1]), 3);
    const twice = (session: SessionPlan) => {
      const first = recordSession(initialTrainingState(), session, top, ctx);
      return recordSession(first.state, session, top, ctx);
    };
    // Without a caution, two sessions at the top of the range move it on; with one, it holds.
    expect(twice(plan).changes.find((c) => c.slot === p.slot)!.action).not.toBe("hold");
    const held = twice(cautioned);
    const change = held.changes.find((c) => c.slot === p.slot)!;
    expect(change.action).toBe("hold");
    expect(change.next.loadKg).toBe(p.loadKg);
    expect(held.state.exercises[p.exerciseId]!.painCheck).toBe(false);
  });
});

describe("cautions in swaps", () => {
  const ctx = referenceContext();
  const hurtBack = buildProfile(initialTrainingState(), [hurt(T0, "db_rdl", "Lower back")], T0 + DAY);

  it("lists options that spare a painful area first, and marks the swap-in if it loads it", () => {
    const row = prescriptionsOf(planSessionWith(ctx, ctx.template.length)).find((p) => p.pattern === "row")!;
    const alts = alternativesFor(row, ctx, [], undefined, hurtBack);
    const loads = alts.map((e) => e.avoidWith.includes("low_back"));
    // Every option that spares the lower back comes before every one that loads it.
    expect(loads.indexOf(true) === -1 || loads.lastIndexOf(false) < loads.indexOf(true)).toBe(true);
    const swapped = swapPrescription({ ...row, benchmarkSet: true }, "db_bent_over_row", initialTrainingState(), ctx, hurtBack);
    expect(swapped).toMatchObject({ painCheck: true, caution: "Lower back", benchmarkSet: false });
    expect(cautionAreasFor(hurtBack, "db_bent_over_row")).toEqual(["Lower back"]);
  });
});

describe("corrections from the profile screen", () => {
  const first = hurt(T0, "db_overhead_press", "Shoulder");

  it("sets aside pain reported before the user said it's fine, but not pain after", () => {
    const fineNow = { cautionsCleared: { Shoulder: T0 + DAY } };
    expect(buildProfile(initialTrainingState(), [first], T0 + 2 * DAY, fineNow).cautions).toEqual([]);
    const again = buildProfile(initialTrainingState(), [first, hurt(T0 + 3 * DAY, "db_overhead_press", "Shoulder")], T0 + 4 * DAY, fineNow);
    expect(again.cautions).toMatchObject([{ area: "Shoulder", reports: 1, firstReportAt: T0 + 3 * DAY, active: true }]);
    // Other areas are untouched.
    expect(buildProfile(initialTrainingState(), [first, hurt(T0, "goblet_squat", "Knee")], T0 + DAY, fineNow).cautions.map((c) => c.area)).toEqual(["Knee"]);
  });

  it("forgets an exercise's swaps up to when the user asked", () => {
    const swap = (at: number, reason: "hard" | "dislike"): FeedbackSession => ({
      finishedAt: at, kind: "strength", sets: [], swaps: [{ slot: "A.1", from: "db_bulgarian_split_squat", to: "db_reverse_lunge", reason, permanent: reason === "dislike" }],
    });
    const before = buildProfile(initialTrainingState(), [swap(T0, "dislike"), swap(T0, "hard")], T0);
    expect(before.preferences).toMatchObject({ disliked: ["db_bulgarian_split_squat"], tooHard: { db_bulgarian_split_squat: 1 }, swappedFor: { db_bulgarian_split_squat: "db_reverse_lunge" } });
    const forgotten = { forgotten: { db_bulgarian_split_squat: T0 } };
    const after = buildProfile(initialTrainingState(), [swap(T0, "dislike"), swap(T0, "hard")], T0, forgotten);
    expect(after.preferences).toEqual({ disliked: [], tooHard: {}, unstable: {}, swappedFor: {} });
    expect(swapSticks(after, "db_bulgarian_split_squat", "hard")).toBe(false);
    expect(buildProfile(initialTrainingState(), [swap(T0, "hard"), swap(T0 + DAY, "hard")], T0 + DAY, forgotten).preferences.tooHard).toEqual({ db_bulgarian_split_squat: 1 });
  });

  it("brings a disliked exercise back where the swap put the other one", () => {
    const state = preferExercise(initialTrainingState(), "goblet_squat", "db_reverse_lunge");
    expect(resolveExercise(state, "goblet_squat")).toBe("db_reverse_lunge");
    const back = bringBack(state, "goblet_squat", "db_reverse_lunge");
    expect(resolveExercise(back, "goblet_squat")).toBe("goblet_squat");
    // Swapped again since: it still comes back where it was programmed.
    const moved = preferExercise(state, "db_reverse_lunge", "bodyweight_squat");
    expect(resolveExercise(bringBack(moved, "goblet_squat", "db_reverse_lunge"), "goblet_squat")).toBe("goblet_squat");
    // A slot on another ladder that happens to use the same exercise is left alone.
    const other = { ...state, substitutions: { ...state.substitutions, db_floor_press: "db_reverse_lunge" } };
    expect(bringBack(other, "goblet_squat", "db_reverse_lunge").substitutions).toEqual({ db_floor_press: "db_reverse_lunge" });
    expect(bringBack(initialTrainingState(), "goblet_squat", "db_reverse_lunge")).toEqual(initialTrainingState());
  });

  it("re-tests a working weight with a benchmark set next time, until it's set again", () => {
    const ctx = referenceContext();
    let state = initialTrainingState();
    const week1 = applyState(planSessionWith(ctx, 0), state, ctx);
    state = recordSession(state, week1, logSession(week1, (p, i) => (p.benchmarkSet && i === 0 ? { reps: 12, rir: 2 } : onTarget(p))), ctx).state;
    const later = applyState(planSessionWith(ctx, ctx.template.length), state, ctx);
    const target = prescriptionsOf(later).find((p) => p.loadType !== "time" && state.exercises[p.exerciseId]?.calibrated)!;
    expect(target.benchmarkSet).toBe(false);

    const reset = resetWorkingWeight(state, target.exerciseId);
    expect(reset.exercises[target.exerciseId]).toMatchObject({ calibrated: false, loadKg: state.exercises[target.exerciseId]!.loadKg });
    const overrides = { rebenchmark: [target.exerciseId] };
    const profile = buildProfile(reset, [], T0, overrides);
    expect(profile.rebenchmark).toEqual([target.exerciseId]);
    const planned = prescriptionsOf(applyProfile(applyState(planSessionWith(ctx, ctx.template.length), reset, ctx), profile));
    expect(planned.filter((p) => p.benchmarkSet).map((p) => p.exerciseId)).toEqual([target.exerciseId]);
    // Not in a lighter session.
    const deload = applyProfile({ ...applyState(planSessionWith(ctx, ctx.template.length), reset, ctx), deload: true }, profile);
    expect(prescriptionsOf(deload).some((p) => p.benchmarkSet)).toBe(false);

    // The benchmark sets it again, and the re-test is over.
    const retested = applyProfile(applyState(planSessionWith(ctx, ctx.template.length), reset, ctx), profile);
    const after = recordSession(reset, retested, logSession(retested, (p, i) => (p.benchmarkSet && i === 0 ? { reps: 15, rir: 2 } : onTarget(p))), ctx);
    expect(after.changes.find((c) => c.exerciseId === target.exerciseId)!.action).toBe("calibrated");
    expect(buildProfile(after.state, [], T0, overrides).rebenchmark).toEqual([]);
  });

  it("'It's fine now' also ends the check-in on the exercise that hurt", () => {
    const state = { ...initialTrainingState(), exercises: { db_overhead_press: { ...referenceProgress("db_overhead_press"), painCheck: true } } };
    expect(clearPainChecks(state, [first], "Shoulder").exercises["db_overhead_press"]!.painCheck).toBe(false);
    expect(clearPainChecks(state, [first], "Knee")).toBe(state);
  });

  it("keeps what the soreness check-ins said, per muscle group", () => {
    const sore = (at: number, level: "none" | "bit" | "very"): FeedbackSession => ({ finishedAt: at, kind: "strength", sets: [], soreness: [{ group: "quads", level }] });
    const p = buildProfile(initialTrainingState(), [sore(T0, "very"), sore(T0 + DAY, "none"), sore(T0 + 2 * DAY, "bit"), sore(T0 + 3 * DAY, "very")], T0 + 3 * DAY);
    expect(p.soreness).toEqual([{ group: "quads", asked: 4, sore: 3, lastLevel: "very", lastAt: T0 + 3 * DAY, streak: 2 }]);
  });
});

function referenceProgress(exerciseId: string) {
  return { exerciseId, loadKg: 9, repRange: [8, 12] as [number, number], targetRir: 2 as const, targetReps: 8, stalls: 0, e1rmKg: null, bestE1rmKg: null, calibrated: true, timesPerformed: 3 };
}
