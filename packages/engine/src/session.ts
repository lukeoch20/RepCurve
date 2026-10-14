import { getExercise } from "@repcurve/exercises";
import { loadUnitsFor } from "@repcurve/shared";
import type { Equipment, Exercise, Muscle, Pattern, Profile, Split, TrainingLevel } from "@repcurve/shared";
import { volumeCeiling, volumeTarget } from "./level.js";
import { MUSCLES, emptyVolume } from "./volume.js";
import { repRangeFor, startingLoadKg, startingTargetReps } from "./loads.js";
import { pickExercise } from "./pool.js";
import { TARGET_RIR, buildPrescription, defaultTargetReps } from "./prescribe.js";
import {
  RAMP_SET_SEC,
  TRANSITION_SEC,
  finisherMinutes,
  finisherSeconds,
  finisherSets,
  restSecondsForBudget,
  setupSeconds,
  supersetSeconds,
  warmupMinutes,
} from "./timing.js";
import type { Pool, Prescription, SessionPlan, Superset, WarmupItem } from "./types.js";

/**
 * A place in a pair: a movement, optionally a family within it. For isolation the family is the job
 * (curls for biceps, lateral raises, hamstring curls); for compound movements it's a preference
 * (a lunge rather than a squat, a bridge rather than a Romanian deadlift).
 */
export type SlotSpec = Pattern | { pattern: Pattern; family: string };
type Pair = [SlotSpec, SlotSpec];

interface Variant {
  key: string;
  name: string;
  pairs: Pair[];
  /** Pairs added only when today's time goes beyond the full session (all pairs at their most rounds). */
  extra: Pair[];
  offsets: Partial<Record<Pattern, number>>;
  /** Movements that can stand in when one side of a pair has no exercise the user can do. */
  fallback?: Pattern[];
  /** Pairs may share a prime mover (a leg day pairs squats with hinges). */
  allowShared?: boolean;
  /**
   * Muscles this day may add pairs for when the week is short on them, and the slots that train
   * them. Split days keep to their own muscles (no hinges on push day); full body takes any.
   */
  fills?: Partial<Record<Muscle, SlotSpec[]>>;
}

const iso = (family: string): SlotSpec => ({ pattern: "isolation", family });
const lunge: SlotSpec = { pattern: "squat", family: "lunge" };
const bridge: SlotSpec = { pattern: "hinge", family: "bridge" };

/** Slots that train each muscle, best first, for pairs added because the week is short on it. */
const FILL_SLOTS: Partial<Record<Muscle, SlotSpec[]>> = {
  chest: ["horizontal_push"],
  back: ["row", "vertical_pull"],
  quads: [lunge, iso("knee_extension"), "squat"],
  hamstrings: [iso("knee_flexion"), { pattern: "hinge", family: "rdl" }],
  glutes: [bridge, iso("hip_abduction"), lunge],
  shoulders: [iso("lateral_raise"), iso("rear_delt"), "vertical_push"],
  triceps: [iso("triceps")],
  biceps: [iso("biceps")],
  calves: [iso("calf")],
};
const PUSH_FILLS: Partial<Record<Muscle, SlotSpec[]>> = {
  chest: FILL_SLOTS.chest!, shoulders: [iso("lateral_raise"), "vertical_push"], triceps: FILL_SLOTS.triceps!, quads: [iso("knee_extension"), lunge, "squat"], calves: FILL_SLOTS.calves!,
};
const PULL_FILLS: Partial<Record<Muscle, SlotSpec[]>> = {
  back: FILL_SLOTS.back!, biceps: FILL_SLOTS.biceps!, shoulders: [iso("rear_delt")], hamstrings: FILL_SLOTS.hamstrings!, glutes: [bridge, iso("hip_abduction")], calves: FILL_SLOTS.calves!,
};
const UPPER_FILLS: Partial<Record<Muscle, SlotSpec[]>> = {
  chest: FILL_SLOTS.chest!, back: FILL_SLOTS.back!, shoulders: FILL_SLOTS.shoulders!, triceps: FILL_SLOTS.triceps!, biceps: FILL_SLOTS.biceps!,
};
const LOWER_FILLS: Partial<Record<Muscle, SlotSpec[]>> = {
  quads: FILL_SLOTS.quads!, hamstrings: FILL_SLOTS.hamstrings!, glutes: FILL_SLOTS.glutes!, calves: FILL_SLOTS.calves!,
};

/**
 * Pattern pairs per session variant, in priority order. Hamstrings get a knee-flexion exercise
 * (a curl or walkout) as well as hinges, and shoulders get lateral and rear work, per the 2026
 * evidence review; pairs avoid two exercises that compete for the same muscles.
 */
export const VARIANTS: Variant[] = [
  {
    key: "A",
    name: "Full body A",
    pairs: [["squat", "horizontal_push"], ["hinge", "row"], ["vertical_push", "vertical_pull"]],
    extra: [[iso("lateral_raise"), iso("calf")], [iso("knee_flexion"), iso("biceps")]],
    offsets: {},
  },
  {
    key: "B",
    name: "Full body B",
    // The press comes before the overhead press: in a short session only the first two pairs fit,
    // and every full-body day already has overhead pressing or presses that work the shoulders.
    pairs: [[lunge, "horizontal_push"], [iso("knee_flexion"), "row"], ["vertical_push", "vertical_pull"]],
    extra: [[iso("triceps"), iso("calf")], [bridge, iso("rear_delt")]],
    offsets: {},
  },
  {
    key: "C",
    name: "Full body C",
    pairs: [["squat", "row"], ["hinge", "horizontal_push"], ["vertical_push", iso("knee_flexion")]],
    extra: [[iso("lateral_raise"), iso("biceps")], [iso("calf"), iso("triceps")]],
    offsets: {},
  },
];

