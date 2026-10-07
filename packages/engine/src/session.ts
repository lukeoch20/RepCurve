import { loadUnitsFor } from "@repcurve/shared";
import type { Equipment, Exercise, Pattern, Profile, TrainingLevel } from "@repcurve/shared";
import { repRangeFor, startingLoadKg, startingTargetReps } from "./loads.js";
import { pickExercise } from "./pool.js";
import { TARGET_RIR, buildPrescription, defaultTargetReps } from "./prescribe.js";
import { TRANSITION_SEC, finisherMinutes, finisherSeconds, finisherSets, restSecondsForBudget, supersetSeconds, warmupMinutes } from "./timing.js";
import type { Pool, Prescription, SessionPlan, Superset, WarmupItem } from "./types.js";

interface Variant {
  key: string;
  name: string;
  pairs: [Pattern, Pattern][];
  offsets: Partial<Record<Pattern, number>>;
}

/** Pattern pairs per session variant, in priority order. */
export const VARIANTS: Variant[] = [
  {
    key: "A",
    name: "Full body A",
    pairs: [["squat", "horizontal_push"], ["hinge", "row"], ["vertical_push", "vertical_pull"]],
    offsets: {},
  },
  {
    key: "B",
    name: "Full body B",
    pairs: [["hinge", "horizontal_push"], ["squat", "row"], ["vertical_push", "vertical_pull"]],
    offsets: { squat: 1, hinge: 1 },
  },
  {
    key: "C",
    name: "Full body C",
    pairs: [["squat", "row"], ["hinge", "horizontal_push"], ["vertical_push", "isolation"]],
    offsets: {},
  },
];

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

function choosePair(
  pair: [Pattern, Pattern],
  variant: Variant,
  input: StrengthSessionInput,
  used: Set<string>,
  /** Patterns already in this session, which a stand-in should not repeat. */
  taken: Set<Pattern>,
): Chosen[] | null {
  const chosen: Chosen[] = [];
  const pick = (pattern: Pattern, offset: number) =>
    pickExercise(input.pool, pattern, input.level, input.strengthIndex, offset, used, bodyweightBoost(input), (e) =>
      chosen.every((c) => !sharesPrimeMover(c.exercise, e)),
    );
  for (const pattern of pair) {
    const ex = pick(pattern, variant.offsets[pattern] ?? 0);
    if (!ex) continue;
    used.add(ex.id);
    chosen.push(choose(ex, `${variant.key}.${pattern}`, input));
  }
  if (chosen.length === 1) {
    // Pair the lone exercise with another movement rather than run a one-exercise superset.
    // A movement not yet in the session is preferred; a second exercise of one already in it is next best.
    const order = [...FALLBACK_PATTERNS.filter((p) => !taken.has(p)), ...FALLBACK_PATTERNS.filter((p) => taken.has(p))];
    for (const pattern of order) {
      if (pair.includes(pattern)) continue;
      const ex = pick(pattern, 0);
      if (!ex) continue;
      used.add(ex.id);
      chosen.push(choose(ex, `${variant.key}.${pattern}.alt`, input));
      break;
    }
  }
  return chosen.length > 0 ? chosen : null;
}

function warmupFor(first: Chosen[] | undefined): WarmupItem[] {
  const items: WarmupItem[] = [{ name: "Easy movement", prescription: "30 s marching, arm circles, hip circles" }];
  for (const c of first ?? []) {
    items.push({ name: `${c.exercise.name} (light)`, prescription: "1 easy set of 8, bodyweight or lightest dumbbell" });
  }
  return items;
}

export function buildStrengthSession(input: StrengthSessionInput): SessionPlan {
  const budget = input.profile.minutesPerSession;
  const variant = VARIANTS[input.strengthIndex % VARIANTS.length]!;
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

  const tryAdd = (pair: [Pattern, Pattern], rounds: number, force = false): boolean => {
    if (input.maxSupersets !== undefined && supersets.length >= input.maxSupersets) return false;
    const chosen = choosePair(pair, variant, input, used, taken);
    if (!chosen) return false;
    const secs = supersetSeconds(chosen.map(timed), rounds, transitionSec, restSec);
    if (secs > remainingSec && !force) {
      for (const c of chosen) used.delete(c.exercise.id);
      return false;
    }
    for (const c of chosen) taken.add(c.exercise.pattern);
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
    warmup: warmupFor(pairsChosen[0]),
    supersets,
    finisher,
    cardio: null,
    deload: false,
    comeback: false,
    ...(notes.length > 0 ? { notes } : {}),
  };
}
