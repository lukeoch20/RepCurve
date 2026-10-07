import { describe, expect, it } from "vitest";
import { generateProgram } from "./generate.js";
import { HORIZONS, leanBodyMassKg, personalFactor, project, typicalStrengthPct, type LiftObservation, type ProjectionInput } from "./projection.js";
import { referenceEquipment, referenceProfile } from "./testkit.js";

const program = generateProgram({ profile: referenceProfile, equipment: referenceEquipment }, { weeks: 2, createdAt: "t" });
const base: ProjectionInput = {
  profile: referenceProfile,
  weeklyVolume: program.weeklyVolume,
  template: program.template,
  cardioMinutesPerWeek: 20,
};

describe("projection", () => {
  const p = project(base);

  it("covers every horizon with ordered, growing bands", () => {
    expect(p.points.map((x) => x.week)).toEqual(HORIZONS);
    for (const pt of p.points) {
      expect(pt.strengthPct.low).toBeLessThanOrEqual(pt.strengthPct.mid);
      expect(pt.strengthPct.mid).toBeLessThanOrEqual(pt.strengthPct.high);
    }
    const mids = p.points.map((x) => x.strengthPct.mid);
    expect([...mids].sort((a, b) => a - b)).toEqual(mids);
  });

  it("lands the reference user near the published 12-week anchors", () => {
    const w12 = p.points.find((x) => x.week === 12)!;
    expect(w12.strengthPct.mid).toBeGreaterThanOrEqual(15);
    expect(w12.strengthPct.mid).toBeLessThanOrEqual(25);
    expect(w12.leanMassKg!.mid).toBeGreaterThan(0.8);
    expect(w12.leanMassKg!.mid).toBeLessThan(2);
    expect(w12.cardioPct.mid).toBe(5);
  });

  it("holds back lean mass until it's measurable", () => {
    expect(p.points.find((x) => x.week === 4)!.leanMassKg).toBeNull();
  });

  it("gives more for more training and less for skipped sessions", () => {
    const doubled = Object.fromEntries(Object.entries(base.weeklyVolume).map(([k, v]) => [k, v * 2])) as ProjectionInput["weeklyVolume"];
    const more = project({ ...base, weeklyVolume: doubled }).points.find((x) => x.week === 12)!;
    const less = project({ ...base, adherence: 0.5 }).points.find((x) => x.week === 12)!;
    const w12 = p.points.find((x) => x.week === 12)!;
    expect(more.strengthPct.mid).toBeGreaterThan(w12.strengthPct.mid);
    expect(more.leanMassKg!.mid).toBeGreaterThan(w12.leanMassKg!.mid);
    expect(less.strengthPct.mid).toBeLessThan(w12.strengthPct.mid);
  });

  it("expects slower gains for regular lifters", () => {
    const trained = project({ ...base, profile: { ...referenceProfile, trainingHistory: "regular" } });
    expect(trained.points[2]!.strengthPct.mid).toBeLessThan(p.points[2]!.strengthPct.mid);
  });

  it("writes a plain headline with the user's numbers", () => {
    expect(p.headline).toMatch(/^For a newer lifter, male, 33, training 4 × 20 min a week \(80 min\): at week 12/);
  });

  it("estimates lean body mass sensibly", () => {
    expect(leanBodyMassKg(referenceProfile)).toBeGreaterThan(55);
    expect(leanBodyMassKg(referenceProfile)).toBeLessThan(70);
    expect(leanBodyMassKg({ sex: "female", bodyweightKg: 62, heightCm: 165 })).toBeGreaterThan(40);
  });
});

describe("personal recalibration", () => {
  const lifts = (gainPerWeek: number) =>
    [0, 1, 2, 4, 6, 8, 10].flatMap((week) => [
      { exerciseId: "goblet_squat", week, e1rmKg: 20 * (1 + gainPerWeek * week) },
      { exerciseId: "db_rdl", week, e1rmKg: 30 * (1 + gainPerWeek * week) },
    ]);

  it("needs a few weeks of data", () => {
    expect(personalFactor(lifts(0.02).filter((l) => l.week <= 1), typicalStrengthPct)).toBeNull();
  });

  it("nudges the curve up for fast responders and down for slow ones", () => {
    const fast = personalFactor(lifts(0.04), typicalStrengthPct)!;
    const slow = personalFactor(lifts(0.003), typicalStrengthPct)!;
    expect(fast.factor).toBeGreaterThan(1);
    expect(slow.factor).toBeLessThan(1);
    const pFast = project({ ...base, weeksIn: 10, lifts: lifts(0.04) });
    expect(pFast.tracking).toMatch(/faster than typical/);
    expect(pFast.points[4]!.strengthPct.mid).toBeGreaterThan(project(base).points[4]!.strengthPct.mid);
  });
});

describe("RC-05: an on-track lifter is told they're on track, whatever their history", () => {
  for (const history of ["never", "a_little", "lapsed", "regular"] as const) {
    it(`${history}`, () => {
      const profile = { ...referenceProfile, trainingHistory: history };
      const typical = project({ ...base, profile });
      // e1RM rising exactly along the projection's own median curve.
      const at = (w: number) => {
        const pts = [{ week: 0, strengthPct: { mid: 0 } }, ...typical.points];
        const i = pts.findIndex((x) => x.week >= w);
        const a = pts[i - 1]!, b = pts[i]!;
        return a.strengthPct.mid + ((b.strengthPct.mid - a.strengthPct.mid) * (w - a.week)) / (b.week - a.week);
      };
      const lifts: LiftObservation[] = [1, 4, 6, 8, 10, 12].map((week) => ({ exerciseId: "goblet_squat", week, e1rmKg: 20 * (1 + at(week) / 100) }));
      const p = project({ ...base, profile, weeksIn: 12, lifts });
      expect(p.personalFactor!).toBeGreaterThan(0.9);
      expect(p.personalFactor!).toBeLessThan(1.1);
      expect(p.tracking).toMatch(/tracking the typical curve/);
    });
  }
});

describe("RC-09: the curve doesn't jump as the user passes a horizon", () => {
  it("moves smoothly across week 12 for a fast responder", () => {
    const fast: LiftObservation[] = [1, 3, 6, 9, 11.9].map((week) => ({ exerciseId: "goblet_squat", week, e1rmKg: 20 * (1 + 0.05 * week) }));
    const before = project({ ...base, weeksIn: 11.9, lifts: fast });
    const after = project({ ...base, weeksIn: 12.1, lifts: fast });
    const w12 = (x: typeof before) => x.points.find((pt) => pt.week === 12)!.strengthPct.mid;
    expect(before.personalFactor!).toBeGreaterThan(1.1);
    expect(Math.abs(w12(before) - w12(after))).toBeLessThanOrEqual(1);
  });

  it("never lets a returning lifter's curve dip after week 12", () => {
    const p = project({ ...base, profile: { ...referenceProfile, trainingHistory: "lapsed" } });
    const mids = p.points.map((x) => x.strengthPct.mid);
    expect([...mids].sort((a, b) => a - b)).toEqual(mids);
  });
});