const PUSH_FALLBACK: Pattern[] = ["horizontal_push", "vertical_push", "squat", "core"];
// Core work is the last resort on a split day with little equipment (no bar, bands, bench or dumbbells).
const PULL_FALLBACK: Pattern[] = ["row", "vertical_pull", "hinge", "isolation", "core"];
const UPPER_FALLBACK: Pattern[] = ["horizontal_push", "row", "vertical_push", "vertical_pull", "core"];
const LOWER_FALLBACK: Pattern[] = ["squat", "hinge", "core"];

const LOWER: Omit<Variant, "key" | "name"> = {
  pairs: [["squat", "hinge"], [lunge, iso("knee_flexion")], [iso("knee_extension"), iso("calf")]],
  extra: [[bridge, iso("hip_abduction")]],
  offsets: {},
  fallback: LOWER_FALLBACK,
  allowShared: true,
  fills: LOWER_FILLS,
};

/** The session variants each split rotates through. */
export const SPLIT_VARIANTS: Record<Split, Variant[]> = {
  full_body: VARIANTS,
  push_pull: [
    {
      key: "push",
      name: "Push day",
      // Mostly upper body: one squat pair, then two presses (chest gets as much as back does on pull
      // day, which rows and pulls down in its first two pairs), then triceps and lateral raises.
      pairs: [["horizontal_push", "squat"], ["vertical_push", "horizontal_push"], [iso("triceps"), iso("lateral_raise")]],
      extra: [[iso("knee_extension"), iso("calf")], [lunge, "horizontal_push"]],
      offsets: {},
      fallback: PUSH_FALLBACK,
      allowShared: true,
      fills: PUSH_FILLS,
    },
    {
      key: "pull",
      name: "Pull day",
      // Rows and pull-downs come first, so back gets what chest gets on push day; the hamstring curl
      // pairs with calves rather than a third back exercise (shoulders get plenty on push day).
      pairs: [["row", "hinge"], ["vertical_pull", iso("biceps")], [iso("knee_flexion"), iso("calf")]],
      extra: [[iso("rear_delt"), bridge]],
      offsets: {},
      fallback: PULL_FALLBACK,
      allowShared: true,
      fills: PULL_FILLS,
    },
  ],
  upper_lower: [
    {
      key: "upper",
      name: "Upper body",
      pairs: [["horizontal_push", "row"], ["vertical_push", "vertical_pull"], [iso("biceps"), iso("triceps")]],
      // A longer upper day adds a second press (incline or another kind) before more pulling: the
      // usual upper day already has two pulls to one press.
      extra: [["horizontal_push", iso("lateral_raise")], [iso("rear_delt"), "vertical_pull"]],
      offsets: {},
      fallback: UPPER_FALLBACK,
      fills: UPPER_FILLS,
    },
    { key: "lower", name: "Lower body", ...LOWER },
  ],
  ppl: [
    {
      key: "ppl-push",
      name: "Push day",
      pairs: [["horizontal_push", "vertical_push"], ["horizontal_push", iso("triceps")], ["vertical_push", iso("lateral_raise")]],
      extra: [["horizontal_push", "vertical_push"]],
      offsets: {},
      fallback: ["horizontal_push", "vertical_push", "core"],
      allowShared: true,
      fills: { chest: FILL_SLOTS.chest!, shoulders: [iso("lateral_raise"), "vertical_push"], triceps: FILL_SLOTS.triceps! },
    },
    {
      key: "ppl-pull",
      name: "Pull day",
      pairs: [["row", "vertical_pull"], ["row", iso("biceps")], ["hinge", iso("rear_delt")]],
      extra: [["row", "vertical_pull"]],
      offsets: {},
      // Deadlift-style hinges belong on pull day when there's little to pull with.
      fallback: PULL_FALLBACK,
      allowShared: true,
      fills: { back: FILL_SLOTS.back!, biceps: FILL_SLOTS.biceps!, shoulders: [iso("rear_delt")] },
    },
    { key: "legs", name: "Leg day", ...LOWER },
  ],
};

export function variantsFor(split: Split | undefined): Variant[] {
  return SPLIT_VARIANTS[split ?? "full_body"];
}

export interface StrengthSessionInput {
  profile: Profile;
  equipment: Equipment;
  /** Onboarding level: exercise choice, rep ranges, starting loads. */
  level: TrainingLevel;
  /** Level the session's volume is set for (weekly target and ceiling, most rounds). Defaults to `level`. */
  volumeLevel?: TrainingLevel;
  /** The split in use (push/pull/legs needs three lifting days). Defaults to the profile's. */
  split?: Split;
  pool: Pool;
  /** 0-based position in the session sequence. */
  index: number;
  /** 0-based index of this strength session within the week. */
  strengthIndex: number;
  week: number;
  dayIndex: number;
  rounds: number;
  /** Which variant of the split this session is (counts strength sessions across weeks). Defaults to strengthIndex. */
  rotation?: number;
  /** Cap on rounds when spending leftover time. Defaults by level. */
  maxRounds?: number;
  /** Rest after each round, seconds. Defaults by time budget. */
  restSec?: number;
  /** Seconds between exercises within a round. Defaults to TRANSITION_SEC. */
  transitionSec?: number;
  benchmark: boolean;
  e1rmByExercise: Record<string, number>;
  /**
   * Hard sets per muscle the rest of the week already has. The session fills toward the muscles
   * furthest below the weekly target, and keeps each muscle's week within the ceiling.
   */
  weekOthers?: Record<Muscle, number>;
  /**
   * Only the session's main structure: its opening pairs at the planned rounds, time allowing. The
   * week keeps room for this when it plans the sessions before it.
   */
  baselineOnly?: boolean;
  /** Start from this plan (the usual session) and add to it: a long day is the usual session plus more. */
  start?: SessionPlan;
  /** Use each slot's alternate exercise (every other training block, for people past the novice stage). */
  alternate?: boolean;
  /** Movement patterns the rest of the week already trains. */
  weekPatterns?: Pattern[];
}

