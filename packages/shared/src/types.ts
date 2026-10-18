/** Core domain types shared by the engine, exercise library, CLI and app. */

export type Sex = "male" | "female";
export type Goal = "strength_muscle" | "fitness" | "both";
export type TrainingHistory = "never" | "a_little" | "lapsed" | "regular";
export type TrainingLevel = "novice" | "intermediate" | "advanced";
export type Units = "lb" | "kg";
export type Injury = "knee" | "low_back" | "shoulder" | "wrist";

export interface Profile {
  sex: Sex;
  age: number;
  heightCm: number;
  bodyweightKg: number;
  trainingHistory: TrainingHistory;
  goal: Goal;
  /** 1–6 */
  daysPerWeek: number;
  /** 10–45 */
  minutesPerSession: number;
  injuries: Injury[];
  units: Units;
  /** How strength sessions divide the body. Missing means full body (older setups). */
  split?: Split;
}

/**
 * - full_body: every session trains everything
 * - push_pull: push (chest, shoulders, triceps, quads) and pull (back, biceps, hamstrings, glutes)
 * - upper_lower: upper body and lower body
 * - ppl: push, pull and legs
 */
export type Split = "full_body" | "push_pull" | "upper_lower" | "ppl";

export type Dumbbells =
  | { kind: "none" }
  | { kind: "fixed"; weights: number[]; unit: Units; pairs: boolean }
  | { kind: "adjustable"; min: number; max: number; step: number; unit: Units; pairs: boolean };

export type Band = "light" | "medium" | "heavy";

/** Gym machines, each its own exercise station. */
export type Machine =
  | "chest_press"
  | "shoulder_press"
  | "reverse_fly"
  | "lat_pulldown"
  | "seated_row"
  | "supported_row"
  | "assisted_pull_up"
  | "preacher_curl"
  | "leg_press"
  | "hack_squat"
  | "smith"
  | "leg_extension"
  | "seated_leg_curl"
  | "lying_leg_curl"
  | "standing_calf"
  | "seated_calf"
  | "hip_thrust"
  | "hip_abduction"
  | "hip_adduction"
  | "back_extension";

export const MACHINES: Machine[] = [
  "leg_press",
  "chest_press",
  "lat_pulldown",
  "seated_row",
  "shoulder_press",
  "leg_extension",
  "seated_leg_curl",
  "lying_leg_curl",
  "assisted_pull_up",
  "standing_calf",
  "seated_calf",
  "supported_row",
  "reverse_fly",
  "preacher_curl",
  "hack_squat",
  "smith",
  "hip_thrust",
  "hip_abduction",
  "hip_adduction",
  "back_extension",
];

export interface Equipment {
  dumbbells: Dumbbells;
  treadmill: boolean;
  mat: boolean;
  abRoller: boolean;
  pullupBar: boolean;
  /** A sturdy chair, step or couch: something to sit on, step up on or lean your back against. */
  bench: boolean;
  /** A flat, padded bench you can lie on and press dumbbells from (no barbell or rack). Missing means no. */
  flatBench?: boolean;
  /** Long resistance bands (with handles or long loops) you can stand on or anchor. */
  bands: Band[];
  /** Small loop bands ("mini bands") that go around the legs. Missing means no. */
  loopBands?: boolean;
  /** A skipping rope, for cardio intervals. Missing means no. */
  jumpRope?: boolean;
  /** A secure anchor for bands at any height: a door anchor or a sturdy post. Missing means no. */
  bandAnchor?: boolean;
  /** Sliders, or towels on a smooth floor, for sliding leg curls. Missing means no. */
  sliders?: boolean;
  /** A suspension trainer on a secure anchor. Missing means no. */
  suspension?: boolean;
  /** A bench that inclines (it also lies flat). Missing means no. */
  adjustableBench?: boolean;
  /** A barbell and plates. */
  barbell?: boolean;
  /** A squat or bench rack with safeties (or a spotter). */
  rack?: boolean;
  trapBar?: boolean;
  ezBar?: boolean;
  /** A cable station with handles, a rope and bar attachments. */
  cables?: boolean;
  machines?: Machine[];
  bike?: boolean;
  elliptical?: boolean;
  rower?: boolean;
  stairClimber?: boolean;
}

