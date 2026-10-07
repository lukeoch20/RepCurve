import type { Equipment, Profile, TrainingLevel } from "@repcurve/shared";
import type { CardioPlan, CardioSegment, SessionPlan } from "./types.js";

export interface CardioSessionInput {
  profile: Profile;
  equipment: Equipment;
  level: TrainingLevel;
  /** 0-based index of this cardio session within the week. */
  cardioIndex: number;
  /** 0-based position in the session sequence. */
  index: number;
  week: number;
  dayIndex: number;
  /** Cardio sessions in the weekly template. */
  cardioPerWeek?: number;
  /** Effort (1–10) the user reported for their last cardio session, if any. */
  lastEffort?: number;
}

/** -1 after a session that felt very hard, +1 after one that felt easy, else 0. */
function effortNudge(lastEffort: number | undefined): number {
  if (lastEffort === undefined) return 0;
  if (lastEffort >= 9) return -1;
  if (lastEffort <= 4) return 1;
  return 0;
}

export function buildCardioSession(input: CardioSessionInput): SessionPlan {
  const budget = input.profile.minutesPerSession;
  const mode = input.equipment.treadmill ? "treadmill" : "outdoor";
  const firstWeekNovice = input.level === "novice" && input.week === 1 && input.profile.trainingHistory === "never";
  const nudge = effortNudge(input.lastEffort);
  // The second cardio day of a week is intervals; with one cardio day a week, every other week is.
  const intervals = !firstWeekNovice && ((input.cardioPerWeek ?? 2) > 1 ? input.cardioIndex % 2 === 1 : input.week % 2 === 0);

  const segments: CardioSegment[] = [];
  let plan: CardioPlan;
  if (intervals) {
    const warm = 3;
    const cool = 2;
    // Work intervals lengthen once the count has had time to build.
    const hardMin = input.week >= 7 ? 2 : 1;
    const pair = hardMin + 1;
    const fit = Math.floor((budget - warm - cool) / pair);
    const reps = Math.max(1, Math.min(fit, Math.max(2, Math.min(4 + input.week, 10) + nudge)));
    segments.push({ minutes: warm, intent: "warmup", effort: 3, note: "Brisk walk" });
    for (let i = 0; i < reps; i++) {
      const hard: CardioSegment = { minutes: hardMin, intent: "hard", effort: 8 };
      if (i === 0) hard.note = "Fast walk, incline, or jog: breathing hard";
      segments.push(hard);
      segments.push({ minutes: 1, intent: "easy", effort: 3 });
    }
    // Time left over in a long session becomes a steady block, not a long cool-down.
    const spare = Math.max(0, budget - warm - cool - reps * pair);
    if (spare >= 3) segments.push({ minutes: spare, intent: "steady", effort: 5, note: "Steady and conversational" });
    segments.push({ minutes: cool + (spare >= 3 ? 0 : spare), intent: "cooldown", effort: 2 });
    plan = { mode, style: "intervals", segments, totalMinutes: budget };
  } else {
    const style = mode === "treadmill" ? "incline_walk" : "steady";
    const main = budget - 4;
    // A strong finish that grows week by week (a minute a week, up to a third of the
    // session), held back after a session that felt very hard and pushed after an easy one.
    const push = input.week === 1 ? 0 : Math.max(0, Math.min(Math.floor(main / 3), input.week - 1 + nudge));
    segments.push({ minutes: 2, intent: "warmup", effort: 3 });
    segments.push({
      minutes: main - push,
      intent: "steady",
      effort: input.week === 1 || nudge < 0 ? 5 : 6,
      note: style === "incline_walk" ? "Incline 5–10%, pace you could hold a short conversation at" : "Brisk walk or easy jog, conversational",
    });
    if (push > 0) {
      segments.push({
        minutes: push,
        intent: "steady",
        effort: 7,
        note: style === "incline_walk" ? "Strong finish: a little more incline or pace, a few words at a time" : "Strong finish: pick up the pace, a few words at a time",
      });
    }
    segments.push({ minutes: 2, intent: "cooldown", effort: 2 });
    plan = { mode, style, segments, totalMinutes: budget };
  }
  return {
    id: `w${input.week}d${input.dayIndex + 1}`,
    index: input.index,
    week: input.week,
    dayIndex: input.dayIndex,
    kind: "cardio",
    variant: "cardio",
    name: plan.style === "intervals" ? "Intervals" : plan.style === "incline_walk" ? "Incline walk" : "Steady cardio",
    budgetMinutes: budget,
    estimatedMinutes: budget,
    warmupMinutes: 0,
    warmup: [],
    supersets: [],
    finisher: null,
    cardio: plan,
    deload: false,
    comeback: false,
  };
}
