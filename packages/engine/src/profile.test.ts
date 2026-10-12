import { describe, expect, it } from "vitest";
import { applyProfile, buildProfile, swapSticks, type FeedbackSession } from "./profile.js";
import { initialTrainingState, prescriptionsOf, recordSession } from "./state.js";
import type { SessionPlan } from "./types.js";
import { referenceContext, sets } from "./testkit.js";
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