/** Equipment items an exercise can require. */
export type EquipmentItem =
  | "dumbbells"
  | "treadmill"
  | "mat"
  | "ab_roller"
  | "pullup_bar"
  | "bench"
  | "flat_bench"
  | "adjustable_bench"
  | "bands"
  | "loop_band"
  | "band_anchor"
  | "sliders"
  | "suspension"
  | "jump_rope"
  | "barbell"
  | "rack"
  | "trap_bar"
  | "ez_bar"
  | "cables"
  | `machine:${Machine}`;

export type Pattern =
  | "squat"
  | "hinge"
  | "horizontal_push"
  | "vertical_push"
  | "row"
  | "vertical_pull"
  | "core"
  | "isolation"
  | "cardio";

export type Muscle =
  | "quads"
  | "glutes"
  | "hamstrings"
  | "chest"
  | "shoulders"
  | "triceps"
  | "biceps"
  | "back"
  | "core"
  | "calves";

/**
 * How an exercise is loaded. Barbell loads are the whole bar; machine and cable loads are the
 * stack (or plates) setting; dumbbell pairs are per dumbbell.
 */
export type LoadType = "dumbbell_pair" | "single_dumbbell" | "barbell" | "machine" | "cable" | "bodyweight" | "band" | "time";

/**
 * Who the planner offers an exercise to. "default": it may be picked automatically. "optional":
 * a useful branch you choose. "advanced": an opt-in skill. "retired": kept for history only.
 */
export type Tier = "default" | "optional" | "advanced" | "retired";

/** How strong the evidence behind an exercise is: a direct training study, the movement pattern, or coverage. */
export interface Evidence {
  basis: "direct" | "pattern" | "coverage";
  /** Source ids (see SOURCES) of studies that tested this exercise. */
  direct: string[];
  /** Source ids of broader evidence it draws on. */
  context: string[];
}

export interface Exercise {
  id: string;
  name: string;
  pattern: Pattern;
  /** Exercises doing the same job, e.g. "lunge", "knee_flexion", "rear_delt". */
  family: string;
  tier: Tier;
  /** Browsing group, e.g. "Chest" or "Hip abductors". */
  group: string;
  /** Muscle groups it trains directly, for weekly volume (stabilisers don't count). */
  primary: Muscle[];
  secondary: Muscle[];
  /** Anatomical targets: prime movers, secondary movers and stabilisers. */
  targets: { prime: string[]; secondary: string[]; stabilizers: string[] };
  /** OR of ANDs. An empty inner array means bodyweight only. */
  requires: EquipmentItem[][];
  loadType: LoadType;
  /**
   * A progression track. Exercises on the same ladder are ordered easiest to hardest and the
   * planner may move you along it; exercises alone on their ladder progress by load or reps.
   */
  ladder: string;
  ladderLevel: number;
  unilateral: boolean;
  /** Seconds per rep, including the lowering phase. */
  repTimeSec: number;
  avoidWith: Injury[];
  /** Fraction of bodyweight moved, for bodyweight exercises. Used only for rough e1RM. */
  bodyweightFraction?: number;
  cue?: string;
  /** Seconds to set up once per session: adjusting a machine, loading a bar, anchoring a band. */
  setupSec?: number;
  /** Weight of the empty bar for barbell exercises, kg. */
  barKg?: number;
  /** Assistance makes it easier (band or machine-assisted pull-ups): progress means less help. */
  assisted?: boolean;
  /** A one-dumbbell version: planned only for someone without a pair of dumbbells, a swap for everyone else. */
  withoutPairs?: boolean;
  /**
   * A stand-in: planned only while nothing heavier in its family is (a bodyweight good morning
   * until there's a band or dumbbells, a band curl until there are dumbbells); a swap otherwise.
   */
  light?: boolean;
  /** Why it's in RepCurve and how to use it. */
  note?: string;
  evidence?: Evidence;
}

export type Rir = 0 | 1 | 2 | 3 | 4;

export interface SetLog {
  exerciseId: string;
  /** Position in the session plan, e.g. "A.squat". */
  slot?: string;
  setIndex: number;
  /** kg; null for bodyweight/time exercises. */
  loadKg: number | null;
  reps: number;
  rir: Rir;
  painFlag?: boolean;
  /** A set added beyond the plan: it counts like any other, but progression judges the planned sets. */
  extra?: boolean;
  /** Where it hurt, when the user said: "knee", "low_back", "shoulder", "wrist", "elbow", "hip", "neck" or "other". */
  painArea?: string;
}