interface Chosen {
  exercise: Exercise;
  repRange: [number, number];
  /** Reps (or seconds) each set is planned at; sets are timed from this. */
  targetReps: number;
  slot: string;
}

function choose(exercise: Exercise, slot: string, input: StrengthSessionInput): Chosen {
  const repRange = repRangeFor(exercise, input.level);
  const targetReps = input.e1rmByExercise[exercise.id] ? startingTargetReps(repRange) : defaultTargetReps(repRange, exercise.loadType);
  return { exercise, repRange, targetReps, slot };
}

const timed = (c: Chosen) => ({ exercise: c.exercise, repRange: c.repRange, reps: c.targetReps });

function prescribe(c: Chosen, input: StrengthSessionInput, sets: number, benchmark: boolean): Prescription {
  const e1rm = input.e1rmByExercise[c.exercise.id];
  const loadKg = startingLoadKg(c.exercise, input.profile, input.equipment, input.level, c.repRange, TARGET_RIR, e1rm);
  const targetReps = c.targetReps;
  return buildPrescription({
    exercise: c.exercise,
    slot: c.slot,
    sets,
    repRange: c.repRange,
    targetReps,
    loadKg,
    benchmarkSet: benchmark && c.exercise.loadType !== "time" && !e1rm,
    units: loadUnitsFor(input.profile, input.equipment),
  });
}

/**
 * Bodyweight ladders start with regression rungs (incline and knee push-ups),
 * so anyone with some training history starts one rung higher.
 */
function bodyweightBoost(input: StrengthSessionInput): number {
  return input.profile.trainingHistory === "never" ? 0 : 1;
}

/** Patterns that can stand in when one side of a pair has no exercise the user can do. */
const FALLBACK_PATTERNS: Pattern[] = ["row", "horizontal_push", "squat", "hinge", "vertical_push", "vertical_pull", "isolation"];

/** The core finisher rotates through the trunk's jobs: resisting extension, flexing, resisting side-bending and rotation. */
const CORE_FAMILIES = ["anti_extension", "trunk_flexion", "anti_lateral", "anti_rotation"];

/** Adds `sets` sets of each exercise to a per-muscle tally: 1 for a prime mover, 0.5 for an assisting muscle. */
function addVolume(volume: Record<Muscle, number>, exercises: Exercise[], sets: number): void {
  for (const e of exercises) {
    for (const m of e.primary) volume[m] += sets;
    for (const m of e.secondary) volume[m] += sets * 0.5;
  }
}

const sharesPrimeMover = (a: Exercise, b: Exercise) => a.primary.some((m) => b.primary.includes(m));

/** Barbell lifts taken from a rack (squats, bench press). */
export const needsRack = (e: Exercise): boolean => e.requires.some((alt) => alt.includes("rack"));

/**
 * A heavy barbell lift after the first superset gets one light warm-up set first: the general
 * warm-up only covers the opening exercises.
 */
export function needsRampSet(e: Pick<Exercise, "loadType" | "pattern">, supersetIndex: number): boolean {
  return supersetIndex > 0 && e.loadType === "barbell" && e.pattern !== "isolation" && e.pattern !== "core";
}

/** Seconds of warm-up sets a superset at this position needs. */
export function rampSeconds(exercises: Pick<Exercise, "loadType" | "pattern">[], supersetIndex: number): number {
  return exercises.filter((e) => needsRampSet(e, supersetIndex)).length * RAMP_SET_SEC;
}

const specPattern = (s: SlotSpec): Pattern => (typeof s === "string" ? s : s.pattern);
const specFamily = (s: SlotSpec): string | undefined => (typeof s === "string" ? undefined : s.family);
const specName = (s: SlotSpec): string => (typeof s === "string" ? s : `${s.pattern}.${s.family}`);

