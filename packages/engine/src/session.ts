import { formatLoad } from "@repcurve/shared";
import type { Equipment, Exercise, Pattern, Profile, Rir, TrainingLevel } from "@repcurve/shared";
import { repRangeFor, startingLoadKg } from "./loads.js";
import { pickExercise } from "./pool.js";
import { TRANSITION_SEC, finisherMinutes, restSecondsForBudget, setSeconds, supersetSeconds, warmupMinutes } from "./timing.js";
import type { Pool, Prescription, SessionPlan, Superset, WarmupItem } from "./types.js";

/** Pattern pairs per session variant, in priority order. */
const VARIANTS: { name: string; pairs: [Pattern, Pattern][]; offsets: Partial<Record<Pattern, number>> }[] = [
  {
    name: "Full body A",
    pairs: [["squat", "horizontal_push"], ["hinge", "row"], ["vertical_push", "vertical_pull"]],
    offsets: {},
  },
  {
    name: "Full body B",
    pairs: [["hinge", "horizontal_push"], ["squat", "row"], ["vertical_push", "vertical_pull"]],
    offsets: { squat: 1, hinge: 1 },
  },
  {
    name: "Full body C",
    pairs: [["squat", "row"], ["hinge", "horizontal_push"], ["vertical_push", "isolation"]],
    offsets: { squat: 0, hinge: 0 },
  },
];

export interface StrengthSessionInput {
  profile: Profile;
  equipment: Equipment;
  level: TrainingLevel;
  pool: Pool;
  /** 0-based index of this strength session within the week. */
  strengthIndex: number;
  week: number;
  dayIndex: number;
  rounds: number;
  /** Cap on rounds when spending leftover time. Defaults by level. */
  maxRounds?: number;
  /** Cap on supersets, used to make a ramp week mirror the steady structure. */
  maxSupersets?: number;
  benchmark: boolean;
  e1rmByExercise: Record<string, number>;
}

interface Chosen {
  exercise: Exercise;
  repRange: [number, number];
}

const TARGET_RIR: Rir = 2;

function prescribe(c: Chosen, input: StrengthSessionInput, sets: number): Prescription {
  const loadKg = startingLoadKg(
    c.exercise,
    input.profile,
    input.equipment,
    input.level,
    c.repRange,
    TARGET_RIR,
    input.e1rmByExercise[c.exercise.id],
  );
  const p: Prescription = {
    exerciseId: c.exercise.id,
    name: c.exercise.name,
    pattern: c.exercise.pattern,
    loadType: c.exercise.loadType,
    unilateral: c.exercise.unilateral,
    sets,
    repRange: c.repRange,
    loadKg,
    loadDisplay: formatLoad(loadKg, c.exercise.loadType, input.profile.units),
    targetRir: TARGET_RIR,
    benchmarkSet: input.benchmark && c.exercise.loadType !== "time" && !input.e1rmByExercise[c.exercise.id],
  };
  if (c.exercise.cue) p.cue = c.exercise.cue;
  return p;
}

/**
 * Bodyweight ladders start with regression rungs (incline and knee push-ups),
 * so anyone with some training history starts one rung higher.
 */
function bodyweightBoost(input: StrengthSessionInput): number {
  return input.profile.trainingHistory === "never" ? 0 : 1;
}

function choosePair(
  pair: [Pattern, Pattern],
  variant: (typeof VARIANTS)[number],
  input: StrengthSessionInput,
  used: Set<string>,
): Chosen[] | null {
  const chosen: Chosen[] = [];
  for (const pattern of pair) {
    const ex = pickExercise(input.pool, pattern, input.level, input.strengthIndex, variant.offsets[pattern] ?? 0, used, bodyweightBoost(input));
    if (!ex) continue;
    used.add(ex.id);
    chosen.push({ exercise: ex, repRange: repRangeFor(ex, input.level) });
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
  const restSec = restSecondsForBudget(budget);

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
      items: chosen.map((c) => prescribe(c, input, rounds)),
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
      finisher = prescribe({ exercise: core, repRange }, { ...input, benchmark: false }, sets);
    }
  }

  const supersetMin = supersets.reduce((s, ss) => s + ss.estimatedSec, 0) / 60;
  const estimatedMinutes = Math.round((warmupMin + supersetMin + (finisher ? finisherMin : 0)) * 10) / 10;

  return {
    id: `w${input.week}d${input.dayIndex + 1}`,
    week: input.week,
    dayIndex: input.dayIndex,
    kind: "strength",
    name: variant.name,
    budgetMinutes: budget,
    estimatedMinutes,
    warmupMinutes: warmupMin,
    warmup: warmupFor(pairsChosen[0]),
    supersets,
    finisher,
    cardio: null,
  };
}
