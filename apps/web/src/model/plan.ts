import {
  applySoreness,
  prescriptionsOf,
  applyState,
  generateProgram,
  initialTrainingState,
  makeContext,
  planSessionWith,
  weekAndDay,
  type EngineContext,
  type Program,
  type SessionPlan,
} from "@repcurve/engine";
import type { Equipment, Profile } from "@repcurve/shared";
import { withProfile } from "./profile";
import { currentSoreness } from "./soreness";
import { DATA_VERSION, DEFAULT_SETTINGS, type Core, type SessionRecord, type Settings } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

let cached: { key: string; ctx: EngineContext } | null = null;

/**
 * Engine context for the user's current profile and equipment (memoised). Sessions logged so far
 * step the plan's volume up as the person moves past the novice stage.
 */
export function contextFor(
  core: Pick<Core, "profile" | "equipment"> & Partial<Pick<Core, "nextIndex" | "positionOffset">> & { state?: Pick<Core["state"], "strengthSessionsLogged"> },
): EngineContext {
  const logged = core.state?.strengthSessionsLogged ?? 0;
  // Where the person is in the sequence places a promotion in time: it starts with the next week.
  const position = core.nextIndex !== undefined ? positionOf(core, core.nextIndex) : undefined;
  const key = JSON.stringify([core.profile, core.equipment, logged, position]);
  if (!cached || cached.key !== key) {
    cached = { key, ctx: makeContext(core.profile, core.equipment, { strengthSessionsLogged: logged, ...(position !== undefined ? { position } : {}) }) };
  }
  return cached.ctx;
}

export function newCore(profile: Profile, equipment: Equipment, now: number, settings: Settings = DEFAULT_SETTINGS): Core {
  return {
    version: DATA_VERSION,
    profile,
    equipment,
    settings,
    state: initialTrainingState(),
    startedAt: new Date(now).toISOString(),
    nextIndex: 0,
  };
}

export function daysSinceLastStrength(history: SessionRecord[], now: number): number | undefined {
  for (let i = history.length - 1; i >= 0; i--) {
    const r = history[i]!;
    if (r.kind === "strength" && !r.skipped) return Math.floor((now - r.finishedAt) / DAY_MS);
  }
  return undefined;
}

/** Position in the programme (which week and day) of the session with this count. */
export function positionOf(core: Pick<Core, "positionOffset">, index: number): number {
  return index + (core.positionOffset ?? 0);
}

/**
 * Keep the user in the same week when days per week change: the next session becomes the
 * same day of the current week in the new schedule (or its last day).
 */
export function rescheduled(core: Core, profile: Profile, equipment: Equipment): Core {
  const before = contextFor(core).template.length;
  const after = contextFor({ profile, equipment }).template.length;
  const next = { ...core, profile, equipment };
  if (before === after) return next;
  const position = positionOf(core, core.nextIndex);
  const week = Math.floor(position / before);
  const day = Math.min(position % before, after - 1);
  return { ...next, positionOffset: week * after + day - core.nextIndex };
}

export function planFor(core: Core, index: number, minutes?: number | null, lastCardioEffort?: number, weekDone?: SessionPlan[]): SessionPlan {
  const ctx = contextFor(core);
  const exclude = core.regenerated?.index === index ? core.regenerated.exclude : [];
  return planSessionWith(ctx, positionOf(core, index), {
    ...(exclude.length > 0 ? { exclude } : {}),
    ...(weekDone && weekDone.length > 0 ? { weekDone } : {}),
    restSec: core.settings.restSec,
    transitionSec: core.settings.transitionSec,
    ...(minutes ? { minutes } : {}),
    ...(lastCardioEffort !== undefined ? { lastCardioEffort } : {}),
    ...(core.settings.cardioActivity ? { cardioActivity: core.settings.cardioActivity } : {}),
  });
}

/** Effort the user reported for their most recent cardio session. */
export function lastCardioEffort(history: SessionRecord[]): number | undefined {
  for (let i = history.length - 1; i >= 0; i--) {
    const r = history[i]!;
    if (r.kind === "cardio" && !r.skipped && r.cardio) return r.cardio.effort;
  }
  return undefined;
}

/**
 * The programme as the user gets it now: their rest and switch settings, and weekly volume
 * from the sessions personalised with their training state (outside any deload).
 */
