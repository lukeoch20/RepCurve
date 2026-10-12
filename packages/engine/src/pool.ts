import { EXERCISES } from "@repcurve/exercises";
import { canLoad, meetsRequirements } from "@repcurve/shared";
import type { Equipment, Exercise, Injury, Pattern, Profile, TrainingLevel } from "@repcurve/shared";
import type { LoadClass, Pool } from "./types.js";

export const classOf = (e: Exercise): LoadClass =>
  e.loadType === "dumbbell_pair" || e.loadType === "single_dumbbell" ? "dumbbell" : e.loadType === "time" ? "bodyweight" : e.loadType;

/** True when the equipment includes anything you'd only find in a gym. */
export function hasGymEquipment(equipment: Equipment): boolean {
  return equipment.barbell === true || equipment.cables === true || (equipment.machines?.length ?? 0) > 0;
}

/**
 * Which kinds of loading the planner tries first. Machines, cables and free weights are parallel
 * choices: a gym newcomer gets a coherent machine-based plan, someone with training behind them
 * whose goal is strength or muscle practises the barbell lifts, and a home plan leans on whatever
 * can be loaded progressively.
 */
export function classOrder(equipment: Equipment, profile?: Pick<Profile, "trainingHistory" | "goal">): LoadClass[] {
  if (!hasGymEquipment(equipment)) return ["dumbbell", "barbell", "machine", "cable", "band", "bodyweight"];
  const experienced = profile !== undefined && (profile.trainingHistory === "regular" || profile.trainingHistory === "lapsed") && profile.goal !== "fitness";
  return experienced
    ? ["barbell", "dumbbell", "machine", "cable", "band", "bodyweight"]
    : ["machine", "cable", "dumbbell", "barbell", "band", "bodyweight"];
}

/**
 * Exercises the user can do with what they have and without aggravating anything. Every one of
 * them can be chosen in a swap; only "default" exercises are planned automatically, and the
 * ladders (progression tracks) hold only those. Retired exercises stay in the library for history.
 */
export function buildPool(equipment: Equipment, injuries: Injury[], profile?: Pick<Profile, "trainingHistory" | "goal">): Pool {
  const exercises = EXERCISES.filter(
    (e) =>
      e.tier !== "retired" &&
      meetsRequirements(e.requires, equipment) &&
      canLoad(e.loadType, equipment) &&
      !e.avoidWith.some((i) => injuries.includes(i)),
  );
  const byLadder = new Map<string, Exercise[]>();
  for (const e of exercises) {
    if (e.tier !== "default") continue;
    const list = byLadder.get(e.ladder) ?? [];
    list.push(e);
    byLadder.set(e.ladder, list);
  }
  for (const list of byLadder.values()) list.sort((a, b) => a.ladderLevel - b.ladderLevel);
  return { exercises, byLadder, classOrder: classOrder(equipment, profile) };
}

/** Exercises the planner may pick on its own. */
export const plannable = (pool: Pool): Exercise[] => [...pool.byLadder.values()].flat();

/** Tie-break between ladders of the same family and loading, most generally useful first. */
const LADDER_ORDER = [
  "squat_machine", "squat_bb", "squat_db", "squat_bw",
  "lunge_db", "lunge_bw_supported", "lunge_bw", "lunge_bw_reverse", "stepup_bw",
  "hinge_bb", "hinge_db", "hinge_band", "bridge_bb", "bridge_db", "bridge_bw",
  "hpush_machine", "hpush_bb", "hpush_db", "hpush_db_incline", "hpush_bw", "hpush_knee",
  "vpush_machine", "vpush_db",
  "row_cable", "row_db_supported", "row_db", "row_band", "row_suspension",
  "vpull_machine", "vpull_assisted_machine", "vpull_assisted_band", "vpull_bar", "vpull_band",
  "lateral_db", "rear_delt_db", "curl_db", "triceps_pressdown", "triceps_cable_overhead", "triceps_db",
  "leg_extension", "leg_curl_seated", "hamstring_bw", "calf_machine", "calf_db", "calf_bw", "abduction_bw",
  "core_floor", "core_flexion", "core_side", "core_pallof",
];
const orderOf = (ladder: string) => {
  const i = LADDER_ORDER.indexOf(ladder);
  return i === -1 ? LADDER_ORDER.length : i;
};

