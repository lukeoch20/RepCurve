import { getExercise } from "@repcurve/exercises";
import type { Injury, SetLog } from "@repcurve/shared";
import type { SessionPlan } from "./types.js";
import type { SwapReason, TrainingState } from "./state.js";

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
  };
}

export interface Caution {
  /** The area as the user chose it, e.g. "Shoulder". */
  area: string;
  /** The joint it maps to, which exercises list in `avoidWith`; null for areas no exercise lists. */
  injury: Injury | null;
  /** Times it was flagged. */
  reports: number;
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

/** Builds the profile from the training state and the finished sessions, oldest first. */
export function buildProfile(state: TrainingState, sessions: FeedbackSession[], now: number): TrainingProfile {
  const cautions = new Map<string, Caution>();
  const tooHard: Record<string, number> = {};
  const unstable: Record<string, number> = {};
  const disliked = new Set<string>();

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
      const c = cautions.get(l.painArea);
      if (c) {
        if (c.lastReportAt !== s.finishedAt) c.reports += 1;
        c.lastReportAt = s.finishedAt;
        c.painFreeSessions = 0;
      } else {
        cautions.set(l.painArea, { area: l.painArea, injury: AREA_INJURY[l.painArea] ?? null, reports: 1, lastReportAt: s.finishedAt, painFreeSessions: 0, active: true });
      }
    }
    for (const w of s.swaps ?? []) {
      if (w.reason === "hard") tooHard[w.from] = (tooHard[w.from] ?? 0) + 1;
      if (w.reason === "balance") unstable[w.from] = (unstable[w.from] ?? 0) + 1;
      if (w.reason === "dislike" && w.permanent) disliked.add(w.from);
    }
  }

  for (const c of cautions.values()) {
    c.active = c.painFreeSessions < CAUTION_CLEAR_SESSIONS && now - c.lastReportAt < CAUTION_MAX_DAYS * DAY_MS;
  }
  return {
    exercises: state.exercises,
    cautions: [...cautions.values()].sort((a, b) => b.lastReportAt - a.lastReportAt),
    preferences: { disliked: [...disliked], tooHard, unstable },
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
  if (session.kind !== "strength" || !profile.cautions.some((c) => c.active && c.injury)) return session;
  // No all-out benchmark set on a recently painful area either.
  const mark = <T extends { exerciseId: string; painCheck?: boolean; caution?: string; benchmarkSet: boolean }>(p: T): T => {
    // An exercise that hurt itself already has its own check-in.
    const c = p.painCheck ? undefined : cautionFor(profile, p.exerciseId);
    return c ? { ...p, painCheck: true, caution: c.area, benchmarkSet: false } : p;
  };
  return {
    ...session,
    supersets: session.supersets.map((ss) => ({ ...ss, items: ss.items.map(mark) })),
    finisher: session.finisher ? mark(session.finisher) : null,
  };
}

/** Swaps for a reason that's come up before stick by default: twice too hard means it's too hard for now. */
export function swapSticks(profile: TrainingProfile, exerciseId: string, reason: SwapReason | undefined): boolean {
  if (reason === "dislike") return true;
  if (reason === "hard") return (profile.preferences.tooHard[exerciseId] ?? 0) >= 1;
  if (reason === "balance") return (profile.preferences.unstable[exerciseId] ?? 0) >= 1;
  return false;
}
