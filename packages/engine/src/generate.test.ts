import { getExercise } from "@repcurve/exercises";
import { availableDumbbellLoadsKg, canLoad, meetsRequirements } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { loadFixtures } from "./fixtures.js";
import { generateProgram, planSession } from "./generate.js";
import { hardSets } from "./volume.js";

const fixtures = loadFixtures();

describe.each(fixtures)("program for $name", (fx) => {
  const program = generateProgram({ profile: fx.profile, equipment: fx.equipment }, { weeks: 4, createdAt: "test" });

  it("has the right number of sessions", () => {
    expect(program.template).toHaveLength(fx.profile.daysPerWeek);
    expect(program.sessions).toHaveLength(fx.profile.daysPerWeek * 4);
  });

  it("every session fits its time budget", () => {
    for (const s of program.sessions) {
      expect(s.estimatedMinutes, s.id).toBeLessThanOrEqual(s.budgetMinutes + 0.01);
    }
  });

  it("every strength session has at least one superset", () => {
    for (const s of program.sessions.filter((x) => x.kind === "strength")) {
      expect(s.supersets.length, s.id).toBeGreaterThan(0);
    }
  });

  it("uses only exercises the equipment and injuries allow", () => {
    for (const s of program.sessions) {
      const items = [...s.supersets.flatMap((ss) => ss.items), ...(s.finisher ? [s.finisher] : [])];
      for (const p of items) {
        const e = getExercise(p.exerciseId);
        expect(meetsRequirements(e.requires, fx.equipment), `${s.id} ${e.id}`).toBe(true);
        expect(canLoad(e.loadType, fx.equipment), `${s.id} ${e.id}`).toBe(true);
        for (const inj of fx.profile.injuries) expect(e.avoidWith, `${s.id} ${e.id}`).not.toContain(inj);
      }
    }
  });

  it("every dumbbell load is one the user owns", () => {
    const owned = availableDumbbellLoadsKg(fx.equipment.dumbbells);
    for (const s of program.sessions) {
      for (const p of s.supersets.flatMap((ss) => ss.items)) {
        if (p.loadKg === null) continue;
        expect(owned.some((w) => Math.abs(w - p.loadKg!) < 1e-6), `${s.id} ${p.exerciseId} ${p.loadKg}`).toBe(true);
      }
    }
  });

  it("never repeats an exercise within a session", () => {
    for (const s of program.sessions) {
      const ids = [...s.supersets.flatMap((ss) => ss.items.map((p) => p.exerciseId)), ...(s.finisher ? [s.finisher.exerciseId] : [])];
      expect(new Set(ids).size, s.id).toBe(ids.length);
    }
  });

  it("covers squat, hinge, push and row across a week of strength work", () => {
    const week = program.sessions.filter((s) => s.week === 2 && s.kind === "strength");
    const patterns = new Set(week.flatMap((s) => s.supersets.flatMap((ss) => ss.items.map((p) => p.pattern))));
    expect(patterns).toContain("squat");
    expect(patterns).toContain("hinge");
    expect(patterns).toContain("row");
    expect([...patterns].some((p) => p === "horizontal_push" || p === "vertical_push")).toBe(true);
  });

  it("cardio sessions sum to the budget", () => {
    for (const s of program.sessions.filter((x) => x.kind === "cardio")) {
      const total = s.cardio!.segments.reduce((n, seg) => n + seg.minutes, 0);
      expect(total, s.id).toBe(s.budgetMinutes);
    }
  });

  it("week 1 flags benchmark sets on loaded exercises for novices", () => {
    if (program.level !== "novice") return;
    const w1 = program.sessions.filter((s) => s.week === 1 && s.kind === "strength");
    const loaded = w1.flatMap((s) => s.supersets.flatMap((ss) => ss.items)).filter((p) => p.loadKg !== null);
    for (const p of loaded) expect(p.benchmarkSet, p.exerciseId).toBe(true);
    const w2 = program.sessions.filter((s) => s.week === 2);
    for (const p of w2.flatMap((s) => s.supersets.flatMap((ss) => ss.items))) expect(p.benchmarkSet).toBe(false);
  });
});

