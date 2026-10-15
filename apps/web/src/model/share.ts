import { displayLoad, type Units } from "@repcurve/shared";
import { weekStreak } from "./plan";
import { change, weeklyAdherence, type LiftSeries } from "./progress";
import type { SessionRecord } from "./types";

/**
 * What the shareable progress card shows: the curve of one lift (or sessions per week before
 * there are lifts) and a few totals. Numbers and an exercise name only: nothing about the
 * person, and never anything about pain.
 */
export interface ShareCard {
  heading: string;
  subheading: string;
  /** The change shown big, e.g. "+18%", when there's more than one point. */
  big: string | null;
  /** A line through these values, oldest first… */
  line: number[] | null;
  /** …or bars of sessions per week, oldest first. */
  bars: number[] | null;
  stats: { value: string; label: string }[];
}

export function shareCard(history: SessionRecord[], lift: LiftSeries | null, units: Units, now: number): ShareCard {
  const done = history.filter((r) => !r.skipped);
  const streak = weekStreak(history, now);
  const minutes = done.reduce((n, r) => n + r.activeMinutes, 0);
  const stats = [
    { value: done.length.toLocaleString("en-US"), label: done.length === 1 ? "workout" : "workouts" },
    { value: String(streak), label: "week streak" },
    { value: minutes.toLocaleString("en-US"), label: "minutes" },
  ];
  if (lift && lift.points.length > 0) {
    const share = change(lift.points);
    const value = (y: number) => (lift.metric === "e1rm" ? displayLoad(y, units) : y);
    return {
      heading: "My strength curve",
      subheading: `${lift.name} · ${lift.metric === "e1rm" ? "estimated max" : "best set, reps"}`,
      big: share === null ? null : `${share >= 0 ? "+" : "−"}${Math.abs(Math.round(share * 100))}%`,
      line: lift.points.map((p) => value(p.y)),
      bars: null,
      stats,
    };
  }
  const weeks = weeklyAdherence(history, 1, now).slice(-12);
  return {
    heading: "Showing up",
    subheading: "Workouts each week",
    big: null,
    line: null,
    bars: weeks.length > 0 ? weeks.map((w) => w.done) : null,
    stats,
  };
}
