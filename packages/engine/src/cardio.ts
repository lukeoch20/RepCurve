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
}

export function buildCardioSession(input: CardioSessionInput): SessionPlan {
  const budget = input.profile.minutesPerSession;
  const mode = input.equipment.treadmill ? "treadmill" : "outdoor";
  const firstWeekNovice = input.level === "novice" && input.week === 1 && input.profile.trainingHistory === "never";
  const intervals = input.cardioIndex % 2 === 1 && !firstWeekNovice;

  const segments: CardioSegment[] = [];
  let plan: CardioPlan;
  if (intervals) {
    const warm = 3;
    const cool = 2;
    const maxReps = Math.min(4 + input.week, 10);
    const reps = Math.max(2, Math.min(maxReps, Math.floor((budget - warm - cool) / 2)));
    segments.push({ minutes: warm, intent: "warmup", effort: 3, note: "Brisk walk" });
    for (let i = 0; i < reps; i++) {
      const hard: CardioSegment = { minutes: 1, intent: "hard", effort: 8 };
      if (i === 0) hard.note = "Fast walk, incline, or jog: breathing hard";
      segments.push(hard);
      segments.push({ minutes: 1, intent: "easy", effort: 3 });
    }
    const used = warm + cool + reps * 2;
    segments.push({ minutes: cool + Math.max(0, budget - used), intent: "cooldown", effort: 2 });
    plan = { mode, style: "intervals", segments, totalMinutes: budget };
  } else {
    const style = mode === "treadmill" ? "incline_walk" : "steady";
    segments.push({ minutes: 2, intent: "warmup", effort: 3 });
    segments.push({
      minutes: budget - 4,
      intent: "steady",
      effort: input.week === 1 ? 5 : 6,
      note: style === "incline_walk" ? "Incline 5–10%, pace you could hold a short conversation at" : "Brisk walk or easy jog, conversational",
    });
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
