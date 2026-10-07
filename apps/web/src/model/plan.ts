import {
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
import { DEFAULT_SETTINGS, type Core, type SessionRecord, type Settings } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

let cached: { key: string; ctx: EngineContext } | null = null;

/** Engine context for the user's current profile and equipment (memoised). */
export function contextFor(core: Pick<Core, "profile" | "equipment">): EngineContext {
  const key = JSON.stringify([core.profile, core.equipment]);
  if (!cached || cached.key !== key) cached = { key, ctx: makeContext(core.profile, core.equipment) };
  return cached.ctx;
}

export function newCore(profile: Profile, equipment: Equipment, now: number, settings: Settings = DEFAULT_SETTINGS): Core {
  return {
    version: 1,
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

export function planFor(core: Core, index: number, minutes?: number | null, lastCardioEffort?: number): SessionPlan {
  const ctx = contextFor(core);
  return planSessionWith(ctx, positionOf(core, index), {
    restSec: core.settings.restSec,
    transitionSec: core.settings.transitionSec,
    ...(minutes ? { minutes } : {}),
    ...(lastCardioEffort !== undefined ? { lastCardioEffort } : {}),
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
    { weeks: 2, restSec: core.settings.restSec, transitionSec: core.settings.transitionSec, state: core.state, createdAt: "current" },
  );
}

/** The next session, personalised from the training state. */
export function todayPlan(core: Core, history: SessionRecord[], now: number, minutes?: number | null): SessionPlan {
  const ctx = contextFor(core);
  const days = daysSinceLastStrength(history, now);
  return applyState(planFor(core, core.nextIndex, minutes, lastCardioEffort(history)), core.state, ctx, days !== undefined ? { daysSinceLastStrength: days } : {});
}

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
