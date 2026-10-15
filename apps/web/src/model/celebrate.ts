import { findExercise } from "@repcurve/exercises";
import { e1RM } from "@repcurve/shared";
import { localWeek, weekStreak } from "./plan";
import type { Core, SessionRecord } from "./types";

/**
 * What to celebrate when a session ends: what you did, rough calories, new records, your week,
 * and why it was worth it.
 */
export interface Celebration {
  headline: string;
  message: string;
  /** Workouts done so far, this one included. */
  count: number;
  minutes: number;
  sets: number;
  /** Total weight moved, kg (load × reps, both dumbbells and both sides counted). */
  movedKg: number;
  /** A rough estimate from body weight, time and the kind of session. */
  calories: number;
  records: { exerciseId: string; name: string; loadKg: number | null; reps: number }[];
  week: { done: number; planned: number };
  streakWeeks: number;
  benefits: string[];
}

/** Energy cost of activities, in METs (Compendium of Physical Activities, approximate). */
const STRENGTH_MET = 5; // supersets with short rests: between ordinary weight training (3.5) and circuits (8)
const cardioMet = (effort: number) => 2.5 + 0.6 * Math.min(10, Math.max(1, effort)); // ~4 easy walk … ~8 run

export function caloriesFor(record: SessionRecord, bodyweightKg: number): number {
  const minutes = record.kind === "cardio" ? (record.cardio?.minutes ?? record.activeMinutes) : record.activeMinutes;
  const met = record.kind === "cardio" ? cardioMet(record.cardio?.effort ?? 5) : STRENGTH_MET;
  return Math.round((met * bodyweightKg * (minutes / 60)) / 5) * 5;
}

/** Weight moved in a session: each dumbbell of a pair and each side of a one-sided move counts. */
export function movedKg(record: SessionRecord): number {
  const items = [...(record.plan?.supersets ?? []).flatMap((ss) => ss.items), ...(record.plan?.finisher ? [record.plan.finisher] : [])];
  let kg = 0;
  for (const s of record.sets) {
    if (s.loadKg === null) continue;
    const p = items.find((x) => x.exerciseId === s.exerciseId);
    const hands = p?.loadType === "dumbbell_pair" ? 2 : 1;
    const sides = p?.unilateral ? 2 : 1;
    kg += s.loadKg * s.reps * hands * sides;
  }
  return kg;
}

/** Best effort per exercise in a session: estimated max for loaded sets, else most reps. */
function bests(record: SessionRecord): Map<string, { score: number; loadKg: number | null; reps: number }> {
  const out = new Map<string, { score: number; loadKg: number | null; reps: number }>();
  for (const s of record.sets) {
    if (s.reps <= 0 || s.painFlag) continue;
    const score = s.loadKg !== null ? e1RM(s.loadKg, s.reps, s.rir) : s.reps;
    const cur = out.get(s.exerciseId);
    if (!cur || score > cur.score) out.set(s.exerciseId, { score, loadKg: s.loadKg, reps: s.reps });
  }
  return out;
}

/** The best so far per exercise, over the sessions added to it with addBests. */
export type BestsSoFar = Map<string, { score: number; loaded: boolean }>;

/** Adds a strength session's bests to a running record of bests. */
export function addBests(before: BestsSoFar, record: SessionRecord): void {
  for (const [id, b] of bests(record)) {
    const cur = before.get(id);
    if (!cur || b.score > cur.score) before.set(id, { score: b.score, loaded: b.loadKg !== null });
  }
}

/** Exercises where this session beat every earlier session (done at least once before). */
export function newRecords(record: SessionRecord, history: SessionRecord[]): Celebration["records"] {
  const before: BestsSoFar = new Map();
  for (const r of history) {
    if (r.id !== record.id && r.kind === "strength" && !r.skipped && r.finishedAt <= record.finishedAt) addBests(before, r);
  }
  return recordsAgainst(record, before);
}

