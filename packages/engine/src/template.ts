import type { Equipment, Goal } from "@repcurve/shared";
import type { SessionKind } from "./types.js";

/** Strength and cardio session counts for a given days/week and goal. */
function split(days: number, goal: Goal): { strength: number; cardio: number } {
  const d = Math.max(1, Math.min(6, Math.round(days)));
  const table: Record<Goal, Record<number, [number, number]>> = {
    strength_muscle: { 1: [1, 0], 2: [2, 0], 3: [3, 0], 4: [3, 1], 5: [4, 1], 6: [4, 2] },
    both: { 1: [1, 0], 2: [2, 0], 3: [2, 1], 4: [3, 1], 5: [3, 2], 6: [4, 2] },
    fitness: { 1: [1, 0], 2: [1, 1], 3: [2, 1], 4: [2, 2], 5: [3, 2], 6: [3, 3] },
  };
  const [strength, cardio] = table[goal][d]!;
  return { strength, cardio };
}

/**
 * Weekly order of session kinds. Cardio days are spread evenly so strength
 * days get recovery between them where possible.
 */
export function weeklyTemplate(days: number, goal: Goal, equipment: Equipment): SessionKind[] {
  let { strength, cardio } = split(days, goal);
  // Without a treadmill, cardio days become extra strength days up to four,
  // and anything beyond that stays cardio as an outdoor walk/jog.
  if (!equipment.treadmill) {
    while (cardio > 0 && strength < 4) {
      strength += 1;
      cardio -= 1;
    }
  }
  const n = strength + cardio;
  const out: SessionKind[] = new Array(n).fill("strength");
  const taken = new Set<number>();
  for (let k = 0; k < cardio; k++) {
    let idx = Math.floor(((k + 0.5) * n) / cardio);
    while (taken.has(idx) && idx < n - 1) idx += 1;
    while (taken.has(idx) && idx > 0) idx -= 1;
    taken.add(idx);
    out[idx] = "cardio";
  }
  return out;
}