function choosePair(
  pair: Pair,
  variant: Variant,
  input: StrengthSessionInput,
  used: Set<string>,
  /** Patterns already in this session, which a stand-in should not repeat. */
  taken: Set<Pattern>,
  /** Slot names start with this, e.g. "A" or "A.extra1". */
  slotKey: string = variant.key,
  /** Ladders already in the session, which an added pair should not draw from again (an easier push-up). */
  excludeLadders?: Set<string>,
  /** Stand-ins must train the day's own muscles (pairs added to a split day; an opening takes what it can). */
  strictSplit = false,
): Chosen[] | null {
  const chosen: Chosen[] = [];
  // One rack per pair: two barbell lifts that each need a rack (squats and bench press) would hold
  // two stations at once in a busy gym.
  const stationOk = (e: Exercise) => !(needsRack(e) && chosen.some((c) => needsRack(c.exercise)));
  const ladderOk = (e: Exercise) => !excludeLadders?.has(e.ladder);
  // A stand-in partner is a different kind of exercise (not a second glute bridge), and on a split
  // day it trains one of the day's muscles (no triceps or calves on pull day).
  const kindOk = (e: Exercise) =>
    chosen.every((c) => c.exercise.pattern !== e.pattern || c.exercise.family !== e.family) &&
    (!strictSplit || !variant.fills || e.primary.some((m) => variant.fills![m] !== undefined));
  // A movement already in the session comes from another ladder (dumbbell press after push-ups, not an easier push-up).
  // An isolation slot must be its family (a curl is not a lateral raise); for compound movements the family is a preference.
  const pick = (pattern: Pattern, offset: number, family?: string) =>
    pickExercise(
      input.pool,
      pattern,
      input.level,
      input.strengthIndex + (taken.has(pattern) ? 1 : 0),
      offset,
      used,
      bodyweightBoost(input),
      (e) =>
        (pattern !== "isolation" || !family || e.family === family) &&
        (variant.allowShared === true || chosen.every((c) => !sharesPrimeMover(c.exercise, e))) &&
        stationOk(e) &&
        ladderOk(e),
      family,
      input.alternate === true,
    );
  pair.forEach((spec, i) => {
    const pattern = specPattern(spec);
    const ex = pick(pattern, variant.offsets[pattern] ?? 0, specFamily(spec));
    if (!ex) return;
    used.add(ex.id);
    // A pair of the same movement (two arm exercises) needs two slot names.
    const name = specName(spec);
    const slot = specName(pair[0]) === specName(pair[1]) ? `${slotKey}.${name}${i + 1}` : `${slotKey}.${name}`;
    chosen.push(choose(ex, slot, input));
  });
  if (chosen.length === 0) {
    // Nothing in the pair fits the equipment (no pull-up bar, no machine): the day still gets a
    // pair from its own movements, preferring ones not yet in the session.
    const moves = (variant.fallback ?? FALLBACK_PATTERNS).filter((p) => p !== "core");
    for (const pattern of [...moves.filter((p) => !taken.has(p)), ...moves.filter((p) => taken.has(p))]) {
      const ex = pick(pattern, 0);
      if (!ex) continue;
      used.add(ex.id);
      chosen.push(choose(ex, `${slotKey}.${pattern}.alt`, input));
      break;
    }
  }
  if (chosen.length === 1) {
    // Pair the lone exercise with another movement rather than run a one-exercise superset.
    // A movement not yet in the session is preferred; a second exercise of one already in it is next best.
    const fallback = variant.fallback ?? FALLBACK_PATTERNS;
    const inPair = pair.map(specPattern);
    // Core work is the last resort: a second leg or upper-body movement comes first.
    const moves = fallback.filter((p) => p !== "core");
    const order = [...moves.filter((p) => !taken.has(p)), ...moves.filter((p) => taken.has(p)), ...(fallback.includes("core") ? ["core" as Pattern] : [])];
    const partner = (shareOk: boolean) => {
      for (const pattern of order) {
        if (inPair.includes(pattern) && !variant.fallback) continue;
        const ex = shareOk
          ? pickExercise(input.pool, pattern, input.level, input.strengthIndex, 0, used, bodyweightBoost(input), (e) => stationOk(e) && ladderOk(e) && kindOk(e), undefined, input.alternate === true)
          : pickExercise(
              input.pool,
              pattern,
              input.level,
              input.strengthIndex + (taken.has(pattern) ? 1 : 0),
              0,
              used,
              bodyweightBoost(input),
              (e) => (variant.allowShared === true || chosen.every((c) => !sharesPrimeMover(c.exercise, e))) && stationOk(e) && ladderOk(e) && kindOk(e),
              undefined,
              input.alternate === true,
            );
        if (!ex) continue;
        used.add(ex.id);
        chosen.push(choose(ex, `${slotKey}.${pattern}.alt`, input));
        return true;
      }
      return false;
    };
    // On a split day, a partner working the same muscles beats a one-exercise superset.
    if (!partner(false) && variant.fallback) partner(true);
  }
  return chosen.length > 0 ? chosen : null;
}

/** A short general warm-up, then an easy practice set of the first exercises. A rope is never required. */
function warmupFor(first: Chosen[] | undefined): WarmupItem[] {
  const items: WarmupItem[] = [{ name: "Easy movement", prescription: "30 s marching, arm circles, hip circles" }];
  for (const c of first ?? []) {
    const light = c.exercise.loadType === "bodyweight" || c.exercise.loadType === "time" ? "an easier version" : "a light weight";
    items.push({ name: `${c.exercise.name} (light)`, prescription: `1 easy set of 8 with ${light}` });
  }
  return items;
}

/** What the equipment can't cover, said plainly with the smallest step that would. */
export function coverageNotes(pool: Pool): string[] {
  const planned = [...pool.byLadder.values()].flat();
  const notes: string[] = [];
  if (!planned.some((e) => e.pattern === "row" || e.pattern === "vertical_pull")) {
    notes.push(
      "Nothing you have trains pulling (rows and pulldowns) with weight you can increase. The smallest fix is resistance bands with a door anchor: they add band rows and pulldowns. Add them under equipment in Settings.",
    );
  }
  return notes;
}

/** The main movement patterns a week should train (as the plan explanation reports). */
export const MAIN_PATTERNS: Pattern[] = ["squat", "hinge", "horizontal_push", "vertical_push", "row"];

/** Most supersets in one session: past five, setup and switching eat the time. */
export const MAX_SUPERSETS = 5;

/** How much each muscle counts when deciding what to add: big movers first, calves last. Core has its finisher. */
const MUSCLE_WEIGHT: Record<Muscle, number> = {
  quads: 1, glutes: 1, hamstrings: 1, chest: 1, back: 1, shoulders: 1, triceps: 0.6, biceps: 0.6, calves: 0.4, core: 0,
};

/**
 * Worth of a week's hard sets for one muscle: full value up to the bottom of the target, half to
 * the top, a little more to the ceiling, nothing past it (the dose-response flattens).
 */
function setsValue(sets: number, [lo, hi]: [number, number], ceiling: number): number {
  const clampTo = (x: number, max: number) => Math.max(0, Math.min(x, max));
  return clampTo(sets, lo) + 0.5 * clampTo(sets - lo, hi - lo) + 0.15 * clampTo(sets - hi, ceiling - hi);
}

