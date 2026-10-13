/** Changing today's time: fewer minutes drop work, more minutes add exercises, the usual session never changes. */
import type { TrainingHistory } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { planSessionWith } from "./generate.js";
import { prescriptionsOf } from "./state.js";
import { referenceContext, referenceEquipment } from "./testkit.js";
import type { SessionPlan } from "./types.js";

const LEVELS: TrainingHistory[] = ["never", "a_little", "lapsed", "regular"];
const BUDGETS = [10, 15, 20, 25, 30, 35, 40];
const exercises = (s: SessionPlan) => prescriptionsOf(s).length;
const extraSupersets = (s: SessionPlan) => s.supersets.filter((ss) => ss.items.some((p) => p.slot.includes(".extra")));

/** Rounds a pair can grow to, by level (as in buildStrengthSession). */
const maxRoundsFor = (history: TrainingHistory) => (referenceContext({ profile: { trainingHistory: history } }).level === "novice" ? 3 : 4);

/** The strength sessions of a steady week (week 2) for one level, with the app's default rest and switch. */
function steadySessions(history: TrainingHistory, minutes: number, equipment = referenceEquipment): SessionPlan[] {
  const ctx = referenceContext({ profile: { trainingHistory: history, daysPerWeek: 3 }, equipment });
  const days = ctx.template.length;
  const out: SessionPlan[] = [];
  for (let i = days; i < days * 2; i++) {
    const s = planSessionWith(ctx, i, { minutes, restSec: 60, transitionSec: 20 });
    if (s.kind === "strength") out.push(s);
  }
  return out;
}

describe("today's time from 10 to 40 minutes", () => {
  it("never plans more than the time chosen", () => {
    for (const level of LEVELS) for (const m of BUDGETS) for (const s of steadySessions(level, m)) expect(s.estimatedMinutes).toBeLessThanOrEqual(m);
  });

  it("adds exercises, never removes them, as the time goes up", () => {
    for (const level of LEVELS) {
      const counts = BUDGETS.map((m) => steadySessions(level, m).map(exercises));
      for (let b = 1; b < BUDGETS.length; b++) {
        counts[b]!.forEach((n, i) => expect(n).toBeGreaterThanOrEqual(counts[b - 1]![i]!));
      }
      // A long day is a bigger session, not the usual one with time left over.
      const at25 = counts[BUDGETS.indexOf(25)]!;
      counts[BUDGETS.indexOf(40)]!.forEach((n, i) => expect(n).toBeGreaterThan(at25[i]!));
    }
  });

  it("uses most of a long day, unless the week's volume ceiling stops it, and then says so", () => {
    for (const level of LEVELS) {
      for (const s of steadySessions(level, 40)) {
        if (s.estimatedMinutes >= 32) continue;
        expect(s.notes?.join(" ")).toMatch(/on purpose/);
      }
    }
  });

  it("adds extra exercises only once the usual pairs are at their most rounds", () => {
    for (const level of LEVELS) {
      const maxRounds = maxRoundsFor(level);
      for (const m of BUDGETS) {
        for (const s of steadySessions(level, m)) {
          const extra = extraSupersets(s);
          if (extra.length === 0) continue;
          const usual = s.supersets.filter((x) => !extra.includes(x));
          expect(usual.length).toBe(3);
          // At most one round was given up to make room for the extra exercises.
          for (const ss of usual) expect(ss.rounds).toBeGreaterThanOrEqual(maxRounds - 1);
          expect(usual.filter((ss) => ss.rounds < maxRounds).length).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("leaves sessions of 25 minutes or less as they were: no extra exercises", () => {
    for (const level of LEVELS) for (const m of [10, 15, 20, 25]) for (const s of steadySessions(level, m)) expect(extraSupersets(s)).toEqual([]);
  });

  it("keeps every exercise once per session, with distinct slots", () => {
    for (const level of LEVELS) {
      for (const s of steadySessions(level, 40)) {
        const ps = prescriptionsOf(s);
        expect(new Set(ps.map((p) => p.exerciseId)).size).toBe(ps.length);
        expect(new Set(ps.map((p) => p.slot)).size).toBe(ps.length);
      }
    }
  });

  it("without dumbbells, a long day adds what it can within the time and the week's ceiling", () => {
    const bodyweight = { ...referenceEquipment, dumbbells: { kind: "none" as const } };
    const at25 = steadySessions("a_little", 25, bodyweight);
    steadySessions("a_little", 40, bodyweight).forEach((s, i) => {
      expect(s.estimatedMinutes).toBeLessThanOrEqual(40);
      expect(exercises(s)).toBeGreaterThanOrEqual(exercises(at25[i]!));
    });
  });
});
