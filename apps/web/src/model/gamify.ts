import { kgToLb } from "@repcurve/shared";
import { movedKg, newRecords } from "./celebrate";
import { localWeek } from "./plan";
import { liftSeries, type LiftSeries } from "./progress";
import type { Core, SessionRecord } from "./types";

/**
 * The game layer: badges, lifetime totals in everyday objects, a monthly challenge, levels per
 * lift and a workout calendar. Everything is worked out from the session history, so nothing
 * new is stored and a restored backup brings it all back.
 */

const done = (history: SessionRecord[]) => history.filter((r) => !r.skipped).sort((a, b) => a.finishedAt - b.finishedAt);

// ---------------------------------------------------------------- weight in everyday objects

/** Rough weights, lb. */
const OBJECTS: { lb: number; one: string; many: string }[] = [
  { lb: 10, one: "a house cat", many: "house cats" },
  { lb: 70, one: "a golden retriever", many: "golden retrievers" },
  { lb: 170, one: "a washing machine", many: "washing machines" },
  { lb: 1_000, one: "a grand piano", many: "grand pianos" },
  { lb: 2_800, one: "a small car", many: "small cars" },
  { lb: 5_000, one: "a pickup truck", many: "pickup trucks" },
  { lb: 13_000, one: "an African elephant", many: "African elephants" },
  { lb: 25_000, one: "a school bus", many: "school buses" },
  { lb: 66_000, one: "a humpback whale", many: "humpback whales" },
  { lb: 300_000, one: "a blue whale", many: "blue whales" },
];

/** "about 2.5 grand pianos" for a weight, or null when it's too light to compare. */
export function equivalent(kg: number): string | null {
  const lb = kgToLb(kg);
  const obj = [...OBJECTS].reverse().find((o) => o.lb <= lb);
  if (!obj) return null;
  const n = lb / obj.lb;
  if (n < 1.15) return `about ${obj.one}`;
  const shown = n < 10 ? Math.round(n * 2) / 2 : Math.round(n);
  return `about ${shown} ${obj.many}`;
}

export function lifetimeMovedKg(history: SessionRecord[]): number {
  return done(history).reduce((n, r) => n + (r.kind === "strength" ? movedKg(r) : 0), 0);
}

// ---------------------------------------------------------------- levels per lift

/** Level 1 at the first session; each 5% on the estimated max (or 2 more reps) is a level. */
export function liftLevel(lift: Pick<LiftSeries, "metric" | "points">): number {
  if (lift.points.length === 0) return 1;
  const first = lift.points[0]!.y;
  const best = Math.max(...lift.points.map((p) => p.y));
  const steps = lift.metric === "e1rm" ? (first > 0 ? (best / first - 1) / 0.05 : 0) : (best - first) / 2;
  return Math.max(1, 1 + Math.floor(steps + 1e-9));
}

export interface LevelUp {
  exerciseId: string;
  name: string;
  level: number;
}

/** Lifts whose level went up with this session. */
export function levelUps(record: SessionRecord, history: SessionRecord[]): LevelUp[] {
  const before = new Map(liftSeries(history.filter((r) => r.id !== record.id && r.finishedAt <= record.finishedAt)).map((l) => [l.id, l]));
  const after = liftSeries([...history.filter((r) => r.id !== record.id && r.finishedAt <= record.finishedAt), record]);
  const out: LevelUp[] = [];
  for (const l of after) {
    const prev = before.get(l.id);
    if (!prev || prev.metric !== l.metric) continue;
    const was = liftLevel(prev);
    const now = liftLevel(l);
    if (now > was) out.push({ exerciseId: l.id, name: l.name, level: now });
  }
  return out;
}

// ---------------------------------------------------------------- monthly challenge