const familyKey = (e: Exercise) => `${e.pattern}:${e.family}`;

/** Most exercises of one family (all presses, all rows) a session of this day type may have. */
export const maxPerFamily = (variant: Pick<Variant, "fills">, pattern: Pattern): number => (variant.fills && pattern !== "isolation" ? 3 : 2);

export function buildStrengthSession(input: StrengthSessionInput): SessionPlan {
  const budget = input.profile.minutesPerSession;
  const budgetSec = budget * 60;
  const variants = variantsFor(input.split ?? input.profile.split);
  const variant = variants[(input.rotation ?? input.strengthIndex) % variants.length]!;
  const used = new Set<string>();
  const restSec = input.restSec ?? restSecondsForBudget(budget);
  const transitionSec = input.transitionSec ?? TRANSITION_SEC;
  const notes: string[] = [];
  const volumeLevel = input.volumeLevel ?? input.level;
  const target = volumeTarget(volumeLevel);
  const ceiling = volumeCeiling(volumeLevel);
  const others = input.weekOthers ?? emptyVolume();

  // The core finisher is planned first so its real length, not a flat reservation, comes off the budget.
  let finisher: Prescription | null = null;
  let finisherSec = 0;
  if (input.start?.finisher) {
    finisher = { ...input.start.finisher };
    used.add(finisher.exerciseId);
    finisherSec = finisherSeconds(getExercise(finisher.exerciseId), finisher.repRange, finisher.sets, finisher.targetReps);
  } else if (finisherMinutes(budget) > 0) {
    // (A long day whose usual session was too short for a finisher gets one now.)
    const family = CORE_FAMILIES[input.strengthIndex % CORE_FAMILIES.length];
    const core = pickExercise(input.pool, "core", input.level, input.strengthIndex, 0, used, bodyweightBoost(input), () => true, family);
    if (core) {
      used.add(core.id);
      const c = choose(core, `${variant.key}.core`, input);
      const sets = finisherSets(core, c.repRange, budget, c.targetReps);
      finisher = prescribe(c, input, sets, false);
      finisherSec = finisherSeconds(core, c.repRange, sets, c.targetReps);
    }
  }
  const warmupMin = input.start ? input.start.warmupMinutes : warmupMinutes(budget);

  const supersets: Superset[] = [];
  const pairsChosen: Chosen[][] = [];
  const maxRounds = input.maxRounds ?? (volumeLevel === "novice" ? 3 : 4);
  const minRounds = Math.min(2, input.rounds);
  const taken = new Set<Pattern>();
  const slots = new Set<string>();

  const timedItems = (i: number) => pairsChosen[i]!.map((c, j) => ({ ...timed(c), sets: supersets[i]!.items[j]!.sets }));
  const supersetSec = (i: number) =>
    supersetSeconds(timedItems(i), supersets[i]!.rounds, supersets[i]!.transitionSec, supersets[i]!.restSec) +
    setupSeconds(pairsChosen[i]!.map((c) => c.exercise)) +
    rampSeconds(pairsChosen[i]!.map((c) => c.exercise), i);
  const usedSec = () => warmupMin * 60 + finisherSec + supersets.reduce((sum, _, i) => sum + supersetSec(i), 0);

  /** Hard sets per muscle in the session so far (1 for a prime mover, 0.5 for an assisting muscle). */
  const sessionVolume = (): Record<Muscle, number> => {
    const v = emptyVolume();
    if (finisher) addVolume(v, [getExercise(finisher.exerciseId)], finisher.sets);
    supersets.forEach((ss, i) => ss.items.forEach((p, j) => addVolume(v, [pairsChosen[i]![j]!.exercise], p.sets)));
    return v;
  };
  const weekValue = (v: Record<Muscle, number>) =>
    MUSCLES.reduce((sum, m) => sum + MUSCLE_WEIGHT[m] * setsValue(others[m] + v[m], target, ceiling), 0);
  /** Muscles a change would take past the week's ceiling (only muscles it adds to count). */
  const overCeiling = (before: Record<Muscle, number>, after: Record<Muscle, number>): Muscle[] =>
    MUSCLES.filter((m) => m !== "core" && after[m] > before[m] + 1e-9 && others[m] + after[m] > ceiling + 1e-9);
  /** Muscles held back by the ceiling while time was left, for the note. */
  const heldBack = new Set<Muscle>();

  const setSets = (i: number, sets: number[]) => {
    const ss = supersets[i]!;
    ss.items.forEach((p, j) => (p.sets = sets[j]!));
    ss.rounds = Math.max(...sets);
  };
  /** Accept the last superset added: its patterns count as taken and its slot names are made unique. */
  const commitLast = () => {
    const i = supersets.length - 1;
    pairsChosen[i]!.forEach((c, j) => {
      taken.add(c.exercise.pattern);
      // A split day can use a movement in two pairs (two squats on push day): slot names stay unique.
      let slot = c.slot;
      for (let n = 2; slots.has(slot); n++) slot = `${c.slot}.${n}`;
      c.slot = slot;
      supersets[i]!.items[j]!.slot = slot;
      slots.add(slot);
    });
  };
  const pushSuperset = (chosen: Chosen[], rounds: number) => {
    for (const c of chosen) used.add(c.exercise.id);
    pairsChosen.push(chosen);
    supersets.push({
      label: String.fromCharCode("A".charCodeAt(0) + supersets.length),
      rounds,
      items: chosen.map((c) => prescribe(c, input, rounds, input.benchmark)),
      transitionSec,
      restSec,
      estimatedSec: 0,
    });
  };
  const popSuperset = () => {
    const chosen = pairsChosen.pop()!;
    supersets.pop();
    for (const c of chosen) used.delete(c.exercise.id);
  };

  if (input.start) {
    // The usual session, kept as it is; the extra time goes on top.
    for (const ss of input.start.supersets) {
      const chosen = ss.items.map((p) => ({ exercise: getExercise(p.exerciseId), repRange: p.repRange, targetReps: p.targetReps, slot: p.slot }));
      for (const c of chosen) {
        used.add(c.exercise.id);
        taken.add(c.exercise.pattern);
        slots.add(c.slot);
      }
      pairsChosen.push(chosen);
      supersets.push({ ...ss, items: ss.items.map((p) => ({ ...p })) });
    }
  } else {
    // 1. The opening pairs (the main patterns) at the fewest rounds, so breadth wins in tiny budgets.
    // This is the least the session does, and the week keeps room for it.
    // An opening pair still respects the week's ceiling (a sixth short session in a week); with too
    // little room for its usual rounds it opens with fewer.
    let openingFound = false;
    /** Set when an opening pair didn't fit the time (not the week's ceiling). */
    let openingOutOfTime = false;
    const tryOpening = (pair: Pair, rounds: number, force: boolean): boolean => {
      const chosen = choosePair(pair, variant, input, used, taken);
      if (!chosen) return false;
      openingFound = true;
      for (const c of chosen) used.delete(c.exercise.id);
      for (let r = rounds; r >= 1; r--) {
        const before = sessionVolume();
        pushSuperset(chosen.map((c) => ({ ...c })), r);
        const over = overCeiling(before, sessionVolume());
        if (force || (usedSec() <= budgetSec + 1e-9 && over.length === 0)) {
          commitLast();
          return true;
        }
        popSuperset();
        if (over.length === 0) {
          openingOutOfTime = true;
          break;
        }
        over.forEach((m) => heldBack.add(m));
      }
      return false;
    };
    const openingPairs = variant.pairs.slice(0, 2);
    for (const pair of openingPairs) tryOpening(pair, minRounds, false);
    // With nothing the day's own movements can use (bodyweight only, several injuries), any
    // movement that can be done beats an empty session.
    if (supersets.length === 0 && !openingFound) {
      const anyMoves: Pattern[] = [...FALLBACK_PATTERNS, "core"];
      const found: Chosen[] = [];
      for (const pattern of anyMoves) {
        for (let k = 0; k < 2 && found.length < 2; k++) {
          const e = pickExercise(input.pool, pattern, input.level, input.strengthIndex, 0, new Set([...used, ...found.map((c) => c.exercise.id)]), bodyweightBoost(input));
          if (!e || found.some((c) => c.exercise.family === e.family && c.exercise.pattern === e.pattern)) break;
          found.push(choose(e, `${variant.key}.${pattern}.alt`, input));
        }
        if (found.length >= 2) break;
      }
      if (found.length > 0) {
        for (let r = minRounds; r >= 1 && supersets.length === 0; r--) {
          pushSuperset(found.map((c) => ({ ...c })), r);
          if (usedSec() <= budgetSec + 1e-9) commitLast();
          else popSuperset();
        }
      }
    }
    // A strength session always has at least one pair, even when rest and switch settings leave no room.
    if (supersets.length === 0) {
      for (const pair of openingPairs) if (tryOpening(pair, 1, true)) break;
      // Only the clock is the rest and switch settings' doing; a full week is said in the closing note.
      if (supersets.length > 0 && openingOutOfTime) {
        notes.push(
          `Your rest (${restSec} s) and switch (${transitionSec} s) settings leave little room in ${budget} minutes, so this session is one superset, one round. Shorter rests in Settings fit more work.`,
        );
      }
    }
  }

  /** One more set of the exercises in `which` (indexes into superset i), if time and the ceiling allow. */
  const growOption = (i: number, which: number[]): { gain: number; secs: number; apply: () => void; over: Muscle[] } | null => {
    const ss = supersets[i]!;
    const before = ss.items.map((p) => p.sets);
    const after = before.map((n, j) => (which.includes(j) ? n + 1 : n));
    if (Math.max(...after) > maxRounds || Math.max(...after) - Math.min(...after) > 1) return null;
    const vBefore = sessionVolume();
    const secBefore = usedSec();
    setSets(i, after);
    const vAfter = sessionVolume();
    const secs = usedSec() - secBefore;
    const fits = usedSec() <= budgetSec + 1e-9;
    const over = overCeiling(vBefore, vAfter);
    const gain = weekValue(vAfter) - weekValue(vBefore);
    setSets(i, before);
    if (!fits) return null;
    return { gain, secs, apply: () => setSets(i, after), over };
  };

  /** Options for one more set in superset i: a whole round, or (when the ceiling stops a whole round) one exercise's set. */
  const growOptions = (i: number) => {
    const sets = supersets[i]!.items.map((p) => p.sets);
    const top = Math.max(...sets);
    const behind = sets.map((n, j) => (n < top ? j : -1)).filter((j) => j >= 0);
    if (behind.length > 0) return behind.map((j) => growOption(i, [j]));
    const whole = growOption(i, sets.map((_, j) => j));
    if (!whole || whole.over.length === 0 || sets.length === 1) return [whole];
    // The ceiling stops the whole round: the exercise whose muscles have room can still do one more set.
    return sets.map((_, j) => growOption(i, [j]));
  };

  /** Grow every superset round by round up to `cap`, in order, while it fits (the planned structure). */
  const growTo = (cap: number) => {
    let added = true;
    while (added) {
      added = false;
      supersets.forEach((ss, i) => {
        if (ss.rounds >= cap) return;
        for (const o of growOptions(i)) {
          if (!o) continue;
          if (o.over.length > 0) {
            o.over.forEach((m) => heldBack.add(m));
            continue;
          }
          o.apply();
          added = true;
          return;
        }
      });
    }
  };

  if (!input.start) growTo(input.rounds);

  // 3. Fill what is left, a step at a time, with whatever adds the most for the time it takes: another
  // round, the day's next pair, or a pair for the muscles furthest below this week's target.
  // The day's own pairs are preferred a little (they keep each day recognisable), and each is added once.
  const designed = [
    ...variant.pairs.slice(2).map((pair, i) => ({ pair, bonus: 1.2, key: variant.key, id: `pair${i}` })),
    ...variant.extra.map((pair, i) => ({ pair, bonus: 1.1, key: `${variant.key}.extra${i + 1}`, id: `extra${i}` })),
  ];
  // A long day starts from the usual session: the day's own pairs it already has count as added
  // (the day's main pairs carry the day's key; added and extra pairs carry ".fill" and ".extra").
  const designedDone = new Set<string>();
  if (input.start) {
    const plain = input.start.supersets.filter((ss) => ss.items.every((p) => p.slot.startsWith(`${variant.key}.`) && !p.slot.includes(".fill") && !p.slot.includes(".extra"))).length;
    designed.forEach((d) => {
      const n = Number(d.id.replace(/\D/g, ""));
      if (d.id.startsWith("pair") && n + 2 < plain) designedDone.add(d.id);
      if (d.id.startsWith("extra") && input.start!.supersets.some((ss) => ss.items.some((p) => p.slot.startsWith(`${d.key}.`)))) designedDone.add(d.id);
    });
  }

  type PairOption = { rounds: number; gain: number; secs: number; over: Muscle[]; apply: () => void };
  /** Ways to add a pair now (at the planned rounds, or the fewest), with what each gains and costs. */
  const pairOptions = (cand: { pair: Pair; key: string; id?: string }, ladders: Set<string>, families: Map<string, number>): PairOption[] => {
    const chosen = choosePair(cand.pair, variant, input, used, taken, cand.key, ladders, true);
    if (!chosen) return [];
    for (const c of chosen) used.delete(c.exercise.id);
    // An added pair is a real pair (a one-exercise superset is only for when nothing else fits the
    // opening), and core work stays in the finisher.
    if (chosen.length < 2 || chosen.some((c) => c.exercise.pattern === "core")) return [];
    // At most two of one kind of exercise in a full-body session (no third squat); a split day,
    // built around a few muscles, may have three of a main movement (flat, incline and machine
    // presses on push day), never three of one isolation exercise.
    const counts = new Map(families);
    for (const c of chosen) {
      const k = familyKey(c.exercise);
      counts.set(k, (counts.get(k) ?? 0) + 1);
      if (counts.get(k)! > maxPerFamily(variant, c.exercise.pattern) || used.has(c.exercise.id)) return [];
    }
    const out: PairOption[] = [];
    for (const rounds of input.rounds > minRounds ? [input.rounds, minRounds] : [input.rounds]) {
      const r = Math.min(rounds, maxRounds);
      const vBefore = sessionVolume();
      const secBefore = usedSec();
      pushSuperset(chosen.map((c) => ({ ...c })), r);
      const vAfter = sessionVolume();
      const secs = usedSec() - secBefore;
      const fits = usedSec() <= budgetSec + 1e-9;
      const over = overCeiling(vBefore, vAfter);
      const gain = weekValue(vAfter) - weekValue(vBefore);
      popSuperset();
      if (!fits) continue;
      out.push({
        rounds: r,
        gain,
        secs,
        over,
        apply: () => {
          pushSuperset(chosen.map((c) => ({ ...c })), r);
          commitLast();
          if (cand.id) designedDone.add(cand.id);
        },
      });
    }
    return out;
  };
  const sessionLadders = () => new Set(pairsChosen.flat().map((c) => c.exercise.ladder));
  const sessionFamilies = () => {
    const families = new Map<string, number>();
    for (const c of pairsChosen.flat()) families.set(familyKey(c.exercise), (families.get(familyKey(c.exercise)) ?? 0) + 1);
    return families;
  };

  // The day's own third pair comes next when it carries a main movement the week would otherwise
  // miss (overhead pressing when four rounds of the others would fill the time): more rounds of
  // other exercises don't replace a movement.
  if (!input.baselineOnly) {
    const inWeek = new Set<Pattern>([...(input.weekPatterns ?? []), ...pairsChosen.flat().map((c) => c.exercise.pattern)]);
    for (const d of designed.filter((x) => x.id.startsWith("pair") && !designedDone.has(x.id))) {
      if (!d.pair.some((spec) => MAIN_PATTERNS.includes(specPattern(spec)) && !inWeek.has(specPattern(spec)))) continue;
      // At the fewest rounds: it's there for the movement; the fill below adds rounds if they're worth it.
      const option = pairOptions(d, sessionLadders(), sessionFamilies())
        .filter((o) => o.over.length === 0)
        .sort((a, b) => a.rounds - b.rounds)[0];
      if (option) option.apply();
    }
  }

  let fills = 0;
  while (!input.baselineOnly) {
    type Option = { score: number; apply: () => void };
    let best: Option | null = null;
    const consider = (gain: number, secs: number, over: Muscle[], apply: () => void, bonus = 1) => {
      if (over.length > 0) {
        over.forEach((m) => heldBack.add(m));
        return;
      }
      if (gain <= 1e-9 || secs <= 0) return;
      const score = (gain * bonus) / secs;
      if (!best || score > best.score + 1e-12) best = { score, apply };
    };
    supersets.forEach((_, i) => {
      for (const o of growOptions(i)) if (o) consider(o.gain, o.secs, o.over, o.apply);
    });
    if (supersets.length < MAX_SUPERSETS) {
      const vNow = sessionVolume();
      // Muscles that most need sets this week, for pairs added on their account.
      const slope = (m: Muscle) => {
        const x = others[m] + vNow[m];
        const per = x < target[0] ? 1 : x < target[1] ? 0.5 : x < ceiling ? 0.15 : 0;
        return MUSCLE_WEIGHT[m] * per;
      };
      const fillSlots = variant.fills ?? FILL_SLOTS;
      const needy = MUSCLES.filter((m) => fillSlots[m] && slope(m) > 0).sort(
        (a, b) => slope(b) - slope(a) || others[a] + vNow[a] - (others[b] + vNow[b]) || MUSCLES.indexOf(a) - MUSCLES.indexOf(b),
      );
      const candidates: { pair: Pair; bonus: number; key: string; id?: string }[] = designed.filter((d) => !designedDone.has(d.id));
      for (const m of needy.slice(0, 3)) {
        for (const partner of needy.filter((x) => x !== m).slice(0, 3)) {
          for (const spec of fillSlots[m]!.slice(0, 2)) candidates.push({ pair: [spec, fillSlots[partner]![0]!], bonus: 1, key: `${variant.key}.fill` });
        }
      }
      const ladders = sessionLadders();
      const families = sessionFamilies();
      for (const cand of candidates) {
        for (const o of pairOptions(cand, ladders, families)) consider(o.gain, o.secs, o.over, o.apply, cand.bonus);
      }
    }
    if (!best) break;
    (best as Option).apply();
    if (++fills > 60) break;
  }

  supersets.forEach((ss, i) => (ss.estimatedSec = supersetSec(i)));
  const estimatedMinutes = Math.round((usedSec() / 60) * 10) / 10;
  if (!input.baselineOnly && estimatedMinutes <= budget - 3) {
    const spare = "A walk or easy cardio is a good use of the spare minutes.";
    const week = sessionVolume();
    const full = [...heldBack].filter((m) => others[m] + week[m] >= 0.9 * ceiling - 1e-9);
    if (full.length > 0) {
      notes.push(
        `About ${Math.round(estimatedMinutes)} of your ${budget} minutes, on purpose: your ${listMuscles(full)} already get close to ${ceiling} hard sets this week, the most that helps at your stage, and more would add soreness rather than strength. ${spare}`,
      );
    } else if (supersets.every((ss) => ss.rounds >= maxRounds)) {
      notes.push(`About ${Math.round(estimatedMinutes)} of your ${budget} minutes, on purpose: every exercise today is at its most sets. ${spare}`);
    } else {
      notes.push(`About ${Math.round(estimatedMinutes)} of your ${budget} minutes, on purpose: that is all the useful work today's plan has room for this week. ${spare}`);
    }
  }

  return {
    id: `w${input.week}d${input.dayIndex + 1}`,
    index: input.index,
    week: input.week,
    dayIndex: input.dayIndex,
    kind: "strength",
    variant: variant.key,
    name: variant.name,
    budgetMinutes: budget,
    estimatedMinutes,
    warmupMinutes: warmupMin,
    warmup: input.start ? input.start.warmup : warmupFor(pairsChosen[0]),
    supersets,
    finisher,
    cardio: null,
    deload: false,
    comeback: false,
    ...(notes.length > 0 ? { notes } : {}),
    ...(coverageNotes(input.pool).length > 0 ? { coverage: coverageNotes(input.pool) } : {}),
  };
}

