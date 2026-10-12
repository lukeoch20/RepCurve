import { loadUnitsFor } from "@repcurve/shared";
import type { Equipment, Exercise, Muscle, Pattern, Profile, Split, TrainingLevel } from "@repcurve/shared";
import { repRangeFor, startingLoadKg, startingTargetReps } from "./loads.js";
import { pickExercise } from "./pool.js";
import { TARGET_RIR, buildPrescription, defaultTargetReps } from "./prescribe.js";
import { TRANSITION_SEC, finisherMinutes, finisherSeconds, finisherSets, restSecondsForBudget, setupSeconds, supersetSeconds, warmupMinutes } from "./timing.js";
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
}

const iso = (family: string): SlotSpec => ({ pattern: "isolation", family });
const lunge: SlotSpec = { pattern: "squat", family: "lunge" };
const bridge: SlotSpec = { pattern: "hinge", family: "bridge" };

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
    pairs: [[lunge, "vertical_push"], [iso("knee_flexion"), "row"], ["horizontal_push", "vertical_pull"]],
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
  extra: [[bridge, iso("hip_abduction")], ["squat", "hinge"]],
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
      // Mostly upper body: one squat pair, then presses with triceps and lateral raises.
      pairs: [["horizontal_push", "squat"], ["vertical_push", iso("triceps")], ["horizontal_push", iso("lateral_raise")]],
      extra: [["vertical_push", lunge], [iso("knee_extension"), iso("calf")]],
      offsets: {},
      fallback: PUSH_FALLBACK,
      allowShared: true,
    },
    {
      key: "pull",
      name: "Pull day",
      // Mostly upper body: one hinge pair, pulls with biceps, and a hamstring curl.
      pairs: [["row", "hinge"], ["vertical_pull", iso("biceps")], ["row", iso("knee_flexion")]],
      extra: [[iso("rear_delt"), iso("calf")], ["vertical_pull", "row"]],
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
      extra: [[iso("lateral_raise"), iso("rear_delt")], ["row", "vertical_push"]],
      offsets: {},
      fallback: UPPER_FALLBACK,
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

/** The core finisher rotates through the trunk's jobs: resisting extension, flexing, resisting side-bending and rotation. */
const CORE_FAMILIES = ["anti_extension", "trunk_flexion", "anti_lateral", "anti_rotation"];

const sharesPrimeMover = (a: Exercise, b: Exercise) => a.primary.some((m) => b.primary.includes(m));

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
): Chosen[] | null {
  const chosen: Chosen[] = [];
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
      (e) => (pattern !== "isolation" || !family || e.family === family) && (variant.allowShared === true || chosen.every((c) => !sharesPrimeMover(c.exercise, e))),
      family,
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
    const secs = supersetSeconds(chosen.map(timed), rounds, transitionSec, restSec) + setupSeconds(chosen.map((c) => c.exercise));
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
    warmup: warmupFor(pairsChosen[0]),
    supersets,
    finisher,
    cardio: null,
    deload: false,
    comeback: false,
    ...(notes.length > 0 ? { notes } : {}),
    ...(coverageNotes(input.pool).length > 0 ? { coverage: coverageNotes(input.pool) } : {}),
  };
}
