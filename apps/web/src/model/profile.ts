import { applyProfile, buildProfile, type FeedbackSession, type SessionPlan, type TrainingProfile } from "@repcurve/engine";
import type { Core, SessionRecord } from "./types";

const DAY_MS = 86_400_000;
let cached: { state: Core["state"]; history: SessionRecord[]; day: number; profile: TrainingProfile } | null = null;

/** What a finished session tells the profile: its sets (with any pain and where) and its swaps. */
export function feedbackOf(r: SessionRecord): FeedbackSession {
  return { finishedAt: r.finishedAt, kind: r.kind, sets: r.sets, ...(r.swaps ? { swaps: r.swaps } : {}) };
}

/** The user's training profile, rebuilt from their state and history (memoised per day). */
export function profileFor(core: Pick<Core, "state">, history: SessionRecord[], now: number): TrainingProfile {
  const day = Math.floor(now / DAY_MS);
  if (cached && cached.state === core.state && cached.history === history && cached.day === day) return cached.profile;
  const profile = buildProfile(core.state, history.filter((r) => !r.skipped).map(feedbackOf), now);
  cached = { state: core.state, history, day, profile };
  return profile;
}

/** A planned session with the profile's cautions on it. */
export function withProfile(plan: SessionPlan, core: Pick<Core, "state">, history: SessionRecord[], now: number): SessionPlan {
  return applyProfile(plan, profileFor(core, history, now));
}
