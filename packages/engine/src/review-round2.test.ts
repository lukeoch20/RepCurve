/** Regressions for the code-review findings on the shortfall fill (each from a reviewer's reproduction). */
import { getExercise } from "@repcurve/exercises";
import { MACHINES } from "@repcurve/shared";
import type { Equipment, Profile } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { makeContext } from "./context.js";
import { alternateBlock, missingPatterns, planSessionWith, weekLevel } from "./generate.js";
import { volumeCeiling } from "./level.js";
import { referenceEquipment, referenceProfile } from "./testkit.js";
import type { SessionPlan } from "./types.js";
import { MUSCLES, weeklyVolume } from "./volume.js";

const gym = {
  dumbbells: { kind: "adjustable", min: 5, max: 100, step: 5, unit: "lb", pairs: true },
  treadmill: true, mat: true, abRoller: true, pullupBar: true, bench: true, flatBench: true, adjustableBench: true,
  bands: ["light", "medium", "heavy"], bandAnchor: true, jumpRope: true, barbell: true, rack: true, trapBar: true, ezBar: true,
  cables: true, machines: [...MACHINES], bike: true, elliptical: true, rower: true, stairClimber: true,
} as Equipment;
const homeNoBench = { ...referenceEquipment, treadmill: false } as Equipment;

const week = (p: Partial<Profile>, eq: Equipment, w: number, history = {}) => {
  const ctx = makeContext({ ...referenceProfile, ...p }, eq, history);
  const n = ctx.template.length;
  return { ctx, sessions: Array.from({ length: n }, (_, d) => planSessionWith(ctx, (w - 1) * n + d)) };
};

describe("review round 2", () => {
  it("never blames rest settings when the week's ceiling, not the clock, held a session back", () => {
    for (const minutes of [15, 20, 25]) {
      const { sessions } = week({ trainingHistory: "never", goal: "both", daysPerWeek: 6, minutesPerSession: minutes, split: "full_body" }, gym, 2);
      for (const s of sessions) {
        const note = (s.notes ?? []).find((n) => n.includes("leave little room"));
        if (note) expect(s.supersets.length, note).toBe(1);
        // Every day keeps its opening: a full-body day always has a hinge or a squat.
        if (s.kind === "strength") expect(s.supersets.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("returns a fresh plan each call, so a caller's change can't reach later plans", () => {
    const ctx = makeContext(referenceProfile, gym);
    const a = planSessionWith(ctx, 4);
    const sets = a.supersets[0]!.items[0]!.sets;
    a.supersets[0]!.items[0]!.sets = 99;
    a.supersets.pop();
    const b = planSessionWith(ctx, 4);
    expect(b.supersets[0]!.items[0]!.sets).toBe(sets);
    expect(planSessionWith(ctx, 4, { minutes: 45 }).supersets[0]!.items[0]!.sets).toBeLessThanOrEqual(4);
  });

  it("keeps the week within its ceiling when two days run long", () => {
    const ctx = makeContext({ ...referenceProfile, trainingHistory: "never", goal: "both", daysPerWeek: 2, minutesPerSession: 15, split: "full_body" }, gym);
    const n = ctx.template.length;
    const first = planSessionWith(ctx, n, { minutes: 60 });
    const second = planSessionWith(ctx, n + 1, { minutes: 60, weekDone: [first] });
    const v = weeklyVolume([first, second]);
    for (const m of MUSCLES) if (m !== "core") expect(v[m], m).toBeLessThanOrEqual(volumeCeiling(ctx.volumeLevel) + 1e-9);
  });

  it("gives a long day a core finisher even when the usual session is too short for one", () => {
    const ctx = makeContext({ ...referenceProfile, minutesPerSession: 15 }, gym);
    expect(planSessionWith(ctx, 4).finisher).toBeNull();
    expect(planSessionWith(ctx, 4, { minutes: 45 }).finisher).not.toBeNull();
  });

  it("keeps split days to their own muscles when a long day adds pairs, and adds each of the day's pairs once", () => {
    const ctx = makeContext({ ...referenceProfile, trainingHistory: "regular", goal: "strength_muscle", daysPerWeek: 3, minutesPerSession: 45, split: "ppl" }, homeNoBench);
    for (let i = 3; i < 9; i++) {
      const s = planSessionWith(ctx, i, { minutes: 120 });
      if (s.name !== "Pull day") continue;
      const added = s.supersets.slice(3).flatMap((ss) => ss.items);
      // Pull day's own muscles (its third pair is a hinge with rear-delt work): never triceps or calves.
      for (const p of added) expect(getExercise(p.exerciseId).primary.some((m) => ["back", "biceps", "shoulders", "hamstrings", "glutes"].includes(m)), p.exerciseId).toBe(true);
      const extras = new Set(s.supersets.flatMap((ss) => ss.items.map((p) => p.slot.match(/\.extra\d/)?.[0])).filter(Boolean));
      const extraSupersets = s.supersets.filter((ss) => ss.items.some((p) => /\.extra\d/.test(p.slot)));
      expect(extraSupersets.length).toBe(extras.size);
    }
  });

  it("starts alternate exercises only with a block that begins after the promotion", () => {
    // Returning lifter, 2 lifting days: promoted at 16 sessions, which lands in week 9 (mid-block).
    const p: Partial<Profile> = { trainingHistory: "lapsed", goal: "strength_muscle", daysPerWeek: 2, minutesPerSession: 30 };
    // Two lifting days a week and no cardio: position 2k is the start of week k+1.
    const at = (logged: number, position: number) => makeContext({ ...referenceProfile, ...p }, homeNoBench, { strengthSessionsLogged: logged, position });
    expect(alternateBlock(at(16, 16), 9)).toBe(false);
    expect(alternateBlock(at(16, 16), 10)).toBe(false);
    // The next odd block (weeks 19-24) alternates.
    expect(alternateBlock(at(16, 16), 19)).toBe(true);
    // A promotion mid-week takes effect from the next week: one session into week 9 with 16 logged,
    // week 9 began with 15 (novice), and week 10 begins with 17.
    expect(weekLevel(at(16, 17), 9)).toBe("novice");
    expect(weekLevel(at(16, 17), 10)).toBe("intermediate");
  });

  it("keeps every main movement in a promoted novice's week", () => {
    const { sessions } = week({ trainingHistory: "never", goal: "both", daysPerWeek: 4, minutesPerSession: 30, split: "full_body" }, gym, 13, { strengthSessionsLogged: 60 });
    expect(missingPatterns(sessions as SessionPlan[])).toEqual([]);
  });

  it("runs push/pull and upper/lower full body with one lifting day", () => {
    for (const split of ["push_pull", "upper_lower"] as const) {
      const { ctx, sessions } = week({ trainingHistory: "regular", goal: "fitness", daysPerWeek: 2, split }, homeNoBench, 2);
      expect(ctx.split).toBe("full_body");
      expect(sessions.filter((s) => s.kind === "strength").map((s) => s.variant)).toEqual(["A"]);
    }
  });
});
