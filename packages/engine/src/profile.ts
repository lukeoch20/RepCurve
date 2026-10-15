import { getExercise } from "@repcurve/exercises";
import type { Injury, SetLog } from "@repcurve/shared";
import type { Prescription, SessionPlan } from "./types.js";
import type { SwapReason, TrainingState } from "./state.js";
import type { SoreLevel, Soreness } from "./soreness.js";

/**
 * Everything RepCurve has learned about a person, in one place: the per-exercise progress the
 * progression rules keep, plus what their feedback says (where things hurt, which exercises were too
 * hard, unstable or disliked). Derived from the training state and the feedback in their history every
 * time it's needed, never stored, so it can't drift from what actually happened.
 */
export interface TrainingProfile {
  /** Working weight, reps, rep range and trend per exercise (the progression rules' own record). */
  exercises: TrainingState["exercises"];
  /** Body areas recently flagged as hurting. */
  cautions: Caution[];
  preferences: {
    /** Exercises swapped out for good because the user didn't like them. */
    disliked: string[];
    /** Times each exercise was swapped out as too hard. */
    tooHard: Record<string, number>;
    /** Times each exercise was swapped out because the user couldn't balance. */
    unstable: Record<string, number>;
    /** What each exercise was last swapped out for, for good. */
    swappedFor: Record<string, string>;
  };
  /** What the "still sore" check-ins said, per muscle group asked about. */
  soreness: SoreRecord[];
  /** Exercises whose working weight is being re-tested: they get a benchmark set until it's set again. */
  rebenchmark: string[];
}

/** One muscle group's check-in answers. */
export interface SoreRecord {
  group: Soreness["group"];
  /** Check-ins that asked about it. */
  asked: number;
  /** Answers of "a bit" or "very". */
  sore: number;
  lastLevel: SoreLevel;
  lastAt: number;
  /** Check-ins in a row, up to the last, that found it still sore. */
  streak: number;
}

/**
 * Corrections the user made on the profile screen. Stored with their data and read every time the
 * profile is built, so what was corrected stays corrected.
 */
export interface ProfileOverrides {
  /** Areas the user said are fine now, with when: pain reported up to then no longer counts. */
  cautionsCleared?: Record<string, number>;
  /** Exercises whose swaps the user asked to forget, with when: swaps up to then no longer count. */
  forgotten?: Record<string, number>;
  /** Exercises whose working weight the user asked to re-test. */
  rebenchmark?: string[];
}

export interface Caution {
  /** The area as the user chose it, e.g. "Shoulder". */
  area: string;
  /** The joint it maps to, which exercises list in `avoidWith`; null for areas no exercise lists. */
  injury: Injury | null;
  /** Times it was flagged. */
  reports: number;
  firstReportAt: number;
  lastReportAt: number;
  /** Strength sessions since the last report that trained this area without pain. */
  painFreeSessions: number;
  /** Still shaping the plan: exercises loading this area are checked in on and held steady. */
  active: boolean;
}

/** A swap made during a session, and why. */
export interface SwapEvent {
  slot: string;
  from: string;
  to: string;
  reason?: SwapReason;
  permanent: boolean;
}

/** What a finished session contributes to the profile. */
export interface FeedbackSession {
  finishedAt: number;
  kind: "strength" | "cardio";
  sets: Pick<SetLog, "exerciseId" | "painFlag" | "painArea">[];
  swaps?: SwapEvent[];
  /** The "still sore" check-in's answers before the session. */
  soreness?: Soreness[];
}

/** Areas the pain sheet offers that match a joint exercises can be marked as hard on. */
const AREA_INJURY: Record<string, Injury> = { Knee: "knee", "Lower back": "low_back", Shoulder: "shoulder", Wrist: "wrist" };

/** A caution lifts after this many pain-free sessions that trained the area… */
export const CAUTION_CLEAR_SESSIONS = 2;
/** …or once this long has passed without another report. */
export const CAUTION_MAX_DAYS = 42;
const DAY_MS = 86_400_000;

const loadsArea = (exerciseId: string, injury: Injury): boolean => {
  try {
    return getExercise(exerciseId).avoidWith.includes(injury);
  } catch {
    return false;
  }
};

