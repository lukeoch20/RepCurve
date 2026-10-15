import {
  applyProfile,
  bringBack,
  buildProfile,
  clearPainChecks,
  resetWorkingWeight,
  type FeedbackSession,
  type ProfileOverrides,
  type SessionPlan,
  type TrainingProfile,
} from "@repcurve/engine";
import type { Core, SessionRecord } from "./types";

const DAY_MS = 86_400_000;
let cached: { state: Core["state"]; overrides: ProfileOverrides | undefined; history: SessionRecord[]; day: number; profile: TrainingProfile } | null = null;

/** What a finished session tells the profile: its sets (with any pain and where), its swaps and how sore you were. */
export function feedbackOf(r: SessionRecord): FeedbackSession {
  return { finishedAt: r.finishedAt, kind: r.kind, sets: r.sets, ...(r.swaps ? { swaps: r.swaps } : {}), ...(r.soreness ? { soreness: r.soreness } : {}) };
}

const feedback = (history: SessionRecord[]) => history.filter((r) => !r.skipped).map(feedbackOf);

/** The user's training profile, rebuilt from their state, history and corrections (memoised per day). */
export function profileFor(core: Pick<Core, "state" | "profileOverrides">, history: SessionRecord[], now: number): TrainingProfile {
  const day = Math.floor(now / DAY_MS);
  if (cached && cached.state === core.state && cached.overrides === core.profileOverrides && cached.history === history && cached.day === day) return cached.profile;
  const profile = buildProfile(core.state, feedback(history), now, core.profileOverrides);
  cached = { state: core.state, overrides: core.profileOverrides, history, day, profile };
  return profile;
}

/** A planned session with the profile's cautions and re-tests on it. */
export function withProfile(plan: SessionPlan, core: Pick<Core, "state" | "profileOverrides">, history: SessionRecord[], now: number): SessionPlan {
  return applyProfile(plan, profileFor(core, history, now));
}

/** "It's fine now": the area's caution lifts, and exercises that hurt there stop waiting for a pain-free session. */
export function cautionFine(core: Core, history: SessionRecord[], area: string, now: number): Core {
  const o = core.profileOverrides ?? {};
  return {
    ...core,
    state: clearPainChecks(core.state, feedback(history), area),
    profileOverrides: { ...o, cautionsCleared: { ...o.cautionsCleared, [area]: now } },
  };
}

/** Forget why an exercise was swapped out, and bring it back where a for-good swap replaced it. */
export function forgetSwaps(core: Core, history: SessionRecord[], exerciseId: string, now: number): Core {
  const o = core.profileOverrides ?? {};
  const to = profileFor(core, history, now).preferences.swappedFor[exerciseId];
  return {
    ...core,
    state: to ? bringBack(core.state, exerciseId, to) : core.state,
    profileOverrides: { ...o, forgotten: { ...o.forgotten, [exerciseId]: now } },
  };
}

/** Re-test an exercise's working weight: its next session starts with a benchmark set. */
export function retest(core: Core, exerciseId: string): Core {
  if (!core.state.exercises[exerciseId]) return core;
  const o = core.profileOverrides ?? {};
  const state = resetWorkingWeight(core.state, exerciseId);
  // Re-tests already done (calibrated again) are dropped as new ones are added.
  const waiting = (o.rebenchmark ?? []).filter((id) => id !== exerciseId && state.exercises[id] && !state.exercises[id]!.calibrated);
  return { ...core, state, profileOverrides: { ...o, rebenchmark: [...waiting, exerciseId] } };
}

/** Drops re-tests that are done (the benchmark has set the weight again), so a later reset can't revive one. */
export function settleRetests(core: Core): Core {
  const o = core.profileOverrides;
  if (!o?.rebenchmark) return core;
  const waiting = o.rebenchmark.filter((id) => core.state.exercises[id] && !core.state.exercises[id]!.calibrated);
  return waiting.length === o.rebenchmark.length ? core : { ...core, profileOverrides: { ...o, rebenchmark: waiting } };
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const times = (x: unknown): Record<string, number> | undefined => {
  if (!isObj(x)) return undefined;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(x)) if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  return out;
};

/** Profile corrections from storage: fields this version knows are checked, others are kept. */
export function migrateOverrides(x: unknown): ProfileOverrides | undefined {
  if (!isObj(x)) return undefined;
  const { cautionsCleared, forgotten, rebenchmark, ...rest } = x;
  const out: ProfileOverrides = { ...rest };
  const cleared = times(cautionsCleared);
  if (cleared) out.cautionsCleared = cleared;
  const forgot = times(forgotten);
  if (forgot) out.forgotten = forgot;
  if (Array.isArray(rebenchmark)) out.rebenchmark = rebenchmark.filter((id): id is string => typeof id === "string");
  return out;
}
