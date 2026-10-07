import type { Equipment, Exercise, LoadType, Muscle, Pattern, Profile, Rir, TrainingLevel } from "@repcurve/shared";
import type { TrainingState } from "./state.js";

export type SessionKind = "strength" | "cardio";

export interface Prescription {
  /** Stable position in the session, e.g. "A.squat" or "B.core". */
  slot: string;
  exerciseId: string;
  name: string;
  pattern: Pattern;
  loadType: LoadType;
  unilateral: boolean;
  /** Rounds in the superset this belongs to; equals sets. */
  sets: number;
  /** Reps, or seconds for time-based exercises. */
  repRange: [number, number];
  /** What each set is pre-filled with: reps, or seconds for time-based exercises. */
  targetReps: number;
  /** kg per dumbbell; null for bodyweight, band and time exercises. */
  loadKg: number | null;
  loadDisplay: string;
  targetRir: Rir;
  /** First set is "as many good reps as you can, stop with 2 left, cap 20". */
  benchmarkSet: boolean;
  cue?: string;
}

export interface Superset {
  label: string;
  rounds: number;
  items: Prescription[];
  /** Seconds between the exercises within a round. */
  transitionSec: number;
  /** Seconds after each round. */
  restSec: number;
  estimatedSec: number;
}

export interface WarmupItem {
  name: string;
  prescription: string;
}

export type CardioIntent = "warmup" | "easy" | "steady" | "hard" | "cooldown";

export interface CardioSegment {
  minutes: number;
  intent: CardioIntent;
  /** 1–10 perceived effort. */
  effort: number;
  note?: string;
}

export interface CardioPlan {
  mode: "treadmill" | "outdoor";
  style: "steady" | "incline_walk" | "intervals";
  segments: CardioSegment[];
  totalMinutes: number;
}

export interface SessionPlan {
  id: string;
  /** 0-based position in the open-ended sequence of sessions. */
  index: number;
  week: number;
  /** 0-based index within the week. */
  dayIndex: number;
  kind: SessionKind;
  /** Strength variant key ("A", "B", "C") or "cardio". */
  variant: string;
  name: string;
  budgetMinutes: number;
  estimatedMinutes: number;
  warmupMinutes: number;
  warmup: WarmupItem[];
  supersets: Superset[];
  finisher: Prescription | null;
  cardio: CardioPlan | null;
  /** Lighter session: part of a deload, or the first session back after a break. */
  deload: boolean;
  comeback: boolean;
  /** Plain-language notes about compromises in this session, e.g. settings that leave little room. */
  notes?: string[];
}

export interface Program {
  createdAt: string;
  level: TrainingLevel;
  weeks: number;
  template: SessionKind[];
  sessions: SessionPlan[];
  /** Hard sets per muscle group in a full week (primary = 1, secondary = 0.5). */
  weeklyVolume: Record<Muscle, number>;
  volumeTarget: [number, number];
  explanation: string[];
}

export interface GenerateOptions {
  weeks?: number;
  /** Known e1RM per exercise id (kg per dumbbell), e.g. from a benchmark. */
  e1rmByExercise?: Record<string, number>;
  /** Rest after each superset round, seconds. Defaults by time budget. */
  restSec?: number;
  /** Seconds between exercises within a round. */
  transitionSec?: number;
  /**
   * The user's training state. When given, the weekly volume and explanation describe the
   * sessions the user actually gets now (their exercises, rep targets and fitted rounds).
   */
  state?: TrainingState;
  createdAt?: string;
}

export interface GenerateInput {
  profile: Profile;
  equipment: Equipment;
}

export interface Pool {
  exercises: Exercise[];
  byLadder: Map<string, Exercise[]>;
}
