import { describe, expect, it } from "vitest";
import { makeContext } from "./context.js";
import { loadFixtures } from "./fixtures.js";
import { simulateTraining } from "./simulate.js";

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
    for (const s of sessions) expect(s.estimatedMinutes, s.id).toBeLessThanOrEqual(s.budgetMinutes + 0.01);
  });

  it("progresses a steadily improving lifter without bouncing back down", () => {
    const ups = acted.filter((c) => ["load_up", "ladder_up", "widen_range"].includes(c.action)).length;
    const downs = acted.filter((c) => ["load_down", "ladder_down"].includes(c.action)).length;
    expect(ups).toBeGreaterThanOrEqual(3);
    expect(downs).toBeLessThanOrEqual(Math.ceil(acted.length * 0.1));
  });

  it("never substitutes an exercise for itself", () => {
    for (const [from, to] of Object.entries(state.substitutions)) expect(to).not.toBe(from);
  });
});