export function currentProgram(core: Core): Program {
  return generateProgram(
    { profile: core.profile, equipment: core.equipment },
    { weeks: 2, restSec: core.settings.restSec, transitionSec: core.settings.transitionSec, state: core.state, position: positionOf(core, core.nextIndex), createdAt: "current" },
  );
}

/** Candidate lengths for today: 10 to 60 minutes in fives, plus the user's usual length. */
export function timeSteps(usual: number): number[] {
  const steps = new Set([10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, usual]);
  return [...steps].sort((a, b) => a - b);
}

/**
 * Today's time choices: only lengths that change the session (35 is left out when it plans
 * the same as 30), plus the usual length.
 */
export function timeChoices(core: Core, history: SessionRecord[], now: number): number[] {
  const usual = core.profile.minutesPerSession;
  const out: { minutes: number; work: number }[] = [];
  for (const minutes of timeSteps(usual)) {
    const work = planWork(todayPlan(core, history, now, minutes));
    const prev = out[out.length - 1];
    if (!prev || work > prev.work) out.push({ minutes, work });
    // The usual length is always a choice, standing in for a shorter one that plans the same.
    else if (minutes === usual) out[out.length - 1] = { minutes, work };
  }
  return out.map((o) => o.minutes);
}

/** How much a plan asks of you, to tell whether more time actually adds anything. */
export function planWork(plan: SessionPlan): number {
  if (plan.kind === "cardio") return plan.cardio?.totalMinutes ?? plan.budgetMinutes;
  return plan.supersets.reduce((n, ss) => n + ss.items.reduce((m, p) => m + p.sets, 0), 0) + (plan.finisher?.sets ?? 0);
}

/** Strength sessions done in the current week, as done, so the next session fits around them. */
export function doneThisWeek(core: Core, history: SessionRecord[]): SessionPlan[] {
  const { week } = weekAndDay(contextFor(core), positionOf(core, core.nextIndex));
  return history.filter((r) => r.kind === "strength" && !r.skipped && r.plan.kind === "strength" && r.plan.week === week).map((r) => r.plan);
}

/** The next session, personalised from the training state, the training profile and today's "still sore" answers. */
export function todayPlan(core: Core, history: SessionRecord[], now: number, minutes?: number | null): SessionPlan {
  const ctx = contextFor(core);
  const days = daysSinceLastStrength(history, now);
  const plan = applyState(planFor(core, core.nextIndex, minutes, lastCardioEffort(history), doneThisWeek(core, history)), core.state, ctx, days !== undefined ? { daysSinceLastStrength: days } : {});
  return applySoreness(withProfile(plan, core, history, now), currentSoreness(core, now));
}

/** Exercises a strength plan uses, the core finisher included. */
export function planExerciseIds(plan: SessionPlan): string[] {
  return [...plan.supersets.flatMap((ss) => ss.items.map((p) => p.exerciseId)), ...(plan.finisher ? [plan.finisher.exerciseId] : [])];
}

/** The main movements a strength plan trains (squat, hinge, presses, pulls), arms and core aside. */
function mainPatterns(plan: SessionPlan): Set<string> {
  return new Set(plan.supersets.flatMap((ss) => ss.items.map((p) => p.pattern)).filter((p) => p !== "isolation" && p !== "core"));
}

/**
 * Today's strength session with other exercises, for someone not feeling the planned ones: the same
 * day, leaving out everything offered so far. It has to train the same main movements as the plan
 * and be about as much work; when leaving out everything offered so far can't manage that, only
 * what's on screen now is left out. Null when nothing else fits.
 */
export function regenerateToday(core: Core, history: SessionRecord[], now: number, minutes?: number | null): Core | null {
  const current = todayPlan(core, history, now, minutes);
  if (current.kind !== "strength") return null;
  const planned = isRegenerated(core) ? todayPlan(originalToday(core), history, now, minutes) : current;
  const needed = mainPatterns(planned);
  const shown = planExerciseIds(current);
  const before = isRegenerated(core) ? core.regenerated!.exclude : [];
  let fallback: { core: Core; score: number } | null = null;
  for (let exclude of [[...new Set([...before, ...shown])], shown]) {
    let next: Core = { ...core, regenerated: { index: core.nextIndex, exclude } };
    let plan = todayPlan(next, history, now, minutes);
    // A movement with nothing else to do it (the only overhead press there is) keeps its exercise.
    for (let i = 0; i < 2; i++) {
      const has = mainPatterns(plan);
      const keep = new Set(prescriptionsOf(current).filter((p) => needed.has(p.pattern) && !has.has(p.pattern)).map((p) => p.exerciseId));
      if (keep.size === 0) break;
      exclude = exclude.filter((id) => !keep.has(id));
      if (exclude.length === 0) break;
      next = { ...core, regenerated: { index: core.nextIndex, exclude } };
      plan = todayPlan(next, history, now, minutes);
    }
    const ids = planExerciseIds(plan);
    if (plan.kind !== "strength" || exclude.length === 0 || ids.every((id) => shown.includes(id))) continue;
    const has = mainPatterns(plan);
    const covered = [...needed].filter((p) => has.has(p)).length;
    const enough = planWork(plan) >= 0.85 * planWork(planned);
    if (covered === needed.size && enough) return next;
    const score = covered * 2 + (enough ? 1 : 0);
    if (!fallback || score > fallback.score) fallback = { core: next, score };
  }
  return fallback?.core ?? null;
}