/** Entry points meant for newcomers; anyone else tries the unsupported or unassisted version first. */
const NEWCOMER_FIRST = new Set(["lunge_bw_supported", "vpull_assisted_machine", "vpull_assisted_band"]);

/**
 * Ladders for a slot, in the order to try them: the wanted family first, then the preferred kind
 * of loading, then the general order above. Variety: alternate variants swap the first two kinds
 * of horizontal press, so push-ups and dumbbell presses take turns.
 */
export function ladderPreference(pool: Pool, pattern: Pattern, variant: number, level: TrainingLevel, family?: string): string[] {
  const ladders = [...pool.byLadder.entries()].filter(([, list]) => list[0]!.pattern === pattern);
  let classes = pool.classOrder;
  // At home, push-ups lead on even variants (as they always have); in a gym, the machine or barbell does.
  const home = pool.classOrder[0] === "dumbbell";
  if (pattern === "horizontal_push" && variant % 2 === (home ? 0 : 1)) {
    const present = classes.filter((c) => ladders.some(([, list]) => classOf(list[0]!) === c));
    if (present.length >= 2) classes = [present[1]!, present[0]!, ...classes.filter((c) => c !== present[0] && c !== present[1])];
  }
  const rank = ([name, list]: [string, Exercise[]]) => {
    const e = list[0]!;
    const familyRank = family && e.family !== family ? 1 : 0;
    let classRank = classes.indexOf(classOf(e));
    // Pull-ups for anyone with some training; assisted versions and pulldowns for newcomers.
    if (name === "vpull_bar" && level !== "novice") classRank = -1;
    const newcomer = NEWCOMER_FIRST.has(name) && level !== "novice" ? 1 : 0;
    return [familyRank, classRank, newcomer, orderOf(name)] as const;
  };
  return ladders
    .map((l) => ({ name: l[0], key: rank(l) }))
    .sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.key[2] - b.key[2] || a.key[3] - b.key[3] || a.name.localeCompare(b.name))
    .map((l) => l.name);
}

export function baseLadderLevel(level: TrainingLevel): number {
  switch (level) {
    case "novice":
      return 1;
    case "intermediate":
      return 2;
    case "advanced":
      return 3;
  }
}

/**
 * Pick the exercise for a slot: walk the preferred ladders and choose the highest exercise at or
 * below the target level. Entry regressions (level 0, like wall push-ups) are only reached by
 * moving down a ladder, never as a starting point.
 */
export function pickExercise(
  pool: Pool,
  pattern: Pattern,
  level: TrainingLevel,
  variant: number,
  levelOffset: number,
  exclude: Set<string>,
  /** Extra rungs up bodyweight ladders for people with some training history. */
  bodyweightBoost = 0,
  /** Extra filter, e.g. "shares no prime mover with its superset partner". */
  accept: (e: Exercise) => boolean = () => true,
  /** The movement family wanted (a lunge rather than a squat); others of the pattern stand in. */
  family?: string,
): Exercise | null {
  const ladders = ladderPreference(pool, pattern, variant, level, family);
  const target = (candidates: Exercise[]) =>
    Math.max(1, baseLadderLevel(level) + levelOffset + (candidates.every((e) => e.loadType === "bodyweight" || e.loadType === "time") ? bodyweightBoost : 0));
  // Entry regressions (level 0) are for moving down to, never a starting point.
  const options = (ladder: string) => (pool.byLadder.get(ladder) ?? []).filter((e) => e.ladderLevel > 0 && !exclude.has(e.id) && accept(e));
  // First choice: the highest exercise at or below the target level on the most preferred ladder that has one.
  for (const ladder of ladders) {
    const candidates = options(ladder);
    const t = target(candidates);
    let best: Exercise | null = null;
    for (const c of candidates) if (c.ladderLevel <= t) best = c;
    if (best) return best;
  }
  // Otherwise the easiest exercise left on the most preferred ladder.
  for (const ladder of ladders) {
    const candidates = options(ladder);
    if (candidates.length > 0) return candidates[0]!;
  }
  // No vertical pull fits the equipment: a row still trains the back.
  if (pattern === "vertical_pull") return pickExercise(pool, "row", level, variant + 1, levelOffset, exclude, bodyweightBoost, accept);
  return null;
}
