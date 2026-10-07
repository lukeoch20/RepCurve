import { buildCardioSession } from "./cardio.js";
import { makeContext, type EngineContext } from "./context.js";
import { explain } from "./explain.js";
import { volumeTarget } from "./level.js";
import { buildStrengthSession, type StrengthSessionInput } from "./session.js";
import { applyState } from "./state.js";
import type { Pattern } from "@repcurve/shared";
import type { GenerateInput, GenerateOptions, Program, SessionPlan } from "./types.js";
import { hardSets, weeklyVolume } from "./volume.js";

export const BASE_ROUNDS = 3;

export interface PlanOptions {
  /** Today's time budget, when it differs from the profile ("I only have 12 minutes"). */
  minutes?: number;
  /** Rest after each superset round, seconds. Defaults by time budget. */
  restSec?: number;
  /** Seconds between exercises within a round. */
  transitionSec?: number;
  e1rmByExercise?: Record<string, number>;
  /** Effort (1–10) reported for the last cardio session; steers the next one. */
  lastCardioEffort?: number;
}

/** Week and day for a position in the session sequence. */
export function weekAndDay(ctx: EngineContext, index: number): { week: number; dayIndex: number } {
  const days = ctx.template.length;
  return { week: Math.floor(index / days) + 1, dayIndex: index % days };
}

/**
 * The plan for the Nth session (0-based) of an open-ended sequence. Sessions
 * are a sequence, not calendar days: a missed day just means the next session
 * waits for you. Week 1 is the benchmark (and, for brand-new lifters, a lighter
 * ramp); later weeks repeat the steady structure while the training state
 * carries loads and reps forward.
 */
export function planSessionWith(ctx: EngineContext, index: number, opts: PlanOptions = {}): SessionPlan {
  const { week, dayIndex } = weekAndDay(ctx, index);
  const kind = ctx.template[dayIndex]!;
  const profile = opts.minutes !== undefined ? { ...ctx.profile, minutesPerSession: opts.minutes } : ctx.profile;
  const before = ctx.template.slice(0, dayIndex);
  if (kind === "cardio") {
    const cardioIndex = before.filter((k) => k === "cardio").length;
    return buildCardioSession({
      profile,
      equipment: ctx.equipment,
      level: ctx.level,
      cardioIndex,
      index,
      week,
      dayIndex,
      cardioPerWeek: ctx.template.filter((k) => k === "cardio").length,
      ...(opts.lastCardioEffort !== undefined ? { lastEffort: opts.lastCardioEffort } : {}),
    });
  }
  const base: StrengthSessionInput = {
    profile,
    equipment: ctx.equipment,
    level: ctx.level,
    pool: ctx.pool,
    index,
    strengthIndex: before.filter((k) => k === "strength").length,
    week,
    dayIndex,
    rounds: BASE_ROUNDS,
    benchmark: week === 1,
    e1rmByExercise: opts.e1rmByExercise ?? {},
    ...(opts.restSec !== undefined ? { restSec: opts.restSec } : {}),
    ...(opts.transitionSec !== undefined ? { transitionSec: opts.transitionSec } : {}),
  };
  const steady = buildStrengthSession(base);
  const rampWeek = week === 1 && profile.trainingHistory === "never";
  if (!rampWeek) return steady;
  // Same exercises and superset count as the steady weeks, one round lighter.
  return buildStrengthSession({
    ...base,
    rounds: BASE_ROUNDS - 1,
    maxRounds: BASE_ROUNDS - 1,
    maxSupersets: steady.supersets.length,
  });
}

export function planSession(input: GenerateInput, index: number, opts: PlanOptions = {}): SessionPlan {
  return planSessionWith(makeContext(input.profile, input.equipment), index, opts);
}

export function generateProgram(input: GenerateInput, opts: GenerateOptions = {}): Program {
  const ctx = makeContext(input.profile, input.equipment);
  const weeks = opts.weeks ?? 4;
  const planOpts: PlanOptions = {
    e1rmByExercise: opts.e1rmByExercise ?? {},
    ...(opts.restSec !== undefined ? { restSec: opts.restSec } : {}),
    ...(opts.transitionSec !== undefined ? { transitionSec: opts.transitionSec } : {}),
  };
  const sessions: SessionPlan[] = [];
  for (let i = 0; i < weeks * ctx.template.length; i++) sessions.push(planSessionWith(ctx, i, planOpts));

  const plannedWeek = sessions.filter((s) => s.week === Math.min(2, weeks));
  const steadyState = opts.state ? { ...opts.state, deloadRemaining: 0 } : null;
  const steadyWeek = steadyState ? plannedWeek.map((s) => applyState(s, steadyState, ctx)) : plannedWeek;
  const volume = weeklyVolume(steadyWeek);
  const target = volumeTarget(ctx.level);
  const strengthSessions = steadyWeek.filter((s) => s.kind === "strength");
  const avgHardSets = strengthSessions.length
    ? Math.round(strengthSessions.reduce((n, s) => n + hardSets(s), 0) / strengthSessions.length)
    : 0;

  return {
    createdAt: opts.createdAt ?? new Date().toISOString(),
    level: ctx.level,
    weeks,
    template: ctx.template,
    sessions,
    weeklyVolume: volume,
    volumeTarget: target,
    explanation: explain(input.profile, input.equipment, ctx.level, ctx.template, volume, target, avgHardSets, {
      benchmarkWeek: sessions.some((s) => s.week === 1 && s.supersets.some((ss) => ss.items.some((p) => p.benchmarkSet))),
      missingPatterns: missingPatterns(steadyWeek),
    }),
  };
}

/** Main movement patterns that no strength session of the week trains. */
export function missingPatterns(week: SessionPlan[]): Pattern[] {
  const strength = week.filter((s) => s.kind === "strength");
  if (strength.length === 0) return [];
  const trained = new Set(strength.flatMap((s) => s.supersets.flatMap((ss) => ss.items.map((p) => p.pattern))));
  const main: Pattern[] = ["squat", "hinge", "horizontal_push", "vertical_push", "row"];
  return main.filter((p) => !trained.has(p));
}
