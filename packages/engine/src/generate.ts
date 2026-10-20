import { buildCardioSession } from "./cardio.js";
import { makeContext, type EngineContext } from "./context.js";
import { explain } from "./explain.js";
import { deltHeadCeiling, volumeCeiling, volumeTarget } from "./level.js";
import { buildStrengthSession, rampOf, variantsFor, type StrengthSessionInput } from "./session.js";
import { applyState } from "./state.js";
import { buildPool } from "./pool.js";
import type { Muscle, Pattern } from "@repcurve/shared";
import type { CardioActivity, GenerateInput, GenerateOptions, Pool, Program, SessionPlan } from "./types.js";
import { DELT_HEADS, MUSCLES, ceilingVolume, emptyVolume, hardSets, weeklyDeltHeads, weeklyVolume } from "./volume.js";

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
  /**
   * Strength sessions already done this week, as done (a longer day earlier in the week). The
   * session being planned fits around them, so the week stays within its ceiling.
   */
  weekDone?: SessionPlan[];
  /** Exercises to leave out of a strength session: the plan regenerated because the person wasn't feeling it. */
  exclude?: string[];
}

/** Weeks in a training block. People past the novice stage get alternate exercises every other block. */
export const BLOCK_WEEKS = 6;

/** The volume level a week is planned at (set at its start: a promotion takes effect from the next week). */
export function weekLevel(ctx: EngineContext, week: number) {
  return ctx.levelAt((week - 1) * ctx.template.length);
}

/**
 * Whether this week's plan uses each slot's alternate exercise: every other block, for someone past
 * the novice stage when the block began (a promotion mid-block waits for the next block).
 */
