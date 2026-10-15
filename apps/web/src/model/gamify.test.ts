import type { Equipment, Profile } from "@repcurve/shared";
import { kgToLb, lbToKg } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { movedKg, newRecords } from "./celebrate";
import {
  BADGE_DEFS, badgeList, badges, challengeTarget, equivalent, levelUps, liftLevel, monthCalendar, monthChallenge, newBadges, NO_COUNTS,
  RETURN_GAP_DAYS, type Badge, type BadgeCounters,
} from "./gamify";
import { localWeek, newCore, planFor } from "./plan";
import { liftSeries } from "./progress";
import type { Core, SessionRecord } from "./types";

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

describe("the routes to the earned looks", () => {
  const harder = (r: SessionRecord): SessionRecord => ({ ...r, changes: [{ action: "ladder_up" } as SessionRecord["changes"][number]] });

  it("count a first record and a first harder move together", () => {
    const pr = [rec(0, 0, [squat(20)]), rec(1, 2, [squat(25)])];
    expect(earnedIds(pr)).not.toContain("firsts-2");
    expect(badges(pr, core).find((x) => x.id === "firsts-2")!.progress).toEqual({ have: 1, need: 2 });
    const h = [...pr, harder(rec(2, 4, [squat(25)]))];
    expect(newBadges(h[2]!, h, core).map((x) => x.id)).toContain("firsts-2");
    // In either order.
    const h2 = [harder(rec(0, 0, [squat(20)])), rec(1, 2, [squat(25)])];
    expect(newBadges(h2[1]!, h2, core).map((x) => x.id)).toContain("firsts-2");
  });

  it("count full weeks three times, and level 15 on a lift", () => {
    // Three sessions a week (Monday, Wednesday, Friday) for three weeks.
    const weeks = Array.from({ length: 9 }, (_, i) => rec(i, Math.floor(i / 3) * 7 + (i % 3) * 2, [squat(20)]));
    expect(newBadges(weeks[8]!, weeks, core).map((x) => x.id)).toContain("week-3");
    expect(earnedIds(weeks.slice(0, 8))).not.toContain("week-3");
    // 20 -> 35 lb is +75% on the estimated max: fifteen steps, level 16.
    expect(earnedIds([rec(0, 0, [squat(20)]), rec(1, 2, [squat(35)])])).toContain("level-15");
    expect(earnedIds([rec(0, 0, [squat(20)]), rec(1, 2, [squat(30)])])).not.toContain("level-15");
  });
});

// ---------------------------------------------------------------- the single pass matches re-reading the history

/** badges() as it was: re-reads the history so far for records, levels and the monthly challenge at every session. */
function badgesByRereading(history: SessionRecord[], c0: Pick<Core, "profile" | "startedAt">): Badge[] {
  const sessions = history.filter((r) => !r.skipped).sort((a, b) => a.finishedAt - b.finishedAt);
  const c: BadgeCounters = { ...NO_COUNTS };
  const earned = new Map<string, { at: number; sessionId: string }>();
  const perWeek = new Map<number, number>();
  const metMonths = new Set<string>();
  const seen: SessionRecord[] = [];
  let lastWeek: number | null = null;
  let lastAt: number | null = null;
  for (const r of sessions) {
    c.workouts++;
    if (r.kind === "cardio") c.cardio++;
    if (lastAt !== null && r.finishedAt - lastAt >= 14 * DAY) c.comebacks++;
    if (lastAt !== null && r.finishedAt - lastAt >= RETURN_GAP_DAYS * DAY) c.returns++;
    const w = localWeek(r.finishedAt);
    perWeek.set(w, (perWeek.get(w) ?? 0) + 1);
    if (perWeek.get(w) === c0.profile.daysPerWeek) c.fullWeeks++;
    c.streak = lastWeek === null ? 1 : w === lastWeek ? c.streak : w === lastWeek + 1 ? c.streak + 1 : 1;
    lastWeek = w;
    const m = new Date(r.finishedAt);
    const mk = `${m.getFullYear()}-${m.getMonth()}`;
    if (!metMonths.has(mk) && monthChallenge(seen.concat(r), c0, r.finishedAt).complete) {
      metMonths.add(mk);
      c.challenges++;
    }
    if (r.kind === "strength") {
      c.records += newRecords(r, seen.concat(r)).length;
      c.movedLb += kgToLb(movedKg(r));
      c.harder += r.changes.filter((x) => x.action === "ladder_up").length;
    }
    seen.push(r);
    if (r.kind === "strength") c.topLevel = Math.max(1, ...liftSeries(seen).map(liftLevel));
    c.firsts = Number(c.records > 0) + Number(c.harder > 0);
    for (const d of BADGE_DEFS) if (!earned.has(d.id) && c[d.counter] >= d.need) earned.set(d.id, { at: r.finishedAt, sessionId: r.id });
    lastAt = r.finishedAt;
  }
  return badgeList(c, earned);
}

/** A small seeded random generator, so a failure can be replayed. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MOVES = ["goblet_squat", "db_floor_press", "db_bent_over_row", "bw_split_squat", "db_curl", "kneeling_ab_rollout", "not_an_exercise"];

/** A random history: gaps from the same day to a month, cardio, skips, bodyweight and loaded sets, harder moves, pain. */
function randomHistory(seed: number, n: number): SessionRecord[] {
  const r = rng(seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]!;
  let day = 0;
  const out: SessionRecord[] = [];
  for (let i = 0; i < n; i++) {
    day += r() < 0.1 ? 0 : r() < 0.9 ? 1 + Math.floor(r() * 3) : 7 + Math.floor(r() * 25);
    const kind = r() < 0.2 ? "cardio" : "strength";
    const sets = kind === "cardio" ? [] : Array.from({ length: Math.floor(r() * 7) }, () => ({ id: pick(MOVES), load: r() < 0.3 ? null : lbToKg(5 + Math.floor(r() * 12) * 5), reps: Math.floor(r() * 15) }));
    const base = rec(i, day + r() * 0.5, sets, kind);
    out.push({
      ...base,
      skipped: r() < 0.05,
      changes: r() < 0.08 ? [{ action: "ladder_up" } as SessionRecord["changes"][number]] : [],
      sets: base.sets.map((s) => ({ ...s, rir: Math.floor(r() * 4), painFlag: r() < 0.05 })),
    });
  }
  // Out of order, as a restored history might be.
  return out.sort(() => r() - 0.5);
}

describe("badges in a single pass", () => {
  it("match re-reading the history at every session, for random histories", () => {
    const seenEarned = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const h = randomHistory(seed, 20 + seed * 5);
      const c = { ...core, profile: { ...profile, daysPerWeek: 2 + (seed % 4) } };
      const fast = badges(h, c);
      expect(fast, `seed ${seed}`).toEqual(badgesByRereading(h, c));
      for (const b of fast) if (b.earned) seenEarned.add(b.id);
    }
    // The histories reach the badges that re-reading used to work out.
    expect([...seenEarned]).toEqual(expect.arrayContaining(["challenge-1", "records-10", "level-5", "level-10", "week-3", "firsts-2", "streak-12", "return-5"]));
  });

  it("take well under 100 ms for 1,000 sessions", () => {
    const h = randomHistory(7, 1_000);
    badges(h, core); // warm up
    const t0 = performance.now();
    badges(h, core);
    expect(performance.now() - t0).toBeLessThan(100);
  });
});

