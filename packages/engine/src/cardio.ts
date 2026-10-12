import type { Equipment, Profile, TrainingLevel } from "@repcurve/shared";
import type { CardioActivity, CardioPlan, CardioSegment, SessionPlan } from "./types.js";

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
  /** The activity the user prefers, when the equipment and format allow it. */
  activity?: CardioActivity;
}

/** Activities the equipment allows, in a sensible order. Walking, running and marching need nothing. */
export function cardioOptions(equipment: Equipment, intervals: boolean): CardioActivity[] {
  const out: CardioActivity[] = ["walking", "running"];
  if (equipment.bike) out.push("cycling");
  if (equipment.elliptical) out.push("elliptical");
  if (equipment.rower) out.push("rowing");
  if (equipment.stairClimber) out.push("stairs");
  // A rope is for intervals: continuous skipping is too much for most people.
  if (intervals && equipment.jumpRope) out.push("jump_rope");
  out.push("marching");
  return out;
}

interface ActivityNotes {
  warm: string;
  hard: string;
  steady: string;
  push: string;
  easy?: string;
}

/** What each part feels like in each activity. Effort targets are the same; only the movement changes. */
const NOTES: Record<CardioActivity, ActivityNotes> = {
  walking: {
    warm: "Brisk walk",
    hard: "Fast walk, incline, or jog: breathing hard",
    steady: "Brisk walk or easy jog, conversational",
    push: "Strong finish: pick up the pace, a few words at a time",
  },
  running: {
    warm: "Walk, then an easy jog",
    hard: "Run: breathing hard, still in control",
    steady: "Easy jog, conversational",
    push: "Strong finish: pick up the pace, a few words at a time",
  },
  cycling: {
    warm: "Easy spin, light resistance",
    hard: "More resistance or faster pedalling: breathing hard",
    steady: "Steady pedalling, conversational",
    push: "Strong finish: a little more resistance, a few words at a time",
  },
  elliptical: {
    warm: "Easy and smooth",
    hard: "More resistance or pace: breathing hard",
    steady: "Smooth and steady, conversational",
    push: "Strong finish: a little more resistance or pace",
  },
  rowing: {
    warm: "Easy strokes, light pressure: legs, then body, then arms",
    hard: "Harder strokes: breathing hard, same smooth order",
    steady: "Long, smooth strokes, conversational",
    push: "Strong finish: a little more pressure each stroke",
  },
  stairs: {
    warm: "Slow, steady steps",
    hard: "Faster steps: breathing hard. Hold the rails only lightly",
    steady: "Steady climbing, conversational",
    push: "Strong finish: a few more steps a minute",
  },
  jump_rope: {
    warm: "March in place, then easy bounces with the rope",
    hard: "Jump rope at a steady rhythm: breathing hard. Trip? Just start again",
    easy: "Rope down: walk around and shake out your arms",
    steady: "Easy bounces, conversational",
    push: "Strong finish: a quicker rhythm",
  },
  marching: {
    warm: "March in place, arms swinging",
    hard: "Quick high-knee marching or step-jacks: breathing hard",
    steady: "March, step-touch and side steps, conversational",
    push: "Strong finish: bigger arm swings, quicker steps",
  },
};

const INTERVAL_NAME: Record<CardioActivity, string> = {
  walking: "Intervals",
  running: "Run intervals",
  cycling: "Bike intervals",
  elliptical: "Elliptical intervals",
  rowing: "Row intervals",
  stairs: "Stair intervals",
  jump_rope: "Jump rope intervals",
  marching: "Marching intervals",
};
const STEADY_NAME: Record<CardioActivity, string> = {
  walking: "Steady cardio",
  running: "Easy run",
  cycling: "Steady ride",
  elliptical: "Steady elliptical",
  rowing: "Steady row",
  stairs: "Stair climb",
  jump_rope: "Steady cardio",
  marching: "Indoor march",
};

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
  const options = cardioOptions(input.equipment, intervals);
  // With a jump rope, interval days use it: every one without a treadmill, every other fortnight with one.
  const ropeDay = intervals && input.equipment.jumpRope === true && (!input.equipment.treadmill || input.week % 4 < 2);
  const activity: CardioActivity = input.activity && options.includes(input.activity) ? input.activity : ropeDay ? "jump_rope" : "walking";
  const rope = activity === "jump_rope";
  const notes = NOTES[activity];
  const onFoot = activity === "walking" || activity === "running";
  const where = rope ? "jump_rope" : onFoot ? mode : "outdoor";
  if (intervals) {
    const warm = 3;
    const cool = 2;
    // Work intervals lengthen once the count has had time to build (a minute at a time on the rope).
    const hardMin = input.week >= 7 && !rope ? 2 : 1;
    const pair = hardMin + 1;
    const fit = Math.floor((budget - warm - cool) / pair);
    const reps = Math.max(1, Math.min(fit, Math.max(2, Math.min(4 + input.week, 10) + nudge)));
    segments.push({ minutes: warm, intent: "warmup", effort: 3, note: notes.warm });
    for (let i = 0; i < reps; i++) {
      const hard: CardioSegment = { minutes: hardMin, intent: "hard", effort: 8 };
      if (i === 0) hard.note = notes.hard;
      segments.push(hard);
      const easy: CardioSegment = { minutes: 1, intent: "easy", effort: 3 };
      if (i === 0 && notes.easy) easy.note = notes.easy;
      segments.push(easy);
    }
    // Time left over in a long session becomes a steady block, not a long cool-down.
    const spare = Math.max(0, budget - warm - cool - reps * pair);
    if (spare >= 3) segments.push({ minutes: spare, intent: "steady", effort: 5, note: "Steady and conversational" });
    segments.push({ minutes: cool + (spare >= 3 ? 0 : spare), intent: "cooldown", effort: 2 });
    plan = { mode: where, activity, options, style: "intervals", segments, totalMinutes: budget };
  } else {
    const style = mode === "treadmill" && activity === "walking" ? "incline_walk" : "steady";
    const main = budget - 4;
    // A strong finish that grows week by week (a minute a week, up to a third of the
    // session), held back after a session that felt very hard and pushed after an easy one.
    const push = input.week === 1 ? 0 : Math.max(0, Math.min(Math.floor(main / 3), input.week - 1 + nudge));
    segments.push({ minutes: 2, intent: "warmup", effort: 3 });
    segments.push({
      minutes: main - push,
      intent: "steady",
      effort: input.week === 1 || nudge < 0 ? 5 : 6,
      note: style === "incline_walk" ? "Incline 5–10%, pace you could hold a short conversation at" : notes.steady,
    });
    if (push > 0) {
      segments.push({
        minutes: push,
        intent: "steady",
        effort: 7,
        note: style === "incline_walk" ? "Strong finish: a little more incline or pace, a few words at a time" : notes.push,
      });
    }
    segments.push({ minutes: 2, intent: "cooldown", effort: 2 });
    plan = { mode: where, activity, options, style, segments, totalMinutes: budget };
  }
  return {
    id: `w${input.week}d${input.dayIndex + 1}`,
    index: input.index,
    week: input.week,
    dayIndex: input.dayIndex,
    kind: "cardio",
    variant: "cardio",
    name: plan.style === "intervals" ? INTERVAL_NAME[activity] : plan.style === "incline_walk" ? "Incline walk" : STEADY_NAME[activity],
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
