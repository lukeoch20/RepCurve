import type { CardioActivity, ExerciseChange, SessionPlan, SwapEvent, TrainingState } from "@repcurve/engine";
import type { Equipment, Profile, SetLog } from "@repcurve/shared";

import type { Reminders } from "./calendar";

export interface Settings {
  /** Rest after each superset round, seconds. */
  restSec: number;
  /** Rest between the exercises inside a round, seconds. */
  transitionSec: number;
  sound: boolean;
  keepAwake: boolean;
  /** A buzz on each logged set and a bigger one at the end, where the phone allows it. */
  haptics: boolean;
  /** The cardio activity the user picked last; used whenever the day's equipment and format allow. */
  cardioActivity?: CardioActivity;
  /** Training days and time last added to the phone's calendar as reminders. */
  reminders?: Reminders;
}

/**
 * Version of the stored data's shape. 2: fields this version doesn't know are kept on load, and the
 * number tells an older app that newer data is in front of it. 3: an exercise in a superset may
 * do one set fewer than the superset's rounds (older apps would wait for a set they never show).
 */
export const DATA_VERSION = 3;

export const DEFAULT_SETTINGS: Settings = { restSec: 60, transitionSec: 20, sound: true, keepAwake: true, haptics: true };

export const REST_CHOICES = [30, 45, 60, 75, 90, 120, 150, 180];
export const TRANSITION_CHOICES = [10, 15, 20, 30, 45];

/** Activity done outside RepCurve (a walk, a match, a swim), counted toward the weekly target. */
export interface ExtraActivity {
  /** Epoch ms when it was logged; also its id. */
  at: number;
  name: string;
  minutes: number;
  /** Breathing hard, few words at a time: counts double. */
  vigorous: boolean;
}

export type Location = "home" | "gym";

/** Equipment for each place the user trains, and where today's training happens. */
export interface Locations {
  home?: Equipment;
  gym?: Equipment;
  at: Location;
}

/** Everything about the user and their training that isn't a session log. */
export interface Core {
  /** The data's shape version (DATA_VERSION when this app saved it; higher if a newer app did). */
  version: number;
  profile: Profile;
  /** Equipment where the user is training now: what plans are built from. */
  equipment: Equipment;
  /** Places the user trains. Missing on setups from before locations existed. */
  locations?: Locations;
  /** Activity logged outside RepCurve. Missing means none. */
  activities?: ExtraActivity[];
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
  /** Swaps made in this session, and why: the training profile learns from them. Missing means none. */
  swaps?: SwapEvent[];
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
  /** Swaps made in the session, and why. Missing on older records. */
  swaps?: SwapEvent[];
}

export interface AppData {
  core: Core | null;
  active: ActiveSession | null;
  history: SessionRecord[];
}

export const EMPTY_DATA: AppData = { core: null, active: null, history: [] };
