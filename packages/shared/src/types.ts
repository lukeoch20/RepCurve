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
}

export type Dumbbells =
  | { kind: "none" }
  | { kind: "fixed"; weights: number[]; unit: Units; pairs: boolean }
  | { kind: "adjustable"; min: number; max: number; step: number; unit: Units; pairs: boolean };

export type Band = "light" | "medium" | "heavy";

export interface Equipment {
  dumbbells: Dumbbells;
  treadmill: boolean;
  mat: boolean;
  abRoller: boolean;
  pullupBar: boolean;
  /** A bench, sturdy chair or step that can be used for elevation and support. */
  bench: boolean;
  /** A flat weight bench you can lie on and press from. Missing means no. */
  flatBench?: boolean;
  bands: Band[];
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
  | "bands";

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

export type LoadType = "dumbbell_pair" | "single_dumbbell" | "bodyweight" | "band" | "time";

export interface Exercise {
  id: string;
  name: string;
  pattern: Pattern;
  primary: Muscle[];
  secondary: Muscle[];
  /** OR of ANDs. An empty inner array means bodyweight only. */
  requires: EquipmentItem[][];
  loadType: LoadType;
  /** Exercises on the same ladder are ordered easiest (1) to hardest. */
  ladder: string;
  ladderLevel: number;
  unilateral: boolean;
  /** Seconds per rep, including the lowering phase. */
  repTimeSec: number;
  avoidWith: Injury[];
  /** Fraction of bodyweight moved, for bodyweight exercises. Used only for rough e1RM. */
  bodyweightFraction?: number;
  cue?: string;
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
}
