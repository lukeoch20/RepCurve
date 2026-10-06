import { describe, expect, it } from "vitest";
import { makeContext } from "./context.js";
import { loadFixtures } from "./fixtures.js";
import { simulateTraining } from "./simulate.js";
import { BUDGET_TOLERANCE } from "./state.js";
import { hardSets } from "./volume.js";

describe.each(loadFixtures())("16 simulated weeks: $name", (fx) => {
  const ctx = makeContext(fx.profile, fx.equipment);
  const { state, changes, sessions: simulated } = simulateTraining(ctx, 16);
  const sessions = simulated.map((x) => x.plan);
  const acted = changes.filter((c) => c.action !== "skipped");

  it("keeps every load on a dumbbell the user owns", () => {
    for (const p of Object.values(state.exercises)) {
      if (p.loadKg === null) continue;
      expect(ctx.ownedLoadsKg.some((w) => Math.abs(w - p.loadKg!) < 1e-6), `${p.exerciseId} ${p.loadKg}`).toBe(true);
    }
  });

  it("keeps rep targets inside their ranges", () => {
    for (const p of Object.values(state.exercises)) {
      expect(p.targetReps, p.exerciseId).toBeGreaterThanOrEqual(p.repRange[0]);
      expect(p.targetReps, p.exerciseId).toBeLessThanOrEqual(p.repRange[1]);
    }
  });

  it("fits every session in its time budget", () => {
    for (const s of sessions) expect(s.estimatedMinutes, s.id).toBeLessThanOrEqual(s.budgetMinutes * (1 + BUDGET_TOLERANCE) + 0.05);
  });

  it("progresses a steadily improving lifter without bouncing back down", () => {
    const ups = acted.filter((c) => ["load_up", "ladder_up", "widen_range"].includes(c.action)).length;
    const downs = acted.filter((c) => ["load_down", "ladder_down"].includes(c.action)).length;
    expect(ups).toBeGreaterThanOrEqual(3);
    expect(downs).toBeLessThanOrEqual(Math.ceil(acted.length * 0.1));
  });

  it("never puts the same exercise in two slots of one session", () => {
    for (const s of sessions) {
      const ids = [...s.supersets.flatMap((ss) => ss.items.map((p) => p.exerciseId)), ...(s.finisher ? [s.finisher.exerciseId] : [])];
      expect(new Set(ids).size, s.id).toBe(ids.length);
    }
  });

  it("keeps weekly hard sets and movement patterns while the lifter improves", () => {
    const weeks = new Map<number, { sets: number; patterns: Set<string> }>();
    for (const s of sessions) {
      if (s.kind !== "strength" || s.deload || s.comeback) continue;
      const w = weeks.get(s.week) ?? { sets: 0, patterns: new Set<string>() };
      w.sets += hardSets(s);
      for (const ss of s.supersets) for (const p of ss.items) w.patterns.add(p.pattern);
      weeks.set(s.week, w);
    }
    // Harder one-sided variants take twice as long per set, which costs some sets in a fixed
    // budget; the fitter must absorb that without dropping pairs or a third of the volume.
    const base = weeks.get(2)!;
    for (const [week, w] of weeks) {
      if (week < 2) continue;
      expect(w.sets, `week ${week}`).toBeGreaterThanOrEqual(Math.floor(base.sets * 0.65));
      expect(w.patterns.size, `week ${week}`).toBeGreaterThanOrEqual(base.patterns.size);
    }
  });

  it("never substitutes an exercise for itself", () => {
    for (const [from, to] of Object.entries(state.substitutions)) expect(to).not.toBe(from);
  });
});