export function alternateBlock(ctx: EngineContext, week: number): boolean {
  const block = Math.floor((week - 1) / BLOCK_WEEKS);
  return block % 2 === 1 && weekLevel(ctx, block * BLOCK_WEEKS + 1) !== "novice";
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
  // Only what changes a strength plan is in the key (cardio options and today's time are not).
  const rest: PlanOptions = {
    ...(opts.restSec !== undefined ? { restSec: opts.restSec } : {}),
    ...(opts.transitionSec !== undefined ? { transitionSec: opts.transitionSec } : {}),
    ...(opts.e1rmByExercise ? { e1rmByExercise: opts.e1rmByExercise } : {}),
  };
  const e1rm = Object.entries(opts.e1rmByExercise ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const key = `${week}|${opts.restSec ?? ""}|${opts.transitionSec ?? ""}|${JSON.stringify(e1rm)}`;
  let byCtx = chainCache.get(ctx);
  if (!byCtx) chainCache.set(ctx, (byCtx = new Map()));
  const hit = byCtx.get(key);
  if (hit) return hit;
  const n = ctx.template.length;
  const input = (d: number) => strengthInput(ctx, (week - 1) * n + d, rest, ctx.profile);
  // Room kept for each later day: its main pairs at their planned rounds, or, for a muscle the
  // whole week's main pairs would already take past the ceiling, just their fewest rounds, so
  // that every day's opening still fits.
  const plannedPlans = ctx.template.map((kind, d) => (kind === "strength" ? buildStrengthSession({ ...input(d), baselineOnly: true }) : null));
  const planned = plannedPlans.map((p) => (p ? weeklyVolume([p]) : null));
  const patternsOf = (s: SessionPlan | null) => (s ? s.supersets.flatMap((ss) => ss.items.map((p) => p.pattern)) : []);
  const fewest = ctx.template.map((kind, d) =>
    kind === "strength" ? weeklyVolume([buildStrengthSession({ ...input(d), baselineOnly: true, rounds: Math.min(2, BASE_ROUNDS) })]) : null,
  );
  // As the ceiling counts it (lateral raises count against the side head instead).
  const plannedTotal = ceilingVolume(plannedPlans.filter((p): p is SessionPlan => p !== null), weekLevel(ctx, week));
  const ceiling = volumeCeiling(weekLevel(ctx, week));
  const baselines = planned.map((v, d) => {
    if (!v) return null;
    const out = emptyVolume();
    for (const m of MUSCLES) out[m] = plannedTotal[m] <= ceiling ? v[m] : fewest[d]![m];
    return out;
  });
  const finals: (SessionPlan | null)[] = [];
  ctx.template.forEach((kind, d) => {
    if (kind !== "strength") {
      finals.push(null);
      return;
    }
    const others = emptyVolume();
    finals.forEach((f) => f && addInto(others, weeklyVolume([f])));
    for (let j = d + 1; j < n; j++) if (baselines[j]) addInto(others, baselines[j]!);
    // Shoulder heads: what the days before planned, and the main pairs of the days after.
    const weekOthersHeads = weeklyDeltHeads([...finals, ...plannedPlans.slice(d + 1)].filter((s): s is SessionPlan => s !== null));
    const weekPatterns = [...finals.flatMap(patternsOf), ...plannedPlans.slice(d + 1).flatMap(patternsOf)];
    finals.push(buildStrengthSession({ ...input(d), weekOthers: others, weekOthersHeads, weekPatterns }));
  });
  byCtx.set(key, finals);
  return finals;
}

const widePools = new WeakMap<EngineContext, Pool>();

/** The context's pool with stand-ins planned too, for a regenerated session. */
function widePool(ctx: EngineContext): Pool {
  let pool = widePools.get(ctx);
  if (!pool) widePools.set(ctx, (pool = buildPool(ctx.equipment, ctx.profile.injuries, ctx.profile, { standIns: true })));
  return pool;
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
  const blockStart = week > BLOCK_WEEKS && weekLevel(ctx, week - weekInBlock) !== "novice" && weekInBlock < (split === "full_body" ? 1 : 2);
  return {
    profile,
    equipment: ctx.equipment,
    level: ctx.level,
    volumeLevel: weekLevel(ctx, week),
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
  // The rest of the week: what was done for the days already done this week, the plan for the others.
  const done = new Map((opts.weekDone ?? []).filter((s) => s.kind === "strength" && s.week === week && s.dayIndex !== dayIndex).map((s) => [s.dayIndex, s]));
  const others = emptyVolume();
  chain.forEach((s, d) => s && d !== dayIndex && addInto(others, weeklyVolume([done.get(d) ?? s])));
  const today = opts.minutes !== undefined && opts.minutes !== ctx.profile.minutesPerSession;
  const ceiling = volumeCeiling(weekLevel(ctx, week));
  const weekPlans = chain.flatMap((s, d) => (s ? [d === dayIndex ? steady : (done.get(d) ?? s)] : []));
  const asCounted = ceilingVolume(weekPlans, weekLevel(ctx, week));
  const heads = weeklyDeltHeads(weekPlans);
  const headCeiling = deltHeadCeiling(weekLevel(ctx, week));
  const overWeek = MUSCLES.some((m) => m !== "core" && asCounted[m] > ceiling + 1e-9) || DELT_HEADS.some((h) => heads[h] > headCeiling + 1e-9);
  const regenerate = (opts.exclude?.length ?? 0) > 0;
  if (today || overWeek || regenerate) {
    // Today's time differs, the session was regenerated, or a longer day earlier in the week left less room: this session fits
    // around the rest of the week.
    const weekPatterns = chain.flatMap((s, d) => (s && d !== dayIndex ? (done.get(d) ?? s).supersets.flatMap((ss) => ss.items.map((p) => p.pattern)) : []));
    const weekOthersHeads = weeklyDeltHeads(chain.flatMap((s, d) => (s && d !== dayIndex ? [done.get(d) ?? s] : [])));
    const input = {
      ...strengthInput(ctx, index, opts, profile),
      weekOthers: others,
      weekOthersHeads,
      weekPatterns,
      // A regenerated session may also use stand-ins (one-arm, band and bodyweight versions), for more to choose from.
      ...(regenerate ? { exclude: opts.exclude!, pool: widePool(ctx) } : {}),
    };
    // A longer day is the usual session plus more (when the usual session still fits the week and
    // today's time); otherwise the session is planned afresh.
    const extend = today && !regenerate && opts.minutes! > ctx.profile.minutesPerSession && !overWeek && steady.estimatedMinutes <= opts.minutes!;
    steady = buildStrengthSession(extend ? { ...input, start: steady } : input);
  }
  const rampWeek = week === 1 && profile.trainingHistory === "never";
  // Same exercises and supersets as the steady weeks, one set lighter. A copy, so changes to the
  // returned plan never reach the week's cached plans.
  return rampWeek ? rampOf(structuredClone(steady)) : structuredClone(steady);
}

export function planSession(input: GenerateInput, index: number, opts: PlanOptions = {}): SessionPlan {
  return planSessionWith(makeContext(input.profile, input.equipment, {}, input.scheduleEquipment), index, opts);
}

export function generateProgram(input: GenerateInput, opts: GenerateOptions = {}): Program {
  const ctx = makeContext(input.profile, input.equipment, {
    strengthSessionsLogged: opts.state?.strengthSessionsLogged ?? 0,
    ...(opts.position !== undefined ? { position: opts.position } : {}),
  }, input.scheduleEquipment);
  const weeks = opts.weeks ?? 4;
  const planOpts: PlanOptions = {
    e1rmByExercise: opts.e1rmByExercise ?? {},
    ...(opts.restSec !== undefined ? { restSec: opts.restSec } : {}),
    ...(opts.transitionSec !== undefined ? { transitionSec: opts.transitionSec } : {}),
  };
  const sessions: SessionPlan[] = [];
  for (let i = 0; i < weeks * ctx.template.length; i++) sessions.push(planSessionWith(ctx, i, planOpts));

  // The week described: the user's current one, or week 2 (the first steady week) for a new plan.
  const describedWeek = opts.position !== undefined ? Math.max(2, weekAndDay(ctx, opts.position).week) : Math.min(2, weeks);
  const n = ctx.template.length;
  const plannedWeek = Array.from({ length: n }, (_, d) => planSessionWith(ctx, (describedWeek - 1) * n + d, planOpts));
  const steadyState = opts.state ? { ...opts.state, deloadRemaining: 0 } : null;
  const steadyWeek = steadyState ? plannedWeek.map((s) => applyState(s, steadyState, ctx)) : plannedWeek;
  const volume = weeklyVolume(steadyWeek);
  const level = weekLevel(ctx, describedWeek);
  const target = volumeTarget(level);
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
      volumeLevel: level,
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
