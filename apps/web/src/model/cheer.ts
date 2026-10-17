import { prescriptionsOf, type Prescription } from "@repcurve/engine";
import { findExercise } from "@repcurve/exercises";
import { displayLoad, e1RM } from "@repcurve/shared";
import type { Units } from "@repcurve/shared";
import { loadText } from "./format";
import { prescriptionAt, setsForSlot, skippedPlannedSets } from "./session";
import type { ActiveSession, LoggedSet, SessionRecord } from "./types";

/** A pat on the back when an exercise's last set is done. */
export interface Cheer {
  /** What it's mostly about: a new best, a first time, the last exercise, halfway, or just a job done. */
  kind: "best" | "first" | "last" | "half" | "done";
  headline: string;
  line: string;
  /** A number to be proud of, e.g. weight moved and what it compares to. */
  stat: string | null;
  /** Every exercise in the session is done, so the next step is finishing. */
  lastOne: boolean;
}

/** Things that weigh about this much, kg, lightest first: what an exercise's total compares to. */
const HEAVY_THINGS: [number, string][] = [
  [4.5, "a house cat"],
  [7, "a bowling ball"],
  [30, "a golden retriever"],
  [70, "a washing machine"],
  [100, "a newborn elephant"],
  [270, "a grizzly bear"],
  [360, "a grand piano"],
  [500, "a horse"],
  [700, "a dairy cow"],
  [1400, "a small car"],
  [2300, "a rhino"],
  [6000, "an elephant"],
  [11000, "a school bus"],
];

const HEADLINES = ["Nice work!", "Boom!", "Crushed it!", "Pat on the back!", "Well done!", "Strong!", "That's how it's done!", "Look at you go!"];

/** A fun line for each kind of movement; the general ones fill in for anything else. */
const LINES: Record<string, string[]> = {
  squat: [
    "Every chair in your life just got easier to get out of.",
    "Legs: built. Stairs: on notice.",
    "Squats done. Your legs may file a complaint tomorrow. Worth it.",
  ],
  lunge: [
    "One leg at a time, like a champion.",
    "Balance, strength and a little wobble. All part of it.",
    "Lunges: the exercise everyone loves to hate, and you just did it.",
  ],
  rdl: ["Hips hinged, hamstrings fired. Textbook.", "Your back will thank you for that one, for years."],
  deadlift: ["Picking heavy things up off the floor: officially your thing.", "That's the most useful lift there is, done."],
  bridge: ["Glutes on duty and reporting for work.", "Strong hips, happy back. Nice."],
  back_extension: ["A strong lower back is a happy lower back.", "Posture points: earned."],
  hpush: ["If anyone needs a car pushed, you're ready.", "Push-day energy: unlocked.", "Chest and arms say thanks."],
  chest_fly: ["Big hug for your chest muscles. Literally.", "Smooth and controlled. Lovely."],
  vpush: ["Overhead and in charge.", "Top-shelf items fear you now.", "Suitcase into the overhead bin? Easy."],
  row: ["Posture: improved. Shopping bags: no problem.", "Pull it together? You just did.", "Your back is quietly getting stronger. Love that."],
  vpull: ["Pulling your own weight, literally.", "Lats lit. Back built.", "Climbing a wall in an emergency just got more likely."],
  biceps: ["The sleeves have been warned.", "Curls for the soul.", "Carrying all the groceries in one trip: incoming."],
  triceps: ["Arms of steel, under construction.", "Every push you do just got stronger."],
  lateral_raise: ["Shoulders getting broader, one raise at a time.", "Those little raises add up to strong shoulders."],
  rear_delt: ["The muscles you can't see are the ones holding you up.", "Shoulder health: invested in."],
  calf: ["Calves are famously stubborn. You showed up anyway.", "Spring in your step: loading."],
  knee_flexion: ["Hamstrings: the unsung heroes. Sung.", "Strong hamstrings, happy knees."],
  knee_extension: ["Quads fired up. Stairs don't stand a chance.", "Strong legs look after your knees."],
  hip_abduction: ["Side glutes: the secret to steady knees and hips.", "Small muscles, big job, done."],
  hip_adduction: ["Inner thighs worked. Balance improved.", "The quiet muscles got their turn."],
  anti_extension: ["Core: solid as a table.", "Abs are made in sets like that one."],
  trunk_flexion: ["Abs: on it.", "Core work done. Sitting up straight just got easier."],
  anti_lateral: ["Rock-solid sides. Carry anything, one-handed.", "Core strength that holds you steady."],
  anti_rotation: ["Unshakeable. Literally.", "The core that keeps you steady, trained."],
  general: [
    "Another one in the bag.",
    "Strong and steady. That's the way.",
    "Every set you do is a vote for future you.",
    "That's one more thing you can do than you could before.",
    "You showed up and did the work. That's the hard part.",
  ],
};

