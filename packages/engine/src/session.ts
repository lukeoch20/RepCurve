import type { Equipment, Exercise, Pattern, Profile, TrainingLevel } from "@repcurve/shared";
import { repRangeFor, startingLoadKg, startingTargetReps } from "./loads.js";
import { pickExercise } from "./pool.js";
import { TARGET_RIR, buildPrescription, defaultTargetReps } from "./prescribe.js";
import { TRANSITION_SEC, finisherMinutes, restSecondsForBudget, setSeconds, supersetSeconds, warmupMinutes } from "./timing.js";
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
  benchmark: boolean;
  e1rmByExercise: Record<string, number>;
}

interface Chosen {
  exercise: Exercise;
  repRange: [number, number];
  slot: string;
}

function prescribe(c: Chosen, input: StrengthSessionInput, sets: number, benchmark: boolean): Prescription {
  const e1rm = input.e1rmByExercise[c.exercise.id];
  const loadKg = startingLoadKg(c.exercise, input.profile, input.equipment, input.level, c.repRange, TARGET_RIR, e1rm);
  const targetReps = e1rm ? startingTargetReps(c.repRange) : defaultTargetReps(c.repRange, c.exercise.loadType);
  return buildPrescription({
    exercise: c.exercise,
    slot: c.slot,
    sets,
    repRange: c.repRange,
    targetReps,
    loadKg,
    benchmarkSet: benchmark && c.exercise.loadType !== "time" && !e1rm,
    units: input.profile.units,
  });
}

/**
 * Bodyweight ladders start with regression rungs (incline and knee push-ups),
 * so anyone with some training history starts one rung higher.
 */
function bodyweightBoost(input: StrengthSessionInput): number {
  return input.profile.trainingHistory === "never" ? 0 : 1;
}

function choosePair(pair: [Pattern, Pattern], variant: Variant, input: StrengthSessionInput, used: Set<string>): Chosen[] | null {
  const chosen: Chosen[] = [];
  for (const pattern of pair) {
    const ex = pickExercise(input.pool, pattern, input.level, input.strengthIndex, variant.offsets[pattern] ?? 0, used, bodyweightBoost(input));
    if (!ex) continue;
    used.add(ex.id);
    chosen.push({ exercise: ex, repRange: repRangeFor(ex, input.level), slot: `${variant.key}.${pattern}` });
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

  const warmupMin = warmupMinutes(budget);
  const finisherMin = finisherMinutes(budget);
  let remainingSec = (budget - warmupMin - finisherMin) * 60;

  const supersets: Superset[] = [];
  const pairsChosen: Chosen[][] = [];
  const maxRounds = input.maxRounds ?? (input.level === "novice" ? 3 : 4);
  const minRounds = Math.min(2, input.rounds);

  const tryAdd = (pair: [Pattern, Pattern], rounds: number): boolean => {
    if (input.maxSupersets !== undefined && supersets.length >= input.maxSupersets) return false;
    const chosen = choosePair(pair, variant, input, used);
    if (!chosen) return false;
    const items = chosen.map((c) => ({ exercise: c.exercise, repRange: c.repRange }));
    const secs = supersetSeconds(items, rounds, TRANSITION_SEC, restSec);
    if (secs > remainingSec) {
      for (const c of chosen) used.delete(c.exercise.id);
      return false;
    }
    remainingSec -= secs;
    pairsChosen.push(chosen);
    supersets.push({
      label: String.fromCharCode("A".charCodeAt(0) + supersets.length),
      rounds,
      items: chosen.map((c) => prescribe(c, input, rounds, input.benchmark)),
      transitionSec: TRANSITION_SEC,
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
        const items = pairsChosen[i]!.map((c) => ({ exercise: c.exercise, repRange: c.repRange }));
        const extra = supersetSeconds(items, 1, TRANSITION_SEC, restSec);
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
  // 2. Grow the core pairs to the planned rounds.
  grow(input.rounds);
  // 3. A third pair if there is still room, at planned rounds or at least two.
  for (const pair of extraPairs) {
    if (!tryAdd(pair, input.rounds) && input.rounds > minRounds) tryAdd(pair, minRounds);
  }
  // 4. Spend what is left on extra rounds, up to the cap.
  grow(maxRounds);

  let finisher: Prescription | null = null;
  if (finisherMin > 0) {
    const core = pickExercise(input.pool, "core", input.level, input.strengthIndex, 0, used, bodyweightBoost(input));
    if (core) {
      const repRange = repRangeFor(core, input.level);
      const sets = Math.max(1, Math.min(3, Math.floor((finisherMin * 60) / (setSeconds(core, repRange) + 30))));
      finisher = prescribe({ exercise: core, repRange, slot: `${variant.key}.core` }, input, sets, false);
    }
  }

  const supersetMin = supersets.reduce((s, ss) => s + ss.estimatedSec, 0) / 60;
  const estimatedMinutes = Math.round((warmupMin + supersetMin + (finisher ? finisherMin : 0)) * 10) / 10;

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
  };
}