/**
 * Builds the profile from the training state and the finished sessions, oldest first, with the
 * user's corrections applied.
 */
export function buildProfile(state: TrainingState, sessions: FeedbackSession[], now: number, overrides: ProfileOverrides = {}): TrainingProfile {
  const cautions = new Map<string, Caution>();
  const tooHard: Record<string, number> = {};
  const unstable: Record<string, number> = {};
  const disliked = new Set<string>();
  const swappedFor: Record<string, string> = {};
  const sore = new Map<Soreness["group"], SoreRecord>();
  const cleared = overrides.cautionsCleared ?? {};
  const forgotten = overrides.forgotten ?? {};

  for (const s of sessions) {
    // Sessions that trained a cautioned area without pain count toward lifting the caution.
    if (s.kind === "strength") {
      for (const c of cautions.values()) {
        if (!c.injury || s.finishedAt <= c.lastReportAt) continue;
        const trained = s.sets.filter((l) => loadsArea(l.exerciseId, c.injury!));
        if (trained.length > 0 && !trained.some((l) => l.painFlag)) c.painFreeSessions += 1;
      }
    }
    for (const l of s.sets) {
      if (!l.painFlag || !l.painArea) continue;
      // The user said this area is fine now: what was reported up to then is set aside.
      if (s.finishedAt <= (cleared[l.painArea] ?? -Infinity)) continue;
      const c = cautions.get(l.painArea);
      if (c) {
        if (c.lastReportAt !== s.finishedAt) c.reports += 1;
        c.lastReportAt = s.finishedAt;
        c.painFreeSessions = 0;
      } else {
        cautions.set(l.painArea, {
          area: l.painArea,
          injury: AREA_INJURY[l.painArea] ?? null,
          reports: 1,
          firstReportAt: s.finishedAt,
          lastReportAt: s.finishedAt,
          painFreeSessions: 0,
          active: true,
        });
      }
    }
    for (const w of s.swaps ?? []) {
      if (s.finishedAt <= (forgotten[w.from] ?? -Infinity)) continue;
      if (w.reason === "hard") tooHard[w.from] = (tooHard[w.from] ?? 0) + 1;
      if (w.reason === "balance") unstable[w.from] = (unstable[w.from] ?? 0) + 1;
      if (w.reason === "dislike" && w.permanent) disliked.add(w.from);
      if (w.permanent) swappedFor[w.from] = w.to;
    }
    for (const a of s.soreness ?? []) {
      const r = sore.get(a.group) ?? { group: a.group, asked: 0, sore: 0, lastLevel: "none" as SoreLevel, lastAt: 0, streak: 0 };
      const isSore = a.level !== "none";
      sore.set(a.group, { ...r, asked: r.asked + 1, sore: r.sore + (isSore ? 1 : 0), lastLevel: a.level, lastAt: s.finishedAt, streak: isSore ? r.streak + 1 : 0 });
    }
  }

  for (const c of cautions.values()) {
    c.active = c.painFreeSessions < CAUTION_CLEAR_SESSIONS && now - c.lastReportAt < CAUTION_MAX_DAYS * DAY_MS;
  }
  return {
    exercises: state.exercises,
    cautions: [...cautions.values()].sort((a, b) => b.lastReportAt - a.lastReportAt),
    preferences: { disliked: [...disliked], tooHard, unstable, swappedFor },
    soreness: [...sore.values()],
    // Only while the exercise is still waiting for its new benchmark.
    rebenchmark: (overrides.rebenchmark ?? []).filter((id) => state.exercises[id] !== undefined && !state.exercises[id]!.calibrated),
  };
}

/** The active caution an exercise falls under, if any. */
export function cautionFor(profile: TrainingProfile, exerciseId: string): Caution | undefined {
  return profile.cautions.find((c) => c.active && c.injury !== null && loadsArea(exerciseId, c.injury));
}

/**
 * Puts the profile's cautions on a planned session: an exercise that loads a recently painful area gets
 * the same check-in as one that hurt itself, skips any benchmark set, and is held steady until the area
 * has had a few pain-free sessions.
 */
