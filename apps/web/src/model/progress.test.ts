import { generateProgram, project } from "@repcurve/engine";
import type { Equipment, Profile } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { change, inRange, liftForecast, liftSeries, weeklyAdherence } from "./progress";
import type { SessionRecord } from "./types";

const DAY = 86_400_000;
const T0 = new Date(2026, 8, 7, 18).getTime(); // a Monday evening, local time

function rec(i: number, day: number, sets: { id: string; load: number | null; reps: number }[], skipped = false): SessionRecord {
  return {
    id: `s${i}`, index: i, kind: "strength", name: "Full body A", week: 1, startedAt: T0 + day * DAY, finishedAt: T0 + day * DAY,
    activeMinutes: 20, plan: {} as SessionRecord["plan"], changes: [], cardio: null, deload: false, comeback: false, skipped,
    sets: sets.map((s, k) => ({ exerciseId: s.id, slot: "A.x", setIndex: k, loadKg: s.load, reps: s.reps, rir: 2, at: 0 })),
  };
}

describe("progress model", () => {
  const history = [
    rec(0, 0, [{ id: "goblet_squat", load: 10, reps: 10 }, { id: "push_up", load: null, reps: 8 }, { id: "plank", load: null, reps: 30 }]),
    rec(1, 2, [{ id: "goblet_squat", load: 10, reps: 12 }, { id: "push_up", load: null, reps: 10 }]),
    rec(2, 4, [], true),
    rec(3, 7, [{ id: "goblet_squat", load: 12, reps: 12 }]),
  ];

  it("builds one series per lift from the best set, loaded lifts first, core left out", () => {
    const s = liftSeries(history);
    expect(s.map((l) => l.id)).toEqual(["goblet_squat", "push_up"]);
    expect(s[0]!.metric).toBe("e1rm");
    expect(s[0]!.points).toHaveLength(3);
    expect(s[1]!.points.map((p) => p.y)).toEqual([8, 10]);
    // Epley with reps in reserve: 10 lb x (10+2) -> 14, 12 lb x (12+2) -> 17.6.
    expect(change(s[0]!.points)!).toBeCloseTo(17.6 / 14 - 1, 3);
  });

  it("filters by range", () => {
    const pts = [{ t: T0 - 40 * DAY }, { t: T0 - 20 * DAY }, { t: T0 }];
    expect(inRange(pts, "4w", T0)).toHaveLength(2);
    expect(inRange(pts, "12w", T0)).toHaveLength(3);
    expect(inRange(pts, "all", T0)).toHaveLength(3);
  });

  it("counts sessions done per local week, ignoring skips", () => {
    const weeks = weeklyAdherence(history, 3, T0 + 8 * DAY);
    expect(weeks.map((w) => w.done)).toEqual([2, 1]);
    expect(weeks.every((w) => w.planned === 3)).toBe(true);
  });

  it("forecasts a lift along the projected curve, starting from today and never below it", () => {
    const profile: Profile = { sex: "male", age: 33, heightCm: 178, bodyweightKg: 84, trainingHistory: "never", goal: "both", daysPerWeek: 4, minutesPerSession: 20, injuries: [], units: "lb" };
    const equipment: Equipment = { dumbbells: { kind: "fixed", weights: [10, 20, 30], unit: "lb", pairs: true }, treadmill: true, mat: true, abRoller: false, pullupBar: false, bench: false, bands: [] };
    const program = generateProgram({ profile, equipment }, { weeks: 2 });
    const projection = project({ profile, weeklyVolume: program.weeklyVolume, template: program.template, cardioMinutesPerWeek: 20 });
    const f = liftForecast(30, projection, 6);
    expect(f[0]).toEqual({ weeksAhead: 0, lo: 30, mid: 30, hi: 30 });
    for (let i = 1; i < f.length; i++) {
      expect(f[i]!.mid).toBeGreaterThan(f[i - 1]!.mid);
      expect(f[i]!.lo).toBeGreaterThanOrEqual(30);
      expect(f[i]!.lo).toBeLessThanOrEqual(f[i]!.mid);
      expect(f[i]!.hi).toBeGreaterThanOrEqual(f[i]!.mid);
    }
    // Twelve weeks out from week 6 a newer lifter gains a few to ~20 percent, not doubles.
    expect(f[3]!.mid / 30).toBeGreaterThan(1.03);
    expect(f[3]!.mid / 30).toBeLessThan(1.3);
  });
});
