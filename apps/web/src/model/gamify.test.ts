import type { Equipment, Profile } from "@repcurve/shared";
import { lbToKg } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { badges, challengeTarget, equivalent, levelUps, liftLevel, monthCalendar, monthChallenge, newBadges } from "./gamify";
import { newCore, planFor } from "./plan";
import type { SessionRecord } from "./types";

const DAY = 86_400_000;
const T0 = new Date(2026, 8, 7, 18).getTime(); // Monday 7 Sep 2026, evening, local time
const profile: Profile = {
  sex: "male", age: 33, heightCm: 178, bodyweightKg: 84, trainingHistory: "never", goal: "both",
  daysPerWeek: 3, minutesPerSession: 20, injuries: [], units: "lb",
};
const equipment: Equipment = {
  dumbbells: { kind: "fixed", weights: [10, 15, 20, 25, 30], unit: "lb", pairs: true },
  treadmill: true, mat: true, abRoller: true, pullupBar: false, bench: true, bands: [],
};
const core = { ...newCore(profile, equipment, T0), startedAt: new Date(T0 - DAY).toISOString() };
const plan = planFor(core, 0);
const squat = (lb: number, reps = 10) => ({ id: "goblet_squat", load: lbToKg(lb), reps });

function rec(i: number, day: number, sets: { id: string; load: number | null; reps: number }[], kind: "strength" | "cardio" = "strength"): SessionRecord {
  return {
    id: `s${i}`, index: i, kind, name: "Full body A", week: 1, startedAt: T0 + day * DAY, finishedAt: T0 + day * DAY,
    activeMinutes: 20, plan, changes: [], cardio: kind === "cardio" ? { minutes: 20, effort: 5, notes: "" } : null,
    deload: false, comeback: false, skipped: false,
    sets: sets.map((s, k) => ({ exerciseId: s.id, slot: "A.x", setIndex: k, loadKg: s.load, reps: s.reps, rir: 2, at: 0 })),
  };
}
const earnedIds = (h: SessionRecord[]) => badges(h, core).filter((b) => b.earned).map((b) => b.id);

describe("weight in everyday objects", () => {
  it("compares with the biggest object that fits, in halves", () => {
    expect(equivalent(lbToKg(5))).toBeNull();
    expect(equivalent(lbToKg(1_050))).toBe("about a grand piano");
    expect(equivalent(lbToKg(2_500))).toBe("about 2.5 grand pianos");
    expect(equivalent(lbToKg(13_500))).toBe("about an African elephant");
  });
});

describe("levels per lift", () => {
  it("start at 1 and rise with every 5% on the estimated max, or 2 reps", () => {
    expect(liftLevel({ metric: "e1rm", points: [{ t: 0, y: 20 }] })).toBe(1);
    expect(liftLevel({ metric: "e1rm", points: [{ t: 0, y: 20 }, { t: 1, y: 22 }] })).toBe(3);
    expect(liftLevel({ metric: "reps", points: [{ t: 0, y: 8 }, { t: 1, y: 13 }] })).toBe(3);
  });

  it("are announced when a session moves a lift up", () => {
    const h = [rec(0, 0, [squat(20)]), rec(1, 2, [squat(25)])];
    // 20 -> 25 lb is +25% on the estimated max: five steps, level 6.
    expect(levelUps(h[1]!, h).map((l) => [l.exerciseId, l.level])).toEqual([["goblet_squat", 6]]);
    expect(levelUps(h[0]!, h)).toEqual([]);
  });
});

describe("monthly challenge", () => {
  it("asks for about 90% of the planned sessions in the month", () => {
    expect(challengeTarget(3, 30)).toBe(12);
    expect(challengeTarget(4, 31)).toBe(16);
    expect(challengeTarget(3, 28)).toBe(11);
  });

  it("counts this month's workouts and is pro-rated for a first month", () => {
    const h = [rec(0, 0, [squat(20)]), rec(1, 2, [], "cardio")];
    const c = monthChallenge(h, core, T0 + 3 * DAY);
    expect(c.month).toBe("September");
    expect(c.done).toBe(2);
    // Started 6 Sep: 25 days left in September at 3 a week.
    expect(c.target).toBe(challengeTarget(3, 25));
    expect(c.complete).toBe(false);
  });
});

describe("calendar", () => {
  it("lays a month out Monday first, marking lifting and cardio days", () => {
    const h = [rec(0, 0, [squat(20)]), rec(1, 2, [], "cardio")];
    const weeks = monthCalendar(h, 2026, 8, T0);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    const days = weeks.flat().filter((d) => d !== null);
    expect(days).toHaveLength(30);
    expect(weeks[0]![1]!.day).toBe(1); // 1 Sep 2026 is a Tuesday
    expect(days.find((d) => d.day === 7)!.strength).toBe(true);
    expect(days.find((d) => d.day === 9)!.cardio).toBe(true);
    expect(days.find((d) => d.day === 7)!.today).toBe(true);
  });
});

describe("badges", () => {
  it("are earned once, in the session that crosses the line", () => {
    const h = [rec(0, 0, [squat(20)]), rec(1, 2, [squat(25)]), rec(2, 4, [], "cardio")];
    expect(earnedIds(h)).toEqual(expect.arrayContaining(["workouts-1", "records-1", "week-1", "cardio-1"]));
    expect(newBadges(h[0]!, h, core).map((b) => b.id)).toEqual(["workouts-1"]);
    expect(newBadges(h[1]!, h, core).map((b) => b.id)).toEqual(expect.arrayContaining(["records-1", "level-5"]));
    expect(newBadges(h[2]!, h, core).map((b) => b.id)).toEqual(expect.arrayContaining(["week-1", "cardio-1"]));
  });

  it("show progress while locked", () => {
    const b = badges([rec(0, 0, [squat(20)]), rec(1, 2, [squat(20)])], core).find((x) => x.id === "workouts-10")!;
    expect(b.earned).toBeNull();
    expect(b.progress).toEqual({ have: 2, need: 10 });
  });

  it("count weekly streaks, comebacks and lifetime weight", () => {
    const weekly = Array.from({ length: 4 }, (_, i) => rec(i, i * 7, [squat(20)]));
    expect(earnedIds(weekly)).toContain("streak-4");
    const gap = [rec(0, 0, [squat(20)]), rec(1, 20, [squat(20)])];
    expect(earnedIds(gap)).toContain("comeback-1");
    expect(earnedIds(gap)).not.toContain("streak-4");
    // 30 lb x 10 reps x 2 dumbbells... the goblet squat is one dumbbell: 300 lb a set, 4 sets = 1,200 lb.
    const heavy = [rec(0, 0, [squat(30), squat(30), squat(30), squat(30)])];
    expect(earnedIds(heavy)).toContain("moved-piano");
  });

  it("ignore skipped sessions", () => {
    const skipped = { ...rec(0, 0, [squat(20)]), skipped: true };
    expect(earnedIds([skipped])).toEqual([]);
  });
});

describe("coming back after a week off", () => {
  it("earns Back on track the first time, and Bounce back the fifth", () => {
    const steady = [rec(0, 0, [squat(20)]), rec(1, 2, [squat(20)])];
    expect(earnedIds(steady)).not.toContain("return-1");
    const once = [...steady, rec(2, 10, [squat(20)])];
    expect(earnedIds(once)).toContain("return-1");
    expect(earnedIds(once)).not.toContain("comeback-1");
    const fives = Array.from({ length: 6 }, (_, i) => rec(i, i * 8, [squat(20)]));
    expect(earnedIds(fives)).toContain("return-5");
  });
});