/** A small, stable number for a piece of text, so the same exercise in the same session gets the same words. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
const pick = <T>(xs: T[], seed: number): T => xs[seed % xs.length]!;

/** Best effort in some sets: estimated max for loaded sets, else most reps. */
function bestOf(sets: LoggedSet[]): { score: number; loadKg: number | null; reps: number } | null {
  let best: { score: number; loadKg: number | null; reps: number } | null = null;
  for (const s of sets) {
    if (s.reps <= 0 || s.painFlag) continue;
    const score = s.loadKg !== null ? e1RM(s.loadKg, s.reps, s.rir) : s.reps;
    if (!best || score > best.score) best = { score, loadKg: s.loadKg, reps: s.reps };
  }
  return best;
}

/** Whether every planned set of an exercise is logged (added sets don't count towards it). */
export function exerciseDone(active: ActiveSession, p: Prescription): boolean {
  if (active.skippedSlots.includes(p.slot)) return false;
  // A set skipped ("not feeling it") counts as dealt with, as long as at least one was done.
  const logged = setsForSlot(active, p.slot).filter((s) => s.setIndex < p.sets).length;
  return logged > 0 && logged + skippedPlannedSets(active, p) >= p.sets;
}

/** Weight moved in an exercise's sets: each dumbbell of a pair and each side of a one-sided move counts. */
function movedKg(p: Prescription, sets: LoggedSet[]): number {
  const hands = p.loadType === "dumbbell_pair" ? 2 : 1;
  const sides = p.unilateral ? 2 : 1;
  return sets.reduce((kg, s) => kg + (s.loadKg ?? 0) * s.reps * hands * sides, 0);
}

/** "That's 1,080 lb lifted: about the weight of a horse." or "36 reps in the bank." */
function statFor(p: Prescription, sets: LoggedSet[], units: Units): string | null {
  const done = sets.filter((s) => !s.painFlag);
  if (done.length === 0) return null;
  if (p.loadType === "time") {
    const secs = done.reduce((t, s) => t + s.reps, 0);
    return secs >= 60 ? `${Math.floor(secs / 60)} min ${secs % 60 ? `${secs % 60} s ` : ""}of holding strong.` : `${secs} seconds of holding strong.`;
  }
  const kg = movedKg(p, done);
  if (kg > 0) {
    const amount = `${Math.round(displayLoad(kg, units)).toLocaleString("en-US")} ${units}`;
    const thing = [...HEAVY_THINGS].reverse().find(([w]) => kg >= w * 0.9);
    return thing ? `That's ${amount} lifted: about the weight of ${thing[1]}.` : `That's ${amount} lifted.`;
  }
  const reps = done.reduce((t, s) => t + s.reps, 0);
  return `${reps} reps in the bank.`;
}

/**
 * The pat on the back for finishing an exercise (its last planned set just logged). Null when
 * there's nothing to cheer: the exercise isn't done, or it hurt.
 */
export function cheerFor(active: ActiveSession, slot: string, history: SessionRecord[], units: Units): Cheer | null {
  const p = prescriptionAt(active.plan, slot);
  if (!p || !exerciseDone(active, p)) return null;
  const sets = setsForSlot(active, slot);
  if (sets.some((s) => s.painFlag)) return null;

  const all = prescriptionsOf(active.plan).filter((x) => !active.skippedSlots.includes(x.slot));
  const doneCount = all.filter((x) => exerciseDone(active, x)).length;
  const lastOne = doneCount === all.length;
  const half = all.length >= 4 && doneCount === Math.ceil(all.length / 2);

  const earlier = history.filter((r) => r.kind === "strength" && !r.skipped && r.id !== active.id);
  const before = bestOf(earlier.flatMap((r) => r.sets.filter((s) => s.exerciseId === p.exerciseId)));
  const now = bestOf(sets);
  const best = before && now && (before.loadKg !== null) === (now.loadKg !== null) && now.score > before.score + 1e-6 && p.pattern !== "core";
  const first = earlier.length > 0 && !earlier.some((r) => r.sets.some((s) => s.exerciseId === p.exerciseId));

  const seed = hash(`${active.id}|${slot}`);
  const family = findExercise(p.exerciseId)?.family ?? "";
  const lines = LINES[family] ?? LINES["general"]!;
  const fun = pick([...lines, ...LINES["general"]!.slice(0, 2)], seed >>> 3);
  const stat = statFor(p, sets, units);
  const finishNote = lastOne ? " That's every exercise. Finish when you're ready." : "";

  if (best && now) {
    const what = now.loadKg !== null ? `${loadText(now.loadKg, p.loadType, units)} × ${now.reps}` : `${now.reps} ${p.loadType === "time" ? "seconds" : "reps"}`;
    return { kind: "best", headline: "New personal best!", line: `${what} on ${p.name}: the strongest you've ever been on it.${finishNote}`, stat, lastOne };
  }
  if (first) return { kind: "first", headline: `First ${p.name} done!`, line: `A new exercise in the bag. ${fun}${finishNote}`, stat, lastOne };
  if (lastOne) return { kind: "last", headline: "Every exercise done!", line: `${fun} Finish when you're ready and take the win.`, stat, lastOne };
  if (half) return { kind: "half", headline: "Halfway there!", line: `${p.name} done. ${fun}`, stat, lastOne };
  return { kind: "done", headline: pick(HEADLINES, seed), line: `${p.name} done. ${fun}`, stat, lastOne };
}