/** Back to the session as planned. */
export function originalToday(core: Core): Core {
  const { regenerated: _, ...rest } = core;
  return rest;
}

/** Whether the next session has been regenerated. */
export const isRegenerated = (core: Core): boolean => core.regenerated?.index === core.nextIndex;

export interface WeekSlot {
  index: number;
  kind: "strength" | "cardio";
  name: string;
  status: "done" | "skipped" | "next" | "upcoming";
}

/** The sessions of the week the next session belongs to. */
export function weekSlots(core: Core, history: SessionRecord[]): { week: number; slots: WeekSlot[] } {
  const ctx = contextFor(core);
  const position = positionOf(core, core.nextIndex);
  const { week } = weekAndDay(ctx, position);
  const days = ctx.template.length;
  // Session counts for the days of this week; earlier days map to the sessions just before the next one.
  const first = core.nextIndex - (position - (week - 1) * days);
  const byIndex = new Map(history.map((r) => [r.index, r]));
  const slots: WeekSlot[] = [];
  for (let i = first; i < first + days; i++) {
    const done = i >= 0 ? byIndex.get(i) : undefined;
    const plan = done?.plan ?? planFor(core, i);
    slots.push({
      index: i,
      kind: done?.kind ?? plan.kind,
      name: done?.name ?? plan.name,
      status: done ? (done.skipped ? "skipped" : "done") : i === core.nextIndex ? "next" : "upcoming",
    });
  }
  return { week, slots };
}

export interface WeekSession extends WeekSlot {
  /** What was done (for finished sessions) or what is planned, personalised from the training state. */
  plan: SessionPlan;
}

/** The current week's sessions with their plans, for the week strip and the Plan tab. */
export function weekSessions(core: Core, history: SessionRecord[], now: number): { week: number; sessions: WeekSession[] } {
  const ctx = contextFor(core);
  const { week, slots } = weekSlots(core, history);
  const byIndex = new Map(history.map((r) => [r.index, r]));
  const sessions = slots.map((slot) => {
    const done = byIndex.get(slot.index);
    const usable = done && !done.skipped && Array.isArray(done.plan?.supersets) ? done.plan : null;
    const plan = usable ?? (slot.status === "next" ? todayPlan(core, history, now) : applyState(planFor(core, slot.index), core.state, ctx));
    return { ...slot, plan };
  });
  return { week, sessions };
}

/** Exercises in a plan (cardio counts its segments as one). */
export function exerciseCount(plan: SessionPlan): number {
  if (plan.kind === "cardio") return 1;
  return plan.supersets.reduce((n, ss) => n + ss.items.length, 0) + (plan.finisher ? 1 : 0);
}

/** Monday-start week number of a moment, in the user's own time zone. */
export function localWeek(t: number): number {
  const d = new Date(t);
  const daysSinceMonday = (d.getDay() + 6) % 7;
  // Calendar dates in local time, counted as whole days, so DST shifts don't matter.
  const monday = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() - daysSinceMonday);
  return Math.round(monday / (7 * DAY_MS));
}

/** Consecutive local weeks (ending with the current or last week) with at least one session done. */
export function weekStreak(history: SessionRecord[], now: number): number {
  const done = history.filter((r) => !r.skipped);
  if (done.length === 0) return 0;
  const weeks = new Set(done.map((r) => localWeek(r.finishedAt)));
  let w = localWeek(now);
  if (!weeks.has(w)) w -= 1;
  let streak = 0;
  while (weeks.has(w)) {
    streak++;
    w--;
  }
  return streak;
}
