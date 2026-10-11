import { loadUnitsFor } from "@repcurve/shared";
import type { Equipment, Exercise, Muscle, Pattern, Profile, Split, TrainingLevel } from "@repcurve/shared";
import { repRangeFor, startingLoadKg, startingTargetReps } from "./loads.js";
import { pickExercise } from "./pool.js";
import { TARGET_RIR, buildPrescription, defaultTargetReps } from "./prescribe.js";
import { TRANSITION_SEC, finisherMinutes, finisherSeconds, finisherSets, restSecondsForBudget, supersetSeconds, warmupMinutes } from "./timing.js";
import type { Pool, Prescription, SessionPlan, Superset, WarmupItem } from "./types.js";

/** A place in a pair: a movement, optionally narrowed to one muscle (curls for biceps, raises for shoulders). */
export type SlotSpec = Pattern | { pattern: Pattern; muscle: Muscle };
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
}

const iso = (muscle: Muscle): SlotSpec => ({ pattern: "isolation", muscle });

/** Pattern pairs per session variant, in priority order. */
export const VARIANTS: Variant[] = [
  {
    key: "A",
    name: "Full body A",
    pairs: [["squat", "horizontal_push"], ["hinge", "row"], ["vertical_push", "vertical_pull"]],
    extra: [["isolation", "isolation"], ["squat", "horizontal_push"]],
    offsets: {},
  },
  {
    key: "B",
    name: "Full body B",
    pairs: [["hinge", "horizontal_push"], ["squat", "row"], ["vertical_push", "vertical_pull"]],
    extra: [["isolation", "isolation"], ["hinge", "horizontal_push"]],
    offsets: { squat: 1, hinge: 1 },
  },
  {
    key: "C",
    name: "Full body C",
    pairs: [["squat", "row"], ["hinge", "horizontal_push"], ["vertical_push", "isolation"]],
    extra: [["isolation", "isolation"], ["squat", "row"]],
    offsets: {},
  },
];

const PUSH_FALLBACK: Pattern[] = ["horizontal_push", "vertical_push", "squat", "core"];
// Core work is the last resort on a split day with little equipment (no bar, bands, bench or dumbbells).
const PULL_FALLBACK: Pattern[] = ["row", "vertical_pull", "hinge", "core"];
const UPPER_FALLBACK: Pattern[] = ["horizontal_push", "row", "vertical_push", "vertical_pull", "core"];
const LOWER_FALLBACK: Pattern[] = ["squat", "hinge", "core"];

const LOWER: Omit<Variant, "key" | "name"> = {
  pairs: [["squat", "hinge"], ["squat", "hinge"], ["squat", iso("calves")]],
  extra: [["hinge", "squat"], ["squat", "hinge"]],
  offsets: {},
  fallback: LOWER_FALLBACK,
  allowShared: true,
};

