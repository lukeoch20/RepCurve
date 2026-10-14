import { buildCardioSession } from "./cardio.js";
import { makeContext, type EngineContext } from "./context.js";
import { explain } from "./explain.js";
import { volumeTarget } from "./level.js";
import { buildStrengthSession, rampOf, variantsFor, type StrengthSessionInput } from "./session.js";
import { applyState } from "./state.js";
import type { Muscle, Pattern } from "@repcurve/shared";
import type { CardioActivity, GenerateInput, GenerateOptions, Program, SessionPlan } from "./types.js";
import { MUSCLES, emptyVolume, hardSets, weeklyVolume } from "./volume.js";

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
  /** The cardio activity the user prefers, used whenever the equipment and format allow it. */
  cardioActivity?: CardioActivity;
}

/** Weeks in a training block. People past the novice stage get alternate exercises every other block. */
export const BLOCK_WEEKS = 6;

/** Whether this week's plan uses each slot's alternate exercise. */
export function alternateBlock(ctx: EngineContext, week: number): boolean {
  return ctx.volumeLevel !== "novice" && Math.floor((week - 1) / BLOCK_WEEKS) % 2 === 1;
}

const chainCache = new WeakMap<EngineContext, Map<string, (SessionPlan | null)[]>>();

const addInto = (into: Record<Muscle, number>, v: Record<Muscle, number>) => {
  for (const m of MUSCLES) into[m] += v[m];
};

/**
 * The week's strength sessions, planned in order so that each one fills toward the muscles the
 * week is still short on. Each session sees what the sessions before it planned and the least the
 * sessions after it will do, so the week as a whole stays within the ceiling for the person's level
 * while every session keeps room for its opening pairs.
 */
function weekChain(ctx: EngineContext, week: number, opts: PlanOptions): (SessionPlan | null)[] {
  const { minutes: _today, ...rest } = opts;
  const key = `${week}|${JSON.stringify(rest)}`;
  let byCtx = chainCache.get(ctx);
  if (!byCtx) chainCache.set(ctx, (byCtx = new Map()));
  const hit = byCtx.get(key);
  if (hit) return hit;
  const n = ctx.template.length;
  const input = (d: number) => strengthInput(ctx, (week - 1) * n + d, rest, ctx.profile);
  const baselines = ctx.template.map((kind, d) => (kind === "strength" ? weeklyVolume([buildStrengthSession({ ...input(d), baselineOnly: true })]) : null));
  const finals: (SessionPlan | null)[] = [];
  ctx.template.forEach((kind, d) => {
    if (kind !== "strength") {
      finals.push(null);
      return;
    }
    const others = emptyVolume();
    finals.forEach((f) => f && addInto(others, weeklyVolume([f])));
    for (let j = d + 1; j < n; j++) if (baselines[j]) addInto(others, baselines[j]!);
    finals.push(buildStrengthSession({ ...input(d), weekOthers: others }));
  });
  byCtx.set(key, finals);
  return finals;
}

/** Inputs for the strength session at a position in the sequence. */
function strengthInput(ctx: EngineContext, index: number, opts: PlanOptions, profile: EngineContext["profile"]): StrengthSessionInput {
  const { week, dayIndex } = weekAndDay(ctx, index);
  const before = ctx.template.slice(0, dayIndex);
  // Splits rotate across weeks (push, pull, push | pull, push, pull) so every day type gets its turn;
  // full body keeps its A/B/C order within each week.
  const strengthIndex = before.filter((k) => k === "strength").length;
  const split = ctx.split;
  const rotation = split === "full_body" ? strengthIndex : (week - 1) * ctx.strengthPerWeek + strengthIndex;
  const alternate = alternateBlock(ctx, week);
  // A new block brings new exercises: the first time each day type comes round, uncalibrated ones get a benchmark.
  const weekInBlock = (week - 1) % BLOCK_WEEKS;
  const blockStart = week > BLOCK_WEEKS && ctx.volumeLevel !== "novice" && weekInBlock < (split === "full_body" ? 1 : 2);
  return {
    profile,
    equipment: ctx.equipment,
    level: ctx.level,
    volumeLevel: ctx.volumeLevel,
    split,
    pool: ctx.pool,
    index,
    strengthIndex,
    rotation,
    week,
    dayIndex,
    rounds: BASE_ROUNDS,
    // The first time each day type comes round, its first sets are benchmarks.
    benchmark: (split === "full_body" ? week === 1 : rotation < variantsFor(split).length) || blockStart,
    e1rmByExercise: opts.e1rmByExercise ?? {},
    ...(alternate ? { alternate } : {}),
    ...(opts.restSec !== undefined ? { restSec: opts.restSec } : {}),
    ...(opts.transitionSec !== undefined ? { transitionSec: opts.transitionSec } : {}),
  };
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
  if (kind === "cardio") {
    const before = ctx.template.slice(0, dayIndex);
    return buildCardioSession({
      profile,
      equipment: ctx.equipment,
      level: ctx.level,
      cardioIndex: before.filter((k) => k === "cardio").length,
      index,
      week,
      dayIndex,
      cardioPerWeek: ctx.template.filter((k) => k === "cardio").length,
      ...(opts.lastCardioEffort !== undefined ? { lastEffort: opts.lastCardioEffort } : {}),
      ...(opts.cardioActivity ? { activity: opts.cardioActivity } : {}),
    });
  }
  const chain = weekChain(ctx, week, opts);
  let steady = chain[dayIndex]!;
  if (opts.minutes !== undefined && opts.minutes !== ctx.profile.minutesPerSession) {
    // Today's time differs: the rest of the week stays as planned, and this session fits around it.
    const others = emptyVolume();
    chain.forEach((s, d) => s && d !== dayIndex && addInto(others, weeklyVolume([s])));
    const input = { ...strengthInput(ctx, index, opts, profile), weekOthers: others };
    // A longer day is the usual session plus more; a shorter one is planned afresh for the time.
    steady = buildStrengthSession(opts.minutes > ctx.profile.minutesPerSession ? { ...input, start: steady } : input);
  }
  const rampWeek = week === 1 && profile.trainingHistory === "never";
  // Same exercises and supersets as the steady weeks, one set lighter.
  return rampWeek ? rampOf(steady) : steady;
}

export function planSession(input: GenerateInput, index: number, opts: PlanOptions = {}): SessionPlan {
  return planSessionWith(makeContext(input.profile, input.equipment), index, opts);
}

export function generateProgram(input: GenerateInput, opts: GenerateOptions = {}): Program {
  const ctx = makeContext(input.profile, input.equipment, { strengthSessionsLogged: opts.state?.strengthSessionsLogged ?? 0 });
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
  const target = volumeTarget(ctx.volumeLevel);
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
      volumeLevel: ctx.volumeLevel,
      split: ctx.split,
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
