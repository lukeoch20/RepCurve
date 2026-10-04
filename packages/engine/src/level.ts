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

export const LEVEL_LOAD_MULTIPLIER: Record<TrainingLevel, number> = {
  novice: 1,
  intermediate: 1.4,
  advanced: 1.8,
};