/** The session variants each split rotates through. */
export const SPLIT_VARIANTS: Record<Split, Variant[]> = {
  full_body: VARIANTS,
  push_pull: [
    {
      key: "push",
      name: "Push day",
      // Mostly upper body: one squat pair, then presses with triceps and shoulders.
      pairs: [["horizontal_push", "squat"], ["vertical_push", iso("triceps")], ["horizontal_push", iso("shoulders")]],
      extra: [["vertical_push", "squat"], ["horizontal_push", iso("calves")]],
      offsets: {},
      fallback: PUSH_FALLBACK,
      allowShared: true,
    },
    {
      key: "pull",
      name: "Pull day",
      // Mostly upper body: one hinge pair, then pulls with biceps and another row.
      pairs: [["row", "hinge"], ["vertical_pull", iso("biceps")], ["row", "hinge"]],
      extra: [["row", iso("calves")], ["vertical_pull", "row"]],
      offsets: {},
      fallback: PULL_FALLBACK,
      allowShared: true,
    },
  ],
  upper_lower: [
    {
      key: "upper",
      name: "Upper body",
      pairs: [["horizontal_push", "row"], ["vertical_push", "vertical_pull"], [iso("biceps"), iso("triceps")]],
      extra: [[iso("shoulders"), "horizontal_push"], ["row", "vertical_push"]],
      offsets: {},
      fallback: UPPER_FALLBACK,
    },
    { key: "lower", name: "Lower body", ...LOWER },
  ],
  ppl: [
    {
      key: "ppl-push",
      name: "Push day",
      pairs: [["horizontal_push", "vertical_push"], ["horizontal_push", iso("triceps")], ["vertical_push", iso("shoulders")]],
      extra: [["horizontal_push", "vertical_push"]],
      offsets: {},
      fallback: ["horizontal_push", "vertical_push", "core"],
      allowShared: true,
    },
    {
      key: "ppl-pull",
      name: "Pull day",
      pairs: [["row", "vertical_pull"], ["row", iso("biceps")], ["hinge", "row"]],
      extra: [["row", "vertical_pull"]],
      offsets: {},
      // Deadlift-style hinges belong on pull day when there's little to pull with.
      fallback: PULL_FALLBACK,
      allowShared: true,
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
  level: TrainingLevel;
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
  /** Cap on supersets, used to make a ramp week mirror the steady structure. */
  maxSupersets?: number;
  /** Rest after each round, seconds. Defaults by time budget. */
  restSec?: number;
  /** Seconds between exercises within a round. Defaults to TRANSITION_SEC. */
  transitionSec?: number;
  benchmark: boolean;
  e1rmByExercise: Record<string, number>;
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

const sharesPrimeMover = (a: Exercise, b: Exercise) => a.primary.some((m) => b.primary.includes(m));

const specPattern = (s: SlotSpec): Pattern => (typeof s === "string" ? s : s.pattern);
const specName = (s: SlotSpec): string => (typeof s === "string" ? s : `${s.pattern}.${s.muscle}`);

function choosePair(
  pair: Pair,
  variant: Variant,
  input: StrengthSessionInput,
  used: Set<string>,
  /** Patterns already in this session, which a stand-in should not repeat. */
  taken: Set<Pattern>,
  /** Slot names start with this, e.g. "A" or "A.extra1". */
  slotKey: string = variant.key,
): Chosen[] | null {
  const chosen: Chosen[] = [];
  // A movement already in the session comes from another ladder (dumbbell press after push-ups, not an easier push-up).
  const pick = (pattern: Pattern, offset: number, muscle?: Muscle) =>
    pickExercise(input.pool, pattern, input.level, input.strengthIndex + (taken.has(pattern) ? 1 : 0), offset, used, bodyweightBoost(input), (e) =>
      (!muscle || e.primary.includes(muscle)) && (variant.allowShared === true || chosen.every((c) => !sharesPrimeMover(c.exercise, e))),
    );
  pair.forEach((spec, i) => {
    const pattern = specPattern(spec);
    const ex = pick(pattern, variant.offsets[pattern] ?? 0, typeof spec === "string" ? undefined : spec.muscle);
    if (!ex) return;
    used.add(ex.id);
    // A pair of the same movement (two arm exercises) needs two slot names.
    const name = specName(spec);
    const slot = specName(pair[0]) === specName(pair[1]) ? `${slotKey}.${name}${i + 1}` : `${slotKey}.${name}`;
    chosen.push(choose(ex, slot, input));
  });
  if (chosen.length === 1) {
    // Pair the lone exercise with another movement rather than run a one-exercise superset.
    // A movement not yet in the session is preferred; a second exercise of one already in it is next best.
    const fallback = variant.fallback ?? FALLBACK_PATTERNS;
    const inPair = pair.map(specPattern);
    const order = [...fallback.filter((p) => !taken.has(p)), ...fallback.filter((p) => taken.has(p))];
    const partner = (shareOk: boolean) => {
      for (const pattern of order) {
        if (inPair.includes(pattern) && !variant.fallback) continue;
        const ex = shareOk
          ? pickExercise(input.pool, pattern, input.level, input.strengthIndex, 0, used, bodyweightBoost(input))
          : pick(pattern, 0);
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

function warmupFor(first: Chosen[] | undefined, equipment: StrengthSessionInput["equipment"]): WarmupItem[] {
  const items: WarmupItem[] = [
    equipment.jumpRope
      ? { name: "Easy jump rope", prescription: "1 min of light bounces, then arm and hip circles" }
      : { name: "Easy movement", prescription: "30 s marching, arm circles, hip circles" },
  ];
  for (const c of first ?? []) {
    items.push({ name: `${c.exercise.name} (light)`, prescription: "1 easy set of 8, bodyweight or lightest dumbbell" });
  }
  return items;
}

export function buildStrengthSession(input: StrengthSessionInput): SessionPlan {
  const budget = input.profile.minutesPerSession;
  const variants = variantsFor(input.profile.split);
  const variant = variants[(input.rotation ?? input.strengthIndex) % variants.length]!;
  const used = new Set<string>();
  const restSec = input.restSec ?? restSecondsForBudget(budget);
  const transitionSec = input.transitionSec ?? TRANSITION_SEC;
  const notes: string[] = [];

  // The core finisher is planned first so its real length, not a flat reservation, comes off the budget.
  let finisher: Prescription | null = null;
  let finisherSec = 0;
  if (finisherMinutes(budget) > 0) {
    const core = pickExercise(input.pool, "core", input.level, input.strengthIndex, 0, used, bodyweightBoost(input));
    if (core) {
      used.add(core.id);
      const c = choose(core, `${variant.key}.core`, input);
      const sets = finisherSets(core, c.repRange, budget, c.targetReps);
      finisher = prescribe(c, input, sets, false);
      finisherSec = finisherSeconds(core, c.repRange, sets, c.targetReps);
    }
  }

  const warmupMin = warmupMinutes(budget);
  let remainingSec = (budget - warmupMin) * 60 - finisherSec;

  const supersets: Superset[] = [];
  const pairsChosen: Chosen[][] = [];
  const maxRounds = input.maxRounds ?? (input.level === "novice" ? 3 : 4);
  const minRounds = Math.min(2, input.rounds);
  const taken = new Set<Pattern>();

  const slots = new Set<string>();
  const tryAdd = (pair: Pair, rounds: number, force = false, slotKey?: string): boolean => {
    if (input.maxSupersets !== undefined && supersets.length >= input.maxSupersets) return false;
    const chosen = choosePair(pair, variant, input, used, taken, slotKey);
    if (!chosen) return false;
    const secs = supersetSeconds(chosen.map(timed), rounds, transitionSec, restSec);
    if (secs > remainingSec && !force) {
      for (const c of chosen) used.delete(c.exercise.id);
      return false;
    }
    for (const c of chosen) {
      taken.add(c.exercise.pattern);
      // A split day can use a movement in two pairs (two squats on push day): slot names stay unique.
      let slot = c.slot;
      for (let n = 2; slots.has(slot); n++) slot = `${c.slot}.${n}`;
      c.slot = slot;
      slots.add(slot);
    }
    remainingSec -= secs;
    pairsChosen.push(chosen);
    supersets.push({
      label: String.fromCharCode("A".charCodeAt(0) + supersets.length),
      rounds,
      items: chosen.map((c) => prescribe(c, input, rounds, input.benchmark)),
      transitionSec,
      restSec,
      estimatedSec: secs,
    });
    return true;
  };

  /** Add one round to supersets in order, while they fit and are below `cap`. */
  const grow = (cap: number): void => {
    let added = true;
    while (added) {
      added = false;
      supersets.forEach((ss, i) => {
        if (ss.rounds >= cap) return;
        const extra = supersetSeconds(pairsChosen[i]!.map(timed), 1, transitionSec, restSec);
        if (extra <= remainingSec) {
          ss.rounds += 1;
          ss.estimatedSec += extra;
          for (const p of ss.items) p.sets = ss.rounds;
          remainingSec -= extra;
          added = true;
        }
      });
    }
  };

  // 1. Core pairs (the four main patterns) at the minimum rounds, so breadth wins in tiny budgets.
  const corePairs = variant.pairs.slice(0, 2);
  const extraPairs = variant.pairs.slice(2);
  for (const pair of corePairs) tryAdd(pair, minRounds);
  // A strength session always has at least one pair, even when rest and switch settings leave no room.
  if (supersets.length === 0) {
    for (const pair of corePairs) if (tryAdd(pair, 1, true)) break;
    if (supersets.length > 0) {
      notes.push(
        `Your rest (${restSec} s) and switch (${transitionSec} s) settings leave little room in ${budget} minutes, so this session is one superset, one round. Shorter rests in Settings fit more work.`,
      );
    }
  }
  // 2. Grow the core pairs to the planned rounds.
  grow(input.rounds);
  // 3. A third pair if there is still room, at planned rounds or at least two.
  for (const pair of extraPairs) {
    if (!tryAdd(pair, input.rounds) && input.rounds > minRounds) tryAdd(pair, minRounds);
  }
  // 4. Spend what is left on extra rounds, up to the cap.
  grow(maxRounds);
  // 5. More time than the full session needs (a long day): more exercises, then their rounds.
  // These come after everything above, so sessions that fit the usual budget never change.
  variant.extra.forEach((pair, i) => {
    const slotKey = `${variant.key}.extra${i + 1}`;
    if (tryAdd(pair, input.rounds, false, slotKey)) return;
    if (input.rounds > minRounds && tryAdd(pair, minRounds, false, slotKey)) return;
    // Every pair at its most rounds and a little time left: a last round of the latest pair
    // makes way for another exercise, rather than leaving the time unused.
    if (!supersets.every((ss) => ss.rounds >= maxRounds)) return;
    const last = [...supersets].reverse().find((ss) => ss.rounds > input.rounds);
    if (!last) return;
    const at = supersets.indexOf(last);
    const round = supersetSeconds(pairsChosen[at]!.map(timed), 1, transitionSec, restSec);
    const setRounds = (n: number, sec: number) => {
      last.rounds = n;
      last.estimatedSec += sec;
      for (const p of last.items) p.sets = n;
      remainingSec -= sec;
    };
    setRounds(last.rounds - 1, -round);
    if (!tryAdd(pair, minRounds, false, slotKey)) setRounds(last.rounds + 1, round);
  });
  grow(maxRounds);

  const supersetMin = supersets.reduce((s, ss) => s + ss.estimatedSec, 0) / 60;
  const estimatedMinutes = Math.round((warmupMin + supersetMin + finisherSec / 60) * 10) / 10;

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
    warmup: warmupFor(pairsChosen[0], input.equipment),
    supersets,
    finisher,
    cardio: null,
    deload: false,
    comeback: false,
    ...(notes.length > 0 ? { notes } : {}),
  };
}
