import type { Profile, TrainingLevel } from "@repcurve/shared";

export function trainingLevel(p: Profile): TrainingLevel {
  switch (p.trainingHistory) {
    case "never":
    case "a_little":
    case "lapsed":
      return "novice";
    case "regular":
      return "intermediate";
  }
}

/** Logged strength sessions after which the plan's volume steps up a level. */
export const PROMOTION_SESSIONS = { fromNever: 60, fromLapsed: 16, toAdvanced: 150 } as const;

/**
 * The level the plan's volume is set for: where the person started, stepped up by what they have
 * logged here. A first-timer is past the novice stage after a few months of steady training, and
 * someone returning after a break gets back there within weeks. Exercise choice, rep ranges and
 * starting loads stay with the onboarding level, so a promotion never swaps exercises.
 */
export function progressedLevel(p: Profile, strengthSessionsLogged = 0): TrainingLevel {
  const start = trainingLevel(p);
  const n = Math.max(0, strengthSessionsLogged);
  if (start === "novice") {
    const needed = p.trainingHistory === "lapsed" ? PROMOTION_SESSIONS.fromLapsed : PROMOTION_SESSIONS.fromNever;
    return n >= needed ? "intermediate" : "novice";
  }
  if (start === "intermediate" && n >= PROMOTION_SESSIONS.toAdvanced) return "advanced";
  return start;
}

/** Hard sets per muscle group per week. [verify] */
export function volumeTarget(level: TrainingLevel): [number, number] {
  switch (level) {
    case "novice":
      return [8, 10];
    case "intermediate":
      return [12, 16];
    case "advanced":
      return [16, 20];
  }
}

/**
 * Hard sets per week for each tracked shoulder head (the side), counted on top of the shoulders'
 * own target: direct work for the part of the shoulder that pressing leaves short. None for
 * novices, who grow from the big lifts alone and whose time goes further on them. [verify]
 */
export function deltHeadTarget(level: TrainingLevel): [number, number] | null {
  switch (level) {
    case "novice":
      return null;
    case "intermediate":
      return [6, 8];
    case "advanced":
      return [8, 10];
  }
}

/** The most hard sets each tracked shoulder head gets in a week (none tracked for novices). */
export function deltHeadCeiling(level: TrainingLevel): number {
  const t = deltHeadTarget(level);
  return t ? Math.ceil(t[1] * 1.5) : Infinity;
}

/**
 * The most hard sets a muscle gets in a week: half again the top of the target. Past it, more sets
 * add little (the dose-response flattens) and cost recovery, so spare minutes go unused instead.
 */
export function volumeCeiling(level: TrainingLevel): number {
  return Math.ceil(volumeTarget(level)[1] * 1.5);
}

export const LEVEL_LOAD_MULTIPLIER: Record<TrainingLevel, number> = {
  novice: 1,
  intermediate: 1.4,
  advanced: 1.8,
};
