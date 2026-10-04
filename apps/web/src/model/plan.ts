import {
  applyState,
  initialTrainingState,
  makeContext,
  planSessionWith,
  weekAndDay,
  type EngineContext,
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

export function planFor(core: Core, index: number, minutes?: number | null): SessionPlan {
  const ctx = contextFor(core);
  return planSessionWith(ctx, index, {
    restSec: core.settings.restSec,
    transitionSec: core.settings.transitionSec,
    ...(minutes ? { minutes } : {}),
  });
}

/** The next session, personalised from the training state. */
export function todayPlan(core: Core, history: SessionRecord[], now: number, minutes?: number | null): SessionPlan {
  const ctx = contextFor(core);
  const days = daysSinceLastStrength(history, now);
  return applyState(planFor(core, core.nextIndex, minutes), core.state, ctx, days !== undefined ? { daysSinceLastStrength: days } : {});
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
  const { week } = weekAndDay(ctx, core.nextIndex);
  const days = ctx.template.length;
  const first = (week - 1) * days;
  const byIndex = new Map(history.map((r) => [r.index, r]));
  const slots: WeekSlot[] = [];
  for (let i = first; i < first + days; i++) {
    const done = byIndex.get(i);
    const plan = done?.plan ?? planFor(core, i);
    slots.push({
      index: i,
      kind: plan.kind,
      name: plan.name,
      status: done ? (done.skipped ? "skipped" : "done") : i === core.nextIndex ? "next" : "upcoming",
    });
  }
  return { week, slots };
}

/** Consecutive weeks (ending with the current or last week) with at least one session done. */
export function weekStreak(history: SessionRecord[], now: number): number {
  const done = history.filter((r) => !r.skipped);
  if (done.length === 0) return 0;
  const weekOf = (t: number) => Math.floor((t - Date.UTC(2024, 0, 1)) / (7 * DAY_MS));
  const weeks = new Set(done.map((r) => weekOf(r.finishedAt)));
  let w = weekOf(now);
  if (!weeks.has(w)) w -= 1;
  let streak = 0;
  while (weeks.has(w)) {
    streak++;
    w--;
  }
  return streak;
}
