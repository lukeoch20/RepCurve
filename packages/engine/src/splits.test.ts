import type { Pattern, Split } from "@repcurve/shared";
import { getExercise } from "@repcurve/exercises";
import { describe, expect, it } from "vitest";
import { planSessionWith } from "./generate.js";
import { prescriptionsOf } from "./state.js";
import { referenceContext, referenceEquipment } from "./testkit.js";
import type { SessionPlan } from "./types.js";

const SPLITS: Split[] = ["push_pull", "upper_lower", "ppl"];
const bodyweight = { ...referenceEquipment, dumbbells: { kind: "none" as const } };

function strengthSessions(split: Split, opts: { days?: number; weeks?: number; minutes?: number; equipment?: typeof referenceEquipment } = {}): SessionPlan[] {
  const ctx = referenceContext({ profile: { split, daysPerWeek: opts.days ?? 4 }, equipment: opts.equipment ?? referenceEquipment });
  const out: SessionPlan[] = [];
  for (let i = 0; i < ctx.template.length * (opts.weeks ?? 4); i++) {
    const s = planSessionWith(ctx, i, { restSec: 60, transitionSec: 20, ...(opts.minutes ? { minutes: opts.minutes } : {}) });
    if (s.kind === "strength") out.push(s);
  }
  return out;
}
const patterns = (s: SessionPlan): Pattern[] => s.supersets.flatMap((ss) => ss.items.map((p) => p.pattern));
const muscles = (s: SessionPlan) => s.supersets.flatMap((ss) => ss.items.flatMap((p) => getExercise(p.exerciseId).primary));

describe("training splits", () => {
  it("name their days and rotate through them evenly across weeks", () => {
    const names = (split: Split, days: number) => strengthSessions(split, { days, weeks: 6 }).map((s) => s.name);
    for (const days of [2, 3, 4, 5]) {
      const pp = names("push_pull", days);
      expect(new Set(pp)).toEqual(new Set(["Push day", "Pull day"]));
      const count = (n: string) => pp.filter((x) => x === n).length;
      expect(Math.abs(count("Push day") - count("Pull day"))).toBeLessThanOrEqual(1);
      // Never the same day twice in a row.
      for (let i = 1; i < pp.length; i++) expect(pp[i]).not.toBe(pp[i - 1]);
    }
    expect(new Set(names("upper_lower", 4))).toEqual(new Set(["Upper body", "Lower body"]));
    expect(names("ppl", 4).slice(0, 3)).toEqual(["Push day", "Pull day", "Leg day"]);
  });

  it("keep push days to pushing (plus one squat pair) and pull days to pulling (plus one hinge pair)", () => {
    for (const minutes of [20, 30, 40]) {
      for (const s of strengthSessions("push_pull", { minutes })) {
        const ps = patterns(s);
        if (s.name === "Push day") {
          expect(ps.filter((p) => p === "row" || p === "vertical_pull" || p === "hinge")).toEqual([]);
          expect(muscles(s)).not.toContain("biceps");
        } else {
          expect(ps.filter((p) => p === "horizontal_push" || p === "vertical_push" || p === "squat")).toEqual([]);
          expect(muscles(s)).not.toContain("triceps");
        }
        // Mostly upper body: legs are at most one exercise in each of the first two pairs' worth.
        const legs = ps.filter((p) => p === "squat" || p === "hinge").length;
        expect(legs).toBeLessThanOrEqual(Math.ceil(ps.length / 3));
      }
    }
  });

  it("keep upper days upper and leg days legs", () => {
    for (const s of strengthSessions("upper_lower", { minutes: 30 })) {
      const ps = patterns(s);
      if (s.name === "Upper body") expect(ps.some((p) => p === "squat" || p === "hinge")).toBe(false);
      else expect(ps.every((p) => p === "squat" || p === "hinge" || p === "isolation")).toBe(true);
    }
    for (const s of strengthSessions("ppl", { minutes: 30 })) {
      if (s.name === "Leg day") expect(muscles(s).some((m) => ["chest", "back", "biceps", "triceps"].includes(m))).toBe(false);
      if (s.name === "Push day") expect(muscles(s).some((m) => ["back", "biceps", "quads", "hamstrings"].includes(m))).toBe(false);
    }
  });

  it("fit the time, with each exercise once and every slot named once", () => {
    for (const split of SPLITS) {
      for (const equipment of [referenceEquipment, bodyweight]) {
        for (const minutes of [10, 15, 20, 25, 30, 40]) {
          for (const s of strengthSessions(split, { minutes, weeks: 2, equipment })) {
            expect(s.estimatedMinutes).toBeLessThanOrEqual(minutes);
            const ps = prescriptionsOf(s);
            expect(new Set(ps.map((p) => p.exerciseId)).size).toBe(ps.length);
            expect(new Set(ps.map((p) => p.slot)).size).toBe(ps.length);
          }
        }
      }
    }
  });

  it("give a real session even with bodyweight only", () => {
    for (const split of SPLITS) {
      for (const s of strengthSessions(split, { minutes: 20, weeks: 2, equipment: bodyweight })) {
        expect(s.supersets.length, `${split} ${s.name}`).toBeGreaterThanOrEqual(2);
        for (const ss of s.supersets) expect(ss.items.length, `${split} ${s.name}`).toBe(2);
      }
    }
  });

  it("benchmark each day type the first time it comes round", () => {
    for (const split of SPLITS) {
      const sessions = strengthSessions(split, { days: 3, weeks: 3 });
      const firstSeen = new Set<string>();
      for (const s of sessions) {
        const bench = s.supersets.some((ss) => ss.items.some((p) => p.benchmarkSet));
        expect(bench, `${split} ${s.name} #${s.index}`).toBe(!firstSeen.has(s.name));
        firstSeen.add(s.name);
      }
    }
  });

  it("leave full body as it was when no split is set", () => {
    const ctx = referenceContext({ profile: { daysPerWeek: 3 } });
    const names = ctx.template.map((_, i) => planSessionWith(ctx, i)).filter((s) => s.kind === "strength").map((s) => s.name);
    expect(names.every((n) => n.startsWith("Full body"))).toBe(true);
  });
});