export function applyProfile(session: SessionPlan, profile: TrainingProfile): SessionPlan {
  const retest = new Set(profile.rebenchmark);
  if (session.kind !== "strength" || (!profile.cautions.some((c) => c.active && c.injury) && retest.size === 0)) return session;
  // A working weight being re-tested gets a benchmark set, outside lighter sessions; a caution wins over it.
  const easier = session.deload || session.comeback;
  const bench = (p: Prescription) => (!easier && retest.has(p.exerciseId) && p.loadType !== "time" && !p.painCheck ? { ...p, benchmarkSet: true } : p);
  const mark = (p: Prescription) => markCaution(bench(p), profile);
  return {
    ...session,
    supersets: session.supersets.map((ss) => ({ ...ss, items: ss.items.map(mark) })),
    finisher: session.finisher ? mark(session.finisher) : null,
  };
}

/**
 * One exercise with the profile's caution on it: if it loads a recently painful area it gets the
 * check-in, no max-reps benchmark set, and is held steady. Used for planned exercises and for
 * anything swapped in, so a swap can't step around a caution.
 */
export function markCaution(p: Prescription, profile: TrainingProfile): Prescription {
  // An exercise that hurt itself already has its own check-in.
  const c = p.painCheck ? undefined : cautionFor(profile, p.exerciseId);
  return c ? { ...p, painCheck: true, caution: c.area, benchmarkSet: false } : p;
}

/** The recently painful areas an exercise loads, e.g. ["Shoulder"]. */
export function cautionAreasFor(profile: TrainingProfile, exerciseId: string): string[] {
  return profile.cautions.filter((c) => c.active && c.injury !== null && loadsArea(exerciseId, c.injury)).map((c) => c.area);
}

/** Swaps for a reason that's come up before stick by default: twice too hard means it's too hard for now. */
export function swapSticks(profile: TrainingProfile, exerciseId: string, reason: SwapReason | undefined): boolean {
  if (reason === "dislike") return true;
  if (reason === "hard") return (profile.preferences.tooHard[exerciseId] ?? 0) >= 1;
  if (reason === "balance") return (profile.preferences.unstable[exerciseId] ?? 0) >= 1;
  return false;
}

/**
 * Re-test an exercise's working weight: it's no longer counted as set, so (with the exercise in the
 * profile overrides' `rebenchmark`) its next session starts with a benchmark set from the current weight.
 */
export function resetWorkingWeight(state: TrainingState, exerciseId: string): TrainingState {
  const p = state.exercises[exerciseId];
  if (!p) return state;
  return { ...state, exercises: { ...state.exercises, [exerciseId]: { ...p, calibrated: false, stalls: 0, topStreak: 0 } } };
}

/**
 * Undo a for-good swap: the exercise swapped out comes back where it was programmed, and in slots on
 * its ladder that the swap moved to the other exercise (unless they've been changed again since).
 */
export function bringBack(state: TrainingState, from: string, to: string): TrainingState {
  let ladder: string | undefined;
  try {
    ladder = getExercise(from).ladder;
  } catch {
    return state;
  }
  const sameLadder = (id: string) => {
    try {
      return getExercise(id).ladder === ladder;
    } catch {
      return false;
    }
  };
  const substitutions = { ...state.substitutions };
  let changed = false;
  for (const [k, v] of Object.entries(state.substitutions)) {
    if (k !== from && (v !== to || !sameLadder(k))) continue;
    changed = true;
    if (k === from) delete substitutions[k];
    else substitutions[k] = from;
  }
  return changed ? { ...state, substitutions } : state;
}

/** "It's fine now": exercises that hurt in this area stop waiting for a pain-free session. */
export function clearPainChecks(state: TrainingState, sessions: FeedbackSession[], area: string): TrainingState {
  const hurt = new Set(sessions.flatMap((s) => s.sets.filter((l) => l.painFlag && l.painArea === area).map((l) => l.exerciseId)));
  const exercises = { ...state.exercises };
  let changed = false;
  for (const id of hurt) {
    const p = exercises[id];
    if (p?.painCheck) {
      exercises[id] = { ...p, painCheck: false };
      changed = true;
    }
  }
  return changed ? { ...state, exercises } : state;
}