/** Exercises where this session beat the bests so far. */
export function recordsAgainst(record: SessionRecord, before: BestsSoFar): Celebration["records"] {
  const out: Celebration["records"] = [];
  for (const [id, b] of bests(record)) {
    const prev = before.get(id);
    // Same kind of measure (a move from bodyweight to dumbbells isn't compared), and a real gain.
    if (!prev || prev.loaded !== (b.loadKg !== null) || b.score <= prev.score + 1e-6) continue;
    const e = findExercise(id);
    if (!e || e.pattern === "core") continue;
    out.push({ exerciseId: id, name: e.name, loadKg: b.loadKg, reps: b.reps });
  }
  return out;
}

const MILESTONES = new Set([5, 10, 25, 50, 75, 100, 150, 200, 250, 300, 365, 500]);

const STRENGTH_BENEFITS = [
  "Stronger muscles make everyday things easier: stairs, carrying shopping, getting up off the floor.",
  "Lifting strengthens your bones as well as your muscles.",
  "Working muscles soak up blood sugar, which helps your body keep it steady.",
  "Regular strength training is linked to better sleep and a better mood.",
  "Muscle you build now protects your joints and balance for years to come.",
];
const LEGS_BENEFIT = "Leg work like today's keeps the muscles you stand, climb and balance with strong.";
const CARDIO_BENEFITS = [
  "Cardio strengthens your heart and lungs, and brisk walking counts.",
  "Regular cardio helps lower blood pressure over time.",
  "Moving like this is one of the most reliable ways to lift your energy and mood.",
];

export function celebrate(record: SessionRecord, history: SessionRecord[], core: Core): Celebration {
  const done = history.filter((r) => !r.skipped && r.finishedAt <= record.finishedAt);
  const count = Math.max(1, done.length + (done.some((r) => r.id === record.id) ? 0 : 1));
  const week = localWeek(record.finishedAt);
  const weekDone = new Set([...done.filter((r) => localWeek(r.finishedAt) === week).map((r) => r.id), record.id]).size;
  const records = record.kind === "strength" ? newRecords(record, history) : [];
  const streakWeeks = weekStreak([...history.filter((r) => r.id !== record.id), record], record.finishedAt);

  let headline: string;
  let message: string;
  if (count === 1) {
    headline = "First workout done!";
    message = "The first one is the hardest, and you did it. Showing up is what builds strength.";
  } else if (MILESTONES.has(count)) {
    headline = `Workout number ${count}!`;
    message = `${count} workouts in. Consistency like this is the whole secret.`;
  } else if (records.length > 0) {
    headline = records.length === 1 ? "New personal record!" : `${records.length} personal records!`;
    message = "You're stronger than you've ever been on " + (records.length === 1 ? "this lift." : "these lifts.");
  } else if (weekDone >= core.profile.daysPerWeek) {
    headline = "Week complete!";
    message = `That's all ${core.profile.daysPerWeek} sessions this week. Take the win.`;
  } else {
    const lines: [string, string][] = [
      ["Workout complete!", "Every session adds up. This one counts."],
      ["Nice work!", "You put in the effort today. Your future self will feel it."],
      ["Another one done!", "Steady work like this is exactly how strength is built."],
      ["Strong session!", "You showed up and did the work. That's the hard part."],
    ];
    [headline, message] = lines[count % lines.length]!;
  }

  const trainedLegs = (record.plan?.supersets ?? []).some((ss) => ss.items.some((p) => p.pattern === "squat" || p.pattern === "hinge"));
  const pool = record.kind === "cardio" ? CARDIO_BENEFITS : STRENGTH_BENEFITS;
  const benefits = [pool[count % pool.length]!, record.kind === "strength" && trainedLegs ? LEGS_BENEFIT : pool[(count + 1) % pool.length]!];

  return {
    headline,
    message,
    count,
    minutes: record.kind === "cardio" ? (record.cardio?.minutes ?? record.activeMinutes) : record.activeMinutes,
    sets: record.sets.length,
    movedKg: movedKg(record),
    calories: caloriesFor(record, core.profile.bodyweightKg),
    records,
    week: { done: weekDone, planned: core.profile.daysPerWeek },
    streakWeeks,
    benefits,
  };
}