describe("user rest settings", () => {
  const fx = fixtures.find((f) => f.name === "reference")!;
  it("fits fewer rounds when the user rests longer, and stays in budget", () => {
    const quick = planSession({ profile: fx.profile, equipment: fx.equipment }, 4, { restSec: 45, transitionSec: 15 });
    const slow = planSession({ profile: fx.profile, equipment: fx.equipment }, 4, { restSec: 120, transitionSec: 30 });
    const rounds = (s: typeof quick) => s.supersets.reduce((n, ss) => n + ss.rounds, 0);
    expect(rounds(slow)).toBeLessThan(rounds(quick));
    expect(slow.estimatedMinutes).toBeLessThanOrEqual(slow.budgetMinutes);
    expect(slow.supersets[0]!.restSec).toBe(120);
    expect(slow.supersets[0]!.transitionSec).toBe(30);
  });
});

describe("history-aware starting rungs", () => {
  it("starts a lapsed lifter one rung up the push-up ladder", () => {
    const fx = fixtures.find((f) => f.name === "knee_pain_3day")!;
    const program = generateProgram({ profile: fx.profile, equipment: fx.equipment }, { weeks: 1, createdAt: "test" });
    const ids = program.sessions.flatMap((s) => s.supersets.flatMap((ss) => ss.items.map((p) => p.exerciseId)));
    expect(ids).toContain("knee_push_up");
    expect(ids).not.toContain("incline_push_up");
  });

  it("starts a regular lifter on full push-ups", () => {
    const fx = fixtures.find((f) => f.name === "regular_6day")!;
    const program = generateProgram({ profile: fx.profile, equipment: fx.equipment }, { weeks: 1, createdAt: "test" });
    const ids = program.sessions.flatMap((s) => s.supersets.flatMap((ss) => ss.items.map((p) => p.exerciseId)));
    expect(ids).not.toContain("knee_push_up");
    expect(ids).not.toContain("incline_push_up");
  });
});

describe("reference persona specifics", () => {
  const fx = fixtures.find((f) => f.name === "reference")!;
  const program = generateProgram({ profile: fx.profile, equipment: fx.equipment }, { weeks: 4, createdAt: "test" });

  it("gets three strength days and one treadmill day", () => {
    expect(program.template.filter((k) => k === "strength")).toHaveLength(3);
    expect(program.template.filter((k) => k === "cardio")).toHaveLength(1);
  });

  it("fits two supersets of three rounds plus a finisher in 20 minutes from week 2", () => {
    const s = program.sessions.find((x) => x.week === 2 && x.kind === "strength")!;
    expect(s.supersets.length).toBeGreaterThanOrEqual(2);
    expect(s.supersets[0]!.rounds).toBe(3);
    expect(s.finisher).not.toBeNull();
    expect(hardSets(s)).toBeGreaterThanOrEqual(12);
  });

  it("ramps week 1 with one fewer round but the same exercises for a brand-new lifter", () => {
    const w1 = program.sessions.find((x) => x.week === 1 && x.kind === "strength")!;
    const w2 = program.sessions.find((x) => x.week === 2 && x.kind === "strength")!;
    expect(w1.supersets[0]!.rounds).toBeLessThan(w2.supersets[0]!.rounds);
    expect(w1.supersets.map((ss) => ss.items.map((p) => p.exerciseId))).toEqual(
      w2.supersets.map((ss) => ss.items.map((p) => p.exerciseId)),
    );
  });

  it("gets chest into the useful range by pairing a floor press on day 2", () => {
    expect(program.weeklyVolume.chest).toBeGreaterThanOrEqual(8);
  });

  it("lands major muscles in the useful range for a novice", () => {
    for (const m of ["quads", "glutes", "chest", "back"] as const) {
      expect(program.weeklyVolume[m], m).toBeGreaterThanOrEqual(6);
    }
  });

  it("uses the ab roller in the finisher on at least one day", () => {
    const finishers = program.sessions.filter((s) => s.week === 2).map((s) => s.finisher?.exerciseId);
    expect(finishers).toContain("kneeling_ab_rollout");
  });

  it("derives loads from a benchmark e1RM when one is known", () => {
    const withBench = generateProgram(
      { profile: fx.profile, equipment: fx.equipment },
      { weeks: 1, createdAt: "test", e1rmByExercise: { goblet_squat: 30 } },
    );
    const s = withBench.sessions.find((x) => x.kind === "strength")!;
    const goblet = s.supersets.flatMap((ss) => ss.items).find((p) => p.exerciseId === "goblet_squat")!;
    expect(goblet.benchmarkSet).toBe(false);
    expect(goblet.loadKg).toBeGreaterThan(0);
  });
});