export interface Challenge {
  /** e.g. "October" */
  month: string;
  year: number;
  target: number;
  done: number;
  daysLeft: number;
  complete: boolean;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_MS = 86_400_000;

/** Workouts to aim for in a month: about 90% of the planned sessions in the days you were training. */
export function challengeTarget(daysPerWeek: number, activeDays: number): number {
  return Math.max(2, Math.round((daysPerWeek * activeDays * 0.9) / 7));
}

export function monthChallenge(history: SessionRecord[], core: Pick<Core, "profile" | "startedAt">, now: number): Challenge {
  const d = new Date(now);
  const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  const began = Math.max(start, new Date(new Date(core.startedAt).toDateString()).getTime());
  const activeDays = Math.max(1, Math.round((end - Math.min(began, end - DAY_MS)) / DAY_MS));
  const target = challengeTarget(core.profile.daysPerWeek, activeDays);
  const count = done(history).filter((r) => r.finishedAt >= start && r.finishedAt < end).length;
  return {
    month: MONTHS[d.getMonth()]!,
    year: d.getFullYear(),
    target,
    done: count,
    daysLeft: Math.max(0, Math.round((end - now) / DAY_MS)),
    complete: count >= target,
  };
}

// ---------------------------------------------------------------- calendar

export interface CalendarDay {
  date: number;
  /** Day of the month, 1-based. */
  day: number;
  strength: boolean;
  cardio: boolean;
  today: boolean;
}

/** One month as weeks of 7 (Monday first); days outside the month are null. */
export function monthCalendar(history: SessionRecord[], year: number, month: number, now: number): (CalendarDay | null)[][] {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const key = (t: number) => new Date(t).toDateString();
  const strength = new Set(done(history).filter((r) => r.kind === "strength").map((r) => key(r.finishedAt)));
  const cardio = new Set(done(history).filter((r) => r.kind === "cardio").map((r) => key(r.finishedAt)));
  const cells: (CalendarDay | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= days; day++) {
    const date = new Date(year, month, day).getTime();
    cells.push({ date, day, strength: strength.has(key(date)), cardio: cardio.has(key(date)), today: key(date) === key(now) });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (CalendarDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// ---------------------------------------------------------------- badges

export type Tier = "bronze" | "silver" | "gold" | "platinum";

export interface Badge {
  id: string;
  name: string;
  /** How it's earned, e.g. "Finish 10 workouts". */
  how: string;
  /** Short text on the medal. */
  mark: string;
  tier: Tier;
  /** When it was earned and in which session, or null while locked. */
  earned: { at: number; sessionId: string } | null;
  /** Progress toward it while locked. */
  progress?: { have: number; need: number };
}

interface Def {
  id: string;
  name: string;
  how: string;
  mark: string;
  tier: Tier;
  need: number;
  /** Which running count it tracks. */
  counter: keyof Counters;
}

/** Days without a session after which the next one counts as coming back. */
export const RETURN_GAP_DAYS = 7;

interface Counters {
  workouts: number;
  fullWeeks: number;
  streak: number;
  records: number;
  movedLb: number;
  topLevel: number;
  harder: number;
  cardio: number;
  challenges: number;
  comebacks: number;
  /** Sessions done after a week or more without one. */
  returns: number;
}

const DEFS: Def[] = [
  { id: "workouts-1", name: "First workout", how: "Finish your first workout", mark: "1", tier: "bronze", need: 1, counter: "workouts" },
  { id: "workouts-5", name: "Five down", how: "Finish 5 workouts", mark: "5", tier: "bronze", need: 5, counter: "workouts" },
  { id: "workouts-10", name: "Ten strong", how: "Finish 10 workouts", mark: "10", tier: "silver", need: 10, counter: "workouts" },
  { id: "workouts-25", name: "Twenty-five", how: "Finish 25 workouts", mark: "25", tier: "silver", need: 25, counter: "workouts" },
  { id: "workouts-50", name: "Fifty", how: "Finish 50 workouts", mark: "50", tier: "gold", need: 50, counter: "workouts" },
  { id: "workouts-100", name: "Century", how: "Finish 100 workouts", mark: "100", tier: "gold", need: 100, counter: "workouts" },
  { id: "workouts-250", name: "Lifer", how: "Finish 250 workouts", mark: "250", tier: "platinum", need: 250, counter: "workouts" },
  { id: "week-1", name: "Full week", how: "Do every planned session in a week", mark: "W", tier: "bronze", need: 1, counter: "fullWeeks" },
  { id: "week-10", name: "Ten full weeks", how: "Do every planned session in 10 weeks", mark: "10W", tier: "gold", need: 10, counter: "fullWeeks" },
  { id: "streak-4", name: "Four-week streak", how: "Train at least once a week for 4 weeks running", mark: "4", tier: "bronze", need: 4, counter: "streak" },
  { id: "streak-12", name: "Twelve-week streak", how: "Train every week for 12 weeks running", mark: "12", tier: "silver", need: 12, counter: "streak" },
  { id: "streak-26", name: "Half a year", how: "Train every week for 26 weeks running", mark: "26", tier: "gold", need: 26, counter: "streak" },
  { id: "streak-52", name: "A whole year", how: "Train every week for 52 weeks running", mark: "52", tier: "platinum", need: 52, counter: "streak" },
  { id: "records-1", name: "New best", how: "Set your first personal record", mark: "PR", tier: "bronze", need: 1, counter: "records" },
  { id: "records-10", name: "Record breaker", how: "Set 10 personal records", mark: "10", tier: "silver", need: 10, counter: "records" },
  { id: "records-50", name: "Unstoppable", how: "Set 50 personal records", mark: "50", tier: "gold", need: 50, counter: "records" },
  { id: "moved-piano", name: "Grand piano", how: "Lift 1,000 lb (450 kg) in total", mark: "1K", tier: "bronze", need: 1_000, counter: "movedLb" },
  { id: "moved-truck", name: "Pickup truck", how: "Lift 5,000 lb (2,270 kg) in total", mark: "5K", tier: "silver", need: 5_000, counter: "movedLb" },
  { id: "moved-elephant", name: "Elephant", how: "Lift 13,000 lb (5,900 kg) in total", mark: "13K", tier: "silver", need: 13_000, counter: "movedLb" },
  { id: "moved-bus", name: "School bus", how: "Lift 25,000 lb (11,340 kg) in total", mark: "25K", tier: "gold", need: 25_000, counter: "movedLb" },
  { id: "moved-whale", name: "Humpback whale", how: "Lift 66,000 lb (29,940 kg) in total", mark: "66K", tier: "platinum", need: 66_000, counter: "movedLb" },
  { id: "level-5", name: "Level 5", how: "Reach level 5 on any lift", mark: "L5", tier: "silver", need: 5, counter: "topLevel" },
  { id: "level-10", name: "Level 10", how: "Reach level 10 on any lift", mark: "L10", tier: "gold", need: 10, counter: "topLevel" },
  { id: "harder-1", name: "Level up the move", how: "Move up to a harder version of an exercise", mark: "↑", tier: "bronze", need: 1, counter: "harder" },
  { id: "cardio-1", name: "Heart starter", how: "Finish a cardio session", mark: "C", tier: "bronze", need: 1, counter: "cardio" },
  { id: "cardio-10", name: "Ten cardio", how: "Finish 10 cardio sessions", mark: "C10", tier: "silver", need: 10, counter: "cardio" },
  { id: "challenge-1", name: "Challenge met", how: "Complete a monthly challenge", mark: "M", tier: "silver", need: 1, counter: "challenges" },
  { id: "challenge-6", name: "Six months strong", how: "Complete 6 monthly challenges", mark: "6M", tier: "gold", need: 6, counter: "challenges" },
  { id: "comeback-1", name: "Welcome back", how: "Come back after a break of two weeks or more", mark: "↺", tier: "bronze", need: 1, counter: "comebacks" },
  // Rewarding a return after missed sessions was the most effective of 54 nudges in a megastudy of gym members (Milkman 2021).
  { id: "return-1", name: "Back on track", how: "Train again after a week or more off", mark: "↩", tier: "bronze", need: 1, counter: "returns" },
  { id: "return-5", name: "Bounce back", how: "Come back after a week off five times", mark: "5↩", tier: "silver", need: 5, counter: "returns" },
];

/** Every badge, earned or not, walking the history in order to find when each was earned. */
export function badges(history: SessionRecord[], core: Pick<Core, "profile" | "startedAt">): Badge[] {
  const sessions = done(history);
  const c: Counters = { workouts: 0, fullWeeks: 0, streak: 0, records: 0, movedLb: 0, topLevel: 1, harder: 0, cardio: 0, challenges: 0, comebacks: 0, returns: 0 };
  const earned = new Map<string, { at: number; sessionId: string }>();
  const perWeek = new Map<number, number>();
  const perMonth = new Map<string, number>();
  const metMonths = new Set<string>();
  const seen: SessionRecord[] = [];
  let lastWeek: number | null = null;
  let lastAt: number | null = null;

  for (const r of sessions) {
    c.workouts++;
    if (r.kind === "cardio") c.cardio++;
    if (lastAt !== null && r.finishedAt - lastAt >= 14 * DAY_MS) c.comebacks++;
    if (lastAt !== null && r.finishedAt - lastAt >= RETURN_GAP_DAYS * DAY_MS) c.returns++;

    const w = localWeek(r.finishedAt);
    perWeek.set(w, (perWeek.get(w) ?? 0) + 1);
    if (perWeek.get(w) === core.profile.daysPerWeek) c.fullWeeks++;
    c.streak = lastWeek === null ? 1 : w === lastWeek ? c.streak : w === lastWeek + 1 ? c.streak + 1 : 1;
    lastWeek = w;

    const m = new Date(r.finishedAt);
    const mk = `${m.getFullYear()}-${m.getMonth()}`;
    perMonth.set(mk, (perMonth.get(mk) ?? 0) + 1);
    if (!metMonths.has(mk)) {
      const ch = monthChallenge(seen.concat(r), core, r.finishedAt);
      if (ch.complete) {
        metMonths.add(mk);
        c.challenges++;
      }
    }

    if (r.kind === "strength") {
      c.records += newRecords(r, seen.concat(r)).length;
      c.movedLb += kgToLb(movedKg(r));
      c.harder += r.changes.filter((x) => x.action === "ladder_up").length;
    }
    seen.push(r);
    if (r.kind === "strength") c.topLevel = Math.max(1, ...liftSeries(seen).map(liftLevel));

    for (const d of DEFS) if (!earned.has(d.id) && c[d.counter] >= d.need) earned.set(d.id, { at: r.finishedAt, sessionId: r.id });
    lastAt = r.finishedAt;
  }

  return DEFS.map((d) => {
    const e = earned.get(d.id) ?? null;
    const have = Math.min(d.need, Math.floor(c[d.counter]));
    return { id: d.id, name: d.name, how: d.how, mark: d.mark, tier: d.tier, earned: e, ...(e ? {} : { progress: { have, need: d.need } }) };
  });
}

/** Badges this session earned. */
export function newBadges(record: SessionRecord, history: SessionRecord[], core: Pick<Core, "profile" | "startedAt">): Badge[] {
  const all = history.some((r) => r.id === record.id) ? history : [...history, record];
  return badges(all, core).filter((b) => b.earned?.sessionId === record.id);
}
