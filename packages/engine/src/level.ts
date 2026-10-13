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