const MUSCLE_NAMES: Record<Muscle, string> = {
  quads: "quads", glutes: "glutes", hamstrings: "hamstrings", chest: "chest", shoulders: "shoulders",
  triceps: "triceps", biceps: "biceps", back: "back", core: "core", calves: "calves",
};

function listMuscles(ms: Muscle[]): string {
  const names = ms.map((m) => MUSCLE_NAMES[m]);
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * A brand-new lifter's first week: the same session with one set fewer of everything, and a note
 * saying why it is short.
 */
export function rampOf(session: SessionPlan): SessionPlan {
  const supersets = session.supersets.map((ss) => {
    const items = ss.items.map((p) => ({ ...p, sets: Math.max(1, p.sets - 1) }));
    const rounds = Math.max(...items.map((p) => p.sets));
    const timedItems = items.map((p) => ({ exercise: getExercise(p.exerciseId), repRange: p.repRange, reps: p.targetReps, sets: p.sets }));
    const exercises = timedItems.map((t) => t.exercise);
    const index = session.supersets.indexOf(ss);
    return {
      ...ss,
      rounds,
      items,
      estimatedSec: supersetSeconds(timedItems, rounds, ss.transitionSec, ss.restSec) + setupSeconds(exercises) + rampSeconds(exercises, index),
    };
  });
  const finisherSec = session.finisher
    ? finisherSeconds(getExercise(session.finisher.exerciseId), session.finisher.repRange, session.finisher.sets, session.finisher.targetReps)
    : 0;
  const estimatedMinutes = Math.round(((session.warmupMinutes * 60 + finisherSec + supersets.reduce((s, ss) => s + ss.estimatedSec, 0)) / 60) * 10) / 10;
  const notes = (session.notes ?? []).filter((n) => !n.includes("on purpose"));
  if (estimatedMinutes <= session.budgetMinutes - 3) {
    notes.push(
      `About ${Math.round(estimatedMinutes)} of your ${session.budgetMinutes} minutes, on purpose: week 1 is a round lighter while you learn the moves and find your weights. From week 2, sessions fill your time.`,
    );
  }
  const { notes: _old, ...rest } = session;
  return { ...rest, supersets, estimatedMinutes, ...(notes.length > 0 ? { notes } : {}) };
}
