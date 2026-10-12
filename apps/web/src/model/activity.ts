import { localWeek } from "./plan";
import type { Core, ExtraActivity, SessionRecord } from "./types";

/** WHO 2020 guidelines for adults: 150–300 minutes of moderate activity a week (vigorous counts double), and strength work on 2 or more days. */
export const WHO_AEROBIC_MIN = 150;
export const WHO_AEROBIC_MAX = 300;
export const WHO_STRENGTH_DAYS = 2;

const dayKey = (t: number) => new Date(t).toDateString();

/**
 * Moderate-equivalent minutes of a finished cardio session: hard parts count double, brisk parts
 * once, an easy cool-down not at all. Scaled to the minutes actually done.
 */
export function cardioCredit(r: SessionRecord): number {
  if (r.kind !== "cardio" || r.skipped || !r.cardio) return 0;
  const segments = r.plan.cardio?.segments ?? [];
  const planned = segments.reduce((n, s) => n + s.minutes, 0);
  if (planned === 0) return r.cardio.minutes;
  const weighted = segments.reduce((n, s) => n + s.minutes * (s.effort >= 7 ? 2 : s.effort >= 3 ? 1 : 0), 0);
  return Math.round((r.cardio.minutes * weighted) / planned);
}

export const extraCredit = (a: ExtraActivity) => (a.vigorous ? a.minutes * 2 : a.minutes);

export interface WeekActivity {
  /** Moderate-equivalent aerobic minutes this week, from cardio sessions and logged activity. */
  aerobic: number;
  /** Days this week with a strength session. */
  strengthDays: number;
  /** Activity logged outside RepCurve this week, newest first. */
  extras: ExtraActivity[];
}

export function weekActivity(core: Pick<Core, "activities">, history: SessionRecord[], now: number): WeekActivity {
  const week = localWeek(now);
  const thisWeek = history.filter((r) => !r.skipped && localWeek(r.finishedAt) === week);
  const extras = (core.activities ?? []).filter((a) => localWeek(a.at) === week).sort((a, b) => b.at - a.at);
  return {
    aerobic: thisWeek.reduce((n, r) => n + cardioCredit(r), 0) + extras.reduce((n, a) => n + extraCredit(a), 0),
    strengthDays: new Set(thisWeek.filter((r) => r.kind === "strength").map((r) => dayKey(r.finishedAt))).size,
    extras,
  };
}

/** Keep the log small: activity older than a year has done its job. */
export function addActivity(core: Core, a: ExtraActivity): Core {
  const cutoff = a.at - 366 * 24 * 60 * 60 * 1000;
  return { ...core, activities: [...(core.activities ?? []).filter((x) => x.at >= cutoff), a] };
}

export function removeActivity(core: Core, at: number): Core {
  return { ...core, activities: (core.activities ?? []).filter((x) => x.at !== at) };
}
