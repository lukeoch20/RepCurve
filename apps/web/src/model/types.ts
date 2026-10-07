import type { ExerciseChange, SessionPlan, TrainingState } from "@repcurve/engine";
import type { Equipment, Profile, SetLog } from "@repcurve/shared";

export interface Settings {
  /** Rest after each superset round, seconds. */
  restSec: number;
  /** Rest between the exercises inside a round, seconds. */
  transitionSec: number;
  sound: boolean;
  keepAwake: boolean;
}

export const DEFAULT_SETTINGS: Settings = { restSec: 60, transitionSec: 20, sound: true, keepAwake: true };

export const REST_CHOICES = [30, 45, 60, 75, 90, 120, 150, 180];
export const TRANSITION_CHOICES = [10, 15, 20, 30, 45];

/** Everything about the user and their training that isn't a session log. */
export interface Core {
  version: 1;
  profile: Profile;
  equipment: Equipment;
  settings: Settings;
  state: TrainingState;
  /** ISO timestamp of the first day. */
  startedAt: string;
  /** Position of the next session in the sequence. */
  nextIndex: number;
  /**
   * Programme position minus session count. Changes when days per week change, so the
   * user stays in the same week of the programme. Missing means 0.
   */
  positionOffset?: number;
}

export interface LoggedSet extends SetLog {
  /** Epoch ms when the set was logged. */
  at: number;
}

export type TimerKind = "rest" | "transition";

export interface TimerState {
  kind: TimerKind;
  /** Epoch ms when the countdown reaches zero. */
  endsAt: number;
  durationSec: number;
  /** What comes next, shown under the clock. */
  next: string;
}

export interface CardioProgress {
  segmentIndex: number;
  /** Epoch ms when the current segment ends while running; null while paused or not started. */
  segmentEndsAt: number | null;
  /** Milliseconds left in the current segment while paused. */
  remainingMs: number;
  started: boolean;
  finished: boolean;
  /** Milliseconds actually spent in segments already left behind (a skipped segment counts only its elapsed part). */
  doneMs?: number;
}

export type Tone = "good" | "adjust" | "stop";

export interface ActiveSession {
  id: string;
  index: number;
  /** The personalised plan, including any swaps made today. */
  plan: SessionPlan;
  startedAt: number;
  /** Total milliseconds spent paused so far. */
  pausedMs: number;
  pausedAt: number | null;
  minutesOverride: number | null;
  sets: LoggedSet[];
  warmupDone: string[];
  timer: TimerState | null;
  cardio: CardioProgress | null;
  /** Latest coaching per slot. */
  advice: Record<string, { message: string; tone: Tone }>;
  /** What the next set of each slot should be pre-filled with. */
  nextSet: Record<string, { loadKg: number | null; reps: number }>;
  /** Slots the user chose to skip for the rest of this session. */
  skippedSlots: string[];
}

export interface CardioResult {
  minutes: number;
  /** 1-10 */
  effort: number;
  notes: string;
}

export interface SessionRecord {
  id: string;
  index: number;
  kind: "strength" | "cardio";
  name: string;
  week: number;
  startedAt: number;
  finishedAt: number;
  /** Minutes from start to finish, minus pauses. */
  activeMinutes: number;
  plan: SessionPlan;
  sets: LoggedSet[];
  changes: ExerciseChange[];
  cardio: CardioResult | null;
  deload: boolean;
  comeback: boolean;
  skipped: boolean;
}

export interface AppData {
  core: Core | null;
  active: ActiveSession | null;
  history: SessionRecord[];
}

export const EMPTY_DATA: AppData = { core: null, active: null, history: [] };
